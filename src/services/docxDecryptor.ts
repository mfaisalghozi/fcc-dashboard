/**
 * Client-side decryption of password-protected .docx files.
 * Implements ECMA-376 Agile Encryption (Office 2010+) using the Web Crypto API.
 *
 * Key subtlety: ECMA-376 uses zero-padding (not PKCS#7) for both the key value
 * and the package segments. crypto.subtle.decrypt(AES-CBC) enforces PKCS#7, so
 * we use a "fake last block" trick to make the padding check pass while keeping
 * the real plaintext intact.
 */
import * as XLSX from 'xlsx'

// Block keys defined in ECMA-376 §2.3.4.11
const BLOCK_KEY_KEY_VALUE = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6])

// ── Typed-array helpers ────────────────────────────────────────────────────

/** Create a fresh Uint8Array<ArrayBuffer> guaranteed not to share a SharedArrayBuffer. */
function freshU8(length: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(length))
}

/** Copy any typed array / ArrayBuffer into a fresh Uint8Array<ArrayBuffer>. */
function toU8(src: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const srcArr = src instanceof ArrayBuffer ? new Uint8Array(src) : src
  const out = freshU8(srcArr.length)
  out.set(srcArr)
  return out
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = freshU8(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

function u32LE(n: number): Uint8Array<ArrayBuffer> {
  const b = freshU8(4)
  b[0] = n & 0xff; b[1] = (n >> 8) & 0xff
  b[2] = (n >> 16) & 0xff; b[3] = (n >> 24) & 0xff
  return b
}

function readU64LE(bytes: Uint8Array): number {
  // Low 32 bits only — sufficient for files up to 4 GB
  return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0
}

function b64ToU8(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const out = freshU8(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function strToUtf16LE(str: string): Uint8Array<ArrayBuffer> {
  const out = freshU8(str.length * 2)
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    out[i * 2] = c & 0xff
    out[i * 2 + 1] = (c >> 8) & 0xff
  }
  return out
}

function normalizeHash(name: string): string {
  const map: Record<string, string> = {
    SHA512: 'SHA-512', SHA256: 'SHA-256', SHA1: 'SHA-1',
    'SHA-512': 'SHA-512', 'SHA-256': 'SHA-256', 'SHA-1': 'SHA-1',
  }
  return map[name] ?? name
}

// ── Raw AES-CBC (no PKCS#7 check) ─────────────────────────────────────────

/**
 * Decrypt `ciphertext` with AES-CBC without PKCS#7 padding validation.
 *
 * ECMA-376 uses zero-padding, not PKCS#7.  crypto.subtle enforces PKCS#7 and
 * will throw if the last byte doesn't look like valid padding.  Work-around:
 * compute a synthetic last block whose decryption produces exactly 16 bytes of
 * 0x10, which IS valid PKCS#7.  After removal the result is the real plaintext.
 */
async function aesCbcDecryptRaw(
  ciphertext: Uint8Array<ArrayBuffer>,
  key: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>,
  blockSize: number = 16,
): Promise<Uint8Array<ArrayBuffer>> {
  const aesKey = await crypto.subtle.importKey(
    'raw', key, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']
  )

  // We want: AES_D(fakeBlock) XOR lastCipherBlock = [0x10 * blockSize]
  //   => AES_D(fakeBlock) = lastCipherBlock XOR pkcs7
  //   => fakeBlock = AES_E(lastCipherBlock XOR pkcs7)  (single-block, zero IV)
  const last = ciphertext.slice(ciphertext.length - blockSize)
  const pkcs7 = freshU8(blockSize).fill(blockSize)
  const toEnc = freshU8(blockSize)
  for (let i = 0; i < blockSize; i++) toEnc[i] = last[i] ^ pkcs7[i]

  const zeroIV = freshU8(blockSize)  // all zeros
  // Encrypting one block with AES-CBC zero-IV gives 32 bytes (PKCS#7 adds a block).
  // First 16 bytes = AES_K_E(toEnc), which is our fakeBlock.
  const encOut = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-CBC', iv: zeroIV }, aesKey, toEnc)
  )
  const fakeBlock = toU8(encOut.slice(0, blockSize))

  // Extended ciphertext: real data + fakeBlock
  const extended = concat(ciphertext, fakeBlock)

  // Decrypt — the fakeBlock decrypts to valid 0x10*16 PKCS#7, which is removed.
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, aesKey, extended)

  // Result length == ciphertext.length (the fake PKCS#7 block was stripped)
  return toU8(decrypted)
}

// ── Key derivation ─────────────────────────────────────────────────────────

async function deriveKey(
  iteratedHash: ArrayBuffer,
  blockKey: Uint8Array<ArrayBuffer>,
  hashAlg: string,
  keyByteLen: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const raw = new Uint8Array(
    await crypto.subtle.digest(hashAlg, concat(toU8(iteratedHash), blockKey))
  )
  // Stretch or truncate to required length
  const key = freshU8(keyByteLen)
  for (let i = 0; i < keyByteLen; i++) key[i] = raw[i % raw.length]
  return key
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Decrypt any OLE-encrypted Office file (docx, xlsx, etc.) using Agile Encryption.
 * Returns the raw decrypted ZIP bytes which can be passed directly to mammoth / SheetJS.
 */
export async function decryptOleFile(file: File, password: string): Promise<ArrayBuffer> {
  const fileBytes = toU8(await file.arrayBuffer())

  // SheetJS ships the CFB module as XLSX.CFB (not in TS types but present at runtime)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CFB = (XLSX as any).CFB
  const cfb = CFB.read(fileBytes, { type: 'array' })

  const encInfoEntry  = CFB.find(cfb, 'EncryptionInfo')
  const encPkgEntry   = CFB.find(cfb, 'EncryptedPackage')

  if (!encInfoEntry || !encPkgEntry) {
    throw new Error('File does not appear to be an encrypted Office document')
  }

  const encInfo  = toU8(encInfoEntry.content)
  const encPkg   = toU8(encPkgEntry.content)

  // Agile Encryption = version major 4, minor 4
  const vMajor = encInfo[0] | (encInfo[1] << 8)
  const vMinor = encInfo[2] | (encInfo[3] << 8)

  if (vMajor !== 4 || vMinor !== 4) {
    throw new Error(
      `"${file.name}" uses Standard Encryption (pre-Office 2010). ` +
      `Open it in Word, save again, then re-upload.`
    )
  }

  // XML starts at byte 8 (4-byte version + 4-byte reserved)
  const xml = new DOMParser().parseFromString(
    new TextDecoder().decode(encInfo.slice(8)),
    'text/xml'
  )

  // keyData — parameters for EncryptedPackage segment decryption
  const kd        = xml.querySelector('keyData')!
  const kdSalt     = b64ToU8(kd.getAttribute('saltValue')!)
  const kdBlockSz  = parseInt(kd.getAttribute('blockSize')!)
  const kdKeyBits  = parseInt(kd.getAttribute('keyBits')!)
  const kdHash     = normalizeHash(kd.getAttribute('hashAlgorithm')!)

  // encryptedKey — password-based key derivation parameters
  const ek          = xml.querySelector('[spinCount]')!
  const ekSalt      = b64ToU8(ek.getAttribute('saltValue')!)
  const ekSpinCount = parseInt(ek.getAttribute('spinCount')!)
  const ekKeyBits   = parseInt(ek.getAttribute('keyBits')!)
  const ekBlockSz   = parseInt(ek.getAttribute('blockSize')!)
  const ekHash      = normalizeHash(ek.getAttribute('hashAlgorithm')!)
  const ekEncKeyVal = b64ToU8(ek.getAttribute('encryptedKeyValue')!)

  // ── 1. Derive intermediate hash from password (PBKDF1-style spin) ────────
  const pwBytes = strToUtf16LE(password)
  let h: ArrayBuffer = await crypto.subtle.digest(ekHash, concat(ekSalt, pwBytes))

  for (let i = 0; i < ekSpinCount; i++) {
    h = await crypto.subtle.digest(ekHash, concat(u32LE(i), toU8(h)))
  }

  // ── 2. Decrypt the file encryption key (raw AES-CBC, no PKCS#7) ──────────
  const keyEncKey = await deriveKey(h, BLOCK_KEY_KEY_VALUE, ekHash, ekKeyBits / 8)
  const fileKey   = (await aesCbcDecryptRaw(
    ekEncKeyVal,
    keyEncKey,
    toU8(ekSalt.slice(0, ekBlockSz)),
    ekBlockSz,
  )).slice(0, kdKeyBits / 8)

  // ── 3. Decrypt EncryptedPackage in 4096-byte segments ────────────────────
  const originalSize = readU64LE(encPkg)   // uint64 LE at bytes 0–7
  const encrypted    = toU8(encPkg.slice(8))
  const SEGMENT      = 4096
  const numSegments  = Math.ceil(encrypted.length / SEGMENT)
  const parts: Uint8Array<ArrayBuffer>[] = []

  for (let i = 0; i < numSegments; i++) {
    const start   = i * SEGMENT
    const end     = Math.min(start + SEGMENT, encrypted.length)
    const segData = toU8(encrypted.slice(start, end))

    // Pad ciphertext segment to block boundary (spec §2.3.4.6: zero-pad before encryption)
    const padLen  = Math.ceil(segData.length / kdBlockSz) * kdBlockSz
    const padded  = freshU8(padLen)
    padded.set(segData)

    // IV = Hash(kdSalt || segIndex_LE32)[0..blockSize-1]
    const ivHash = await crypto.subtle.digest(kdHash, concat(kdSalt, u32LE(i)))
    const iv     = toU8(new Uint8Array(ivHash).slice(0, kdBlockSz))

    const dec = await aesCbcDecryptRaw(padded, toU8(fileKey), iv, kdBlockSz)
    parts.push(dec)
  }

  // Concatenate and trim to original unencrypted size
  const total  = parts.reduce((s, p) => s + p.length, 0)
  const result = freshU8(total)
  let offset   = 0
  for (const p of parts) { result.set(p, offset); offset += p.length }

  return result.slice(0, originalSize).buffer as ArrayBuffer
}

/** Backward-compat alias used by parser.ts */
export const decryptDocx = decryptOleFile
