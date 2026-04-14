import * as XLSX from 'xlsx'
import type { Batch, UTREntry } from '@/types/utr'

export interface ApprovalRow {
  no: number
  utrNumber: string
  userCount: number
  tipologi: string
  criminalIndication: string
  escalationLetter: string
  beneficiary: string
  transactionCount: number
  transactionAmount: number
  decision: string
}

export function buildApprovalRows(entries: UTREntry[]): ApprovalRow[] {
  return entries.map((e, idx) => ({
    no: idx + 1,
    utrNumber: e.utrNumber,
    userCount: 1,
    tipologi: e.tipologi || '-',
    criminalIndication: e.criminalAssociation || '-',
    escalationLetter: e.escalationLetterNo ?? '-',
    beneficiary: e.beneficiary || '-',
    transactionCount: e.transactionCount,
    transactionAmount: e.transactionAmount,
    decision: e.decision === 'REPORT' ? 'Report' : 'Non-Report'
  }))
}

export function generateApprovalExcel(batch: Batch): Blob {
  const rows = buildApprovalRows(batch.entries)

  const headers = [
    'No',
    'UTR Number',
    'User Count',
    'Tipologi',
    'Criminal Indication',
    'No. Surat Eskalasi',
    'Beneficiary',
    'Transaction Count',
    'Transaction Amount (IDR)',
    'Decision'
  ]

  const sheetData = [
    [`STR Approval — ${batch.batchNumber}`],
    [`Reporting Period: ${batch.reportingPeriod}`],
    [`Generated: ${new Date().toLocaleString('id-ID')}`],
    [],
    headers,
    ...rows.map((r) => [
      r.no,
      r.utrNumber,
      r.userCount,
      r.tipologi,
      r.criminalIndication,
      r.escalationLetter,
      r.beneficiary,
      r.transactionCount,
      r.transactionAmount,
      r.decision
    ])
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 20 },
    { wch: 10 },
    { wch: 22 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
    { wch: 15 },
    { wch: 18 },
    { wch: 12 }
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Approval')

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
}

export function generateApprovalEmailBody(batch: Batch): {
  subject: string
  body: string
} {
  const reportCount = batch.entries.filter((e) => e.decision === 'REPORT').length
  const nonReportCount = batch.entries.filter((e) => e.decision === 'NON_REPORT').length
  const [monthName, year] = batch.reportingPeriod.split(' ')
  const batchNum = batch.batchNumber.split('-').pop()

  const subject = `STR APPROVAL - (${monthName.toUpperCase()} ${year}) BATCH ${batchNum}`

  const body = [
    `Dear Bapak/Ibu,`,
    ``,
    `Bersama ini kami mengajukan permohonan persetujuan atas pelaporan LTKM kepada PPATK untuk periode ${batch.reportingPeriod}, Batch ${batchNum}.`,
    ``,
    `Pada batch ini terdapat ${batch.entries.length} UTR:`,
    `- ${reportCount} UTR diajukan sebagai LTKM (Report)`,
    `- ${nonReportCount} UTR tidak memenuhi kriteria matriks TKM (Non-Report)`,
    ``,
    `Terlampir tabel rekapitulasi untuk review. Mohon persetujuannya agar proses pelaporan dapat dilanjutkan sesuai SLA yang berlaku.`,
    ``,
    `Terima kasih atas perhatian Bapak/Ibu.`,
    ``,
    `Hormat kami,`,
    `FCC Team`
  ].join('\n')

  return { subject, body }
}
