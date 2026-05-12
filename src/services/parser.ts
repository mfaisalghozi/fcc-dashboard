import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import type { UTREntry, Transaction, FiveW2H } from '@/types/utr'
import { decryptDocx, decryptOleFile } from '@/services/docxDecryptor'

export class PasswordRequiredError extends Error {
  constructor(public lockedFiles: string[]) {
    super('Files are password-protected')
    this.name = 'PasswordRequiredError'
  }
}

function isPasswordError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) return true
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return msg.includes('password') || msg.includes('encrypted') || msg.includes('cfb')
}

async function isOleFile(file: File): Promise<boolean> {
  const buf = await file.slice(0, 8).arrayBuffer()
  const bytes = new Uint8Array(buf)
  // Full OLE2 Compound File Binary magic bytes: D0 CF 11 E0 A1 B1 1A E1
  return (
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1
  )
}

export class UTRDocumentParser {
  async parseDocxAnalysis(file: File, password?: string): Promise<string> {
    const arrayBuffer = password ? await decryptDocx(file, password) : await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  async parseXlsxWorkingPaper(file: File, password?: string): Promise<Transaction[]> {
    // If the file is OLE-encrypted, decrypt it ourselves (same algorithm as docx)
    // then hand the raw ZIP bytes to SheetJS — no SheetJS password handling needed.
    const arrayBuffer = (password !== undefined && await isOleFile(file))
      ? await decryptOleFile(file, password)
      : await file.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    return rows.map((row): Transaction => ({
      number: String(row['Transaction Number'] ?? row['No'] ?? ''),
      date: String(row['Date'] ?? row['Tanggal'] ?? ''),
      amount: Number(row['Amount'] ?? row['Nilai'] ?? 0),
      method: String(row['Method'] ?? row['Cara'] ?? ''),
      origin: String(row['Origin'] ?? row['Asal'] ?? ''),
      destination: String(row['Destination'] ?? row['Tujuan'] ?? '')
    }))
  }

  extractUTRMetadata(filename: string, narrative: string): {
    utrNumber: string
    userName: string
  } {
    const utrMatch =
      filename.match(/UTR[-_](\d{4})[-_]?(\d+)/i) ??
      narrative.match(/UTR[-\s]?(\d{4})[-\s]?(\d+)/i)
    const utrNumber = utrMatch
      ? `UTR-${utrMatch[1]}-${utrMatch[2].padStart(6, '0')}`
      : `UTR-UNKNOWN-${Date.now()}`

    const nameMatch = narrative.match(/Nama[:\s]+([A-Z][a-zA-Z\s]+?)(?:\n|,|\.|CIF)/)
    const userName = nameMatch ? nameMatch[1].trim() : 'Unknown User'

    return { utrNumber, userName }
  }

  async parseBundle(files: File[], passwords?: Record<string, string>): Promise<Partial<UTREntry>> {
    const docx = files.find((f) => f.name.endsWith('.docx'))
    const xlsx = files.find((f) => f.name.endsWith('.xlsx'))

    if (!docx) throw new Error('Missing .docx analysis document')
    if (!xlsx) throw new Error('Missing .xlsx working paper')

    const lockedFiles: string[] = []

    // Detect encrypted .docx (OLE2 format)
    const docxIsOle = await isOleFile(docx)
    if (docxIsOle) {
      const docxPassword = passwords?.[docx.name]
      if (docxPassword !== undefined) {
        // Retry case: attempt client-side decryption
        try {
          await decryptDocx(docx, docxPassword) // validate password works before continuing
        } catch (err) {
          // DOMException from Web Crypto (empty message on some browsers) = wrong password
          const isDomException = typeof DOMException !== 'undefined' && err instanceof DOMException
          const msg = err instanceof Error ? err.message : ''
          throw new Error(
            isDomException || isPasswordError(err) || !msg
              ? `Incorrect password for "${docx.name}"`
              : `Cannot open "${docx.name}": ${msg}`
          )
        }
      } else {
        lockedFiles.push(docx.name)
      }
    }

    // Try .xlsx with optional password
    let transactions: Transaction[] = []
    try {
      transactions = await this.parseXlsxWorkingPaper(xlsx, passwords?.[xlsx.name])
    } catch (err) {
      if (isPasswordError(err)) {
        if (passwords?.[xlsx.name] !== undefined) {
          // Retry case: password was provided but still failed — wrong password
          throw new Error(`Incorrect password for "${xlsx.name}"`)
        }
        lockedFiles.push(xlsx.name)
      } else {
        throw err
      }
    }

    // Surface all locked files in one error so the modal can list them
    if (lockedFiles.length > 0) throw new PasswordRequiredError(lockedFiles)

    // Both files are accessible — proceed with full parse
    const narrative = await this.parseDocxAnalysis(docx, passwords?.[docx.name])
    const { utrNumber, userName } = this.extractUTRMetadata(docx.name, narrative)
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)

    return {
      utrNumber,
      userName,
      transactions,
      transactionCount: transactions.length,
      transactionAmount: totalAmount,
      sourceFiles: files.map((f) => f.name),
      escalationDate: new Date().toISOString(),
      escalationSource: 'EMAIL'
    }
  }

  async parseRiskNotesBundle(files: File[], passwords?: Record<string, string>): Promise<UTREntry[]> {
    // 3a. Classify files
    const docxFile = files.find(f => /\.docx$/i.test(f.name))
    const profileXlsx = files.find(f => f.name.toLowerCase().includes('profil_pengguna_jasa'))
    const bankXlsxFiles = files.filter(f =>
      /\.xlsx$/i.test(f.name) && !f.name.toLowerCase().includes('profil_pengguna_jasa')
    )

    if (!docxFile) throw new Error('Missing RISK_NOTES .docx analysis document')
    if (!profileXlsx) throw new Error('Missing Profil_Pengguna_Jasa.xlsx')

    // 3b. Detect locked files (OLE-encrypted without password)
    const lockedFiles: string[] = []
    for (const file of [docxFile, profileXlsx, ...bankXlsxFiles]) {
      if (await isOleFile(file) && passwords?.[file.name] === undefined) {
        lockedFiles.push(file.name)
      }
    }
    if (lockedFiles.length > 0) throw new PasswordRequiredError(lockedFiles)

    const getBuffer = async (file: File): Promise<ArrayBuffer> => {
      if (await isOleFile(file)) {
        try {
          return await decryptOleFile(file, passwords![file.name])
        } catch (err) {
          const isDomException = typeof DOMException !== 'undefined' && err instanceof DOMException
          const msg = err instanceof Error ? err.message : ''
          throw new Error(
            isDomException || isPasswordError(err) || !msg
              ? `Incorrect password for "${file.name}"`
              : `Cannot open "${file.name}": ${msg}`
          )
        }
      }
      return file.arrayBuffer()
    }

    // 3c. Parse RISK_NOTES docx
    const docxBuf = await getBuffer(docxFile)
    const narrative = (await mammoth.extractRawText({ arrayBuffer: docxBuf })).value

    const utrNumber = docxFile.name
      .replace(/\.docx$/i, '')
      .replace(/\s*\(\d+\)$/, '')
      .replace(/_/g, ' ')

    const romanMatch = utrNumber.match(/\.UTR\.([IVX]+)\./i)
    const ROMAN_TO_MONTH: Record<string, string> = {
      I: 'January', II: 'February', III: 'March', IV: 'April',
      V: 'May', VI: 'June', VII: 'July', VIII: 'August',
      IX: 'September', X: 'October', XI: 'November', XII: 'December'
    }
    const periode = romanMatch ? (ROMAN_TO_MONTH[romanMatch[1].toUpperCase()] ?? '') : ''

    const TYPOLOGY_PHRASES = [
      'Structuring', 'Online Gambling Indicated', 'Profile Deviation',
      'Proceeds of Crime', 'Terrorism Financing', 'WMD Proliferation'
    ]
    const headingIdx = narrative.toLowerCase().indexOf('kesimpulan hasil investigasi')
    const searchText = headingIdx >= 0 ? narrative.slice(headingIdx) : narrative
    const typologyText = TYPOLOGY_PHRASES.filter(phrase =>
      searchText.toLowerCase().includes(phrase.toLowerCase())
    ).join(', ')

    const tpaLower = typologyText.toLowerCase()
    const tpa = tpaLower.includes('gambling') || tpaLower.includes('judi') ? 'PERJUDIAN'
      : tpaLower.includes('fraud') || tpaLower.includes('penipuan') ? 'PENIPUAN'
      : tpaLower.includes('terrorism') || tpaLower.includes('teror') ? 'TERORISME'
      : tpaLower.includes('structuring') || tpaLower.includes('smurfing') ? 'STRUKTURAL'
      : 'TPPU'

    // 3d. Parse profile xlsx (sheet 'Profile', rows 2-N, cols: Name, CIF, Login ID)
    const profileBuf = await getBuffer(profileXlsx)
    const profileWb = XLSX.read(new Uint8Array(profileBuf), { type: 'array' })
    const profileSheetName =
      profileWb.SheetNames.find(n => n.toLowerCase() === 'profile') ?? profileWb.SheetNames[0]
    const profileRows = XLSX.utils.sheet_to_json<unknown[]>(
      profileWb.Sheets[profileSheetName], { header: 1, defval: '' }
    )

    const subjects = (profileRows.slice(1) as unknown[][]).map(row => ({
      name: String(row[0] ?? '').trim(),
      cif: String(row[1] ?? '').trim(),
      loginId: String(row[2] ?? '').trim()
    })).filter(s => s.cif)

    if (subjects.length === 0) throw new Error('No subjects found in Profil_Pengguna_Jasa')

    const cifSet = new Set(subjects.map(s => s.cif))

    // 3e. Parse bank xlsxs (sheet 'Non Pay Merchant Outgoing', actor_role_id=col 1, amount=col 13)
    const KNOWN_BANKS = ['BCA', 'BNI', 'BRI', 'Permata']
    const perBankBreakdown: Array<{ bank: string; count: number; amount: number }> = []

    for (const bankFile of bankXlsxFiles) {
      const bankName = KNOWN_BANKS.find(b =>
        bankFile.name.toLowerCase().includes(b.toLowerCase())
      )
      if (!bankName) {
        throw new Error(
          `Unknown bank in "${bankFile.name}". Expected one of: ${KNOWN_BANKS.join(', ')}.`
        )
      }

      const bankBuf = await getBuffer(bankFile)
      const bankWb = XLSX.read(new Uint8Array(bankBuf), { type: 'array' })
      const bankSheetName =
        bankWb.SheetNames.find(n => n === 'Non Pay Merchant Outgoing') ?? bankWb.SheetNames[0]
      const bankRows = XLSX.utils.sheet_to_json<unknown[]>(
        bankWb.Sheets[bankSheetName], { header: 1, defval: '' }
      )

      let count = 0
      let amount = 0
      for (const row of (bankRows.slice(1) as unknown[][])) {
        if (cifSet.has(String(row[1] ?? '').trim())) {
          count++
          amount += Number(row[13] ?? 0)
        }
      }
      perBankBreakdown.push({ bank: bankName, count, amount })
    }

    perBankBreakdown.sort((a, b) => KNOWN_BANKS.indexOf(a.bank) - KNOWN_BANKS.indexOf(b.bank))

    const totalCount = perBankBreakdown.reduce((s, b) => s + b.count, 0)
    const totalAmount = perBankBreakdown.reduce((s, b) => s + b.amount, 0)

    // 3f. Build UTREntry[] — one per subject
    const utrGroupId = crypto.randomUUID()
    const sourceFiles = files.map(f => f.name)

    return subjects.map((subject, idx): UTREntry => ({
      id: crypto.randomUUID(),
      utrNumber,
      status: 'PENDING_REVIEW',
      decision: 'REPORT',
      batchId: null,
      userName: subject.name,
      cif: subject.cif,
      accountId: subject.loginId,
      beneficiary: 'N/A',
      tipologi: typologyText || tpa,
      criminalAssociation: '',
      transactionCount: idx === 0 ? totalCount : 0,
      transactionAmount: idx === 0 ? totalAmount : 0,
      escalationDate: new Date().toISOString(),
      escalationSource: 'EMAIL',
      sourceFiles,
      fccPic: '',
      source: 'Risk',
      pov: 'User',
      isv: 'N/A',
      periode,
      typologyText,
      tpa,
      tpaOther: 'N/A',
      noSurat: 'N/A',
      noteMark: 'N/A',
      utrGroupId,
      isGroupAnchor: idx === 0,
      perBankBreakdown: idx === 0 ? perBankBreakdown : undefined,
    }))
  }
}

export const parser = new UTRDocumentParser()
