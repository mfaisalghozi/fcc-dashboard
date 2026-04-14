import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import type { UTREntry, Transaction, FiveW2H } from '@/types/utr'

export class PasswordRequiredError extends Error {
  constructor(public lockedFiles: string[]) {
    super('Files are password-protected')
    this.name = 'PasswordRequiredError'
  }
}

function isPasswordError(err: unknown): boolean {
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
  async parseDocxAnalysis(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  async parseXlsxWorkingPaper(file: File, password?: string): Promise<Transaction[]> {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      ...(password !== undefined ? { password } : {})
    })
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

  async parseBundle(files: File[]): Promise<Partial<UTREntry>> {
    const docx = files.find((f) => f.name.endsWith('.docx'))
    const xlsx = files.find((f) => f.name.endsWith('.xlsx'))

    if (!docx) throw new Error('Missing .docx analysis document')
    if (!xlsx) throw new Error('Missing .xlsx working paper')

    const narrative = await this.parseDocxAnalysis(docx)
    const transactions = await this.parseXlsxWorkingPaper(xlsx)
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
}

export const parser = new UTRDocumentParser()
