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

function formatDateDDMMYYYY(isoDate: string): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function generateLogbookExcel(batch: Batch): Blob {
  const batchNum = parseInt(/(\d+)$/.exec(batch.batchNumber)?.[1] ?? '0', 10)

  const headers = [
    'Batch', 'Source', 'POV', 'No UTR', 'NAMA PENGGUNA', 'CIF', 'Login ID',
    'ISV', 'PERIODE', 'TYPOLOGY UTR', 'TPA', 'TPA Other', 'No. Surat', 'Note/Mark',
    'Beneficiary/entity', 'Tangal Eskalasi', 'Jumlah trx', 'Nominal Trx',
    'SLA Escalate to Approval', 'Approval', 'Send', 'SLA Approval to Send',
    'FCC PIC', 'Account Closure Status', '', '', ''
  ]

  type Row = (string | number)[]

  const dataRows: Row[] = batch.entries.map((entry): Row => {
    const isGrouped = !!entry.utrGroupId
    const trxCount = isGrouped && !entry.isGroupAnchor ? 0 : entry.transactionCount
    const trxAmount = isGrouped && !entry.isGroupAnchor ? 0 : entry.transactionAmount
    return [
      batchNum,
      entry.source ?? 'N/A',
      entry.pov ?? 'N/A',
      entry.utrNumber,
      entry.userName,
      entry.cif,
      entry.accountId,
      entry.isv ?? 'N/A',
      entry.periode ?? '',
      entry.typologyText ?? entry.tipologi,
      entry.tpa ?? entry.tipologi,
      entry.tpaOther ?? 'N/A',
      entry.noSurat ?? 'N/A',
      entry.noteMark ?? 'N/A',
      entry.beneficiary ?? 'N/A',
      formatDateDDMMYYYY(entry.escalationDate),
      trxCount,
      trxAmount,
      '', '', '', '',
      entry.fccPic,
      '',
      '',  // col Y — separator
      '',  // col Z — bank count (overlaid below)
      '',  // col AA — bank amount (overlaid below)
    ]
  })

  // Overlay per-bank breakdown in cols Z/AA (indices 25/26).
  // Offset = numBanks rows after the anchor (matching the Logbook_Example layout where
  // 4 banks means breakdown starts at anchor+4, TOTAL at anchor+8).
  const emptyRow = (): Row => new Array<string>(27).fill('')

  batch.entries.forEach((entry, anchorIdx) => {
    if (!entry.isGroupAnchor || !entry.perBankBreakdown) return
    const breakdown = entry.perBankBreakdown
    const startOffset = breakdown.length  // skip numBanks rows, then place breakdown

    breakdown.forEach((bank, offset) => {
      const targetIdx = anchorIdx + startOffset + offset
      while (dataRows.length <= targetIdx) dataRows.push(emptyRow())
      dataRows[targetIdx][25] = bank.count
      dataRows[targetIdx][26] = bank.amount
    })

    const totalIdx = anchorIdx + startOffset + breakdown.length
    while (dataRows.length <= totalIdx) dataRows.push(emptyRow())
    dataRows[totalIdx][25] = breakdown.reduce((s, b) => s + b.count, 0)
    dataRows[totalIdx][26] = breakdown.reduce((s, b) => s + b.amount, 0)
  })

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  worksheet['!cols'] = [
    { wch: 6 },  { wch: 8 },  { wch: 6 },  { wch: 28 }, { wch: 22 },
    { wch: 22 }, { wch: 18 }, { wch: 6 },  { wch: 10 }, { wch: 36 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 },
    { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 12 },
    { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 2 },
    { wch: 12 }, { wch: 16 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Logbook')
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
