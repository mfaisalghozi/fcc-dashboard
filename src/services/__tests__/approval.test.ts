import { describe, it, expect } from 'vitest'
import { buildApprovalRows, generateApprovalEmailBody } from '@/services/approval'
import type { UTREntry, Batch } from '@/types/utr'

function makeEntry(overrides: Partial<UTREntry> = {}): UTREntry {
  return {
    id: 'entry-1',
    utrNumber: 'UTR-2026-000001',
    status: 'BATCHED',
    decision: 'REPORT',
    batchId: 'batch-1',
    userName: 'Budi Santoso',
    cif: 'CIF001',
    accountId: 'ACC001',
    beneficiary: 'Dana Indonesia',
    tipologi: 'Profile deviation',
    criminalAssociation: 'TPPU',
    transactionCount: 10,
    transactionAmount: 5000000,
    escalationDate: '2026-04-01T00:00:00.000Z',
    escalationSource: 'EMAIL',
    escalationLetterNo: 'ESK/2026/001',
    sourceFiles: ['UTR-2026-000001-analysis.docx'],
    fccPic: 'FCC Reporter',
    ...overrides
  }
}

function makeBatch(entries: UTREntry[], overrides: Partial<Batch> = {}): Batch {
  return {
    id: 'batch-1',
    batchNumber: 'BATCH-2026-APR-01',
    reportingPeriod: 'April 2026',
    status: 'OPEN',
    entries,
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides
  }
}

describe('buildApprovalRows', () => {
  it('assigns sequential numbers starting from 1', () => {
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })]
    const rows = buildApprovalRows(entries)
    expect(rows[0].no).toBe(1)
    expect(rows[1].no).toBe(2)
  })

  it('maps REPORT decision to "Report"', () => {
    const rows = buildApprovalRows([makeEntry({ decision: 'REPORT' })])
    expect(rows[0].decision).toBe('Report')
  })

  it('maps NON_REPORT decision to "Non-Report"', () => {
    const rows = buildApprovalRows([makeEntry({ decision: 'NON_REPORT' })])
    expect(rows[0].decision).toBe('Non-Report')
  })

  it('uses "-" for missing tipologi', () => {
    const rows = buildApprovalRows([makeEntry({ tipologi: '' })])
    expect(rows[0].tipologi).toBe('-')
  })

  it('uses "-" for missing criminalAssociation', () => {
    const rows = buildApprovalRows([makeEntry({ criminalAssociation: '' })])
    expect(rows[0].criminalIndication).toBe('-')
  })

  it('uses "-" when escalationLetterNo is absent', () => {
    const entry = makeEntry()
    delete entry.escalationLetterNo
    const rows = buildApprovalRows([entry])
    expect(rows[0].escalationLetter).toBe('-')
  })

  it('uses "-" for missing beneficiary', () => {
    const rows = buildApprovalRows([makeEntry({ beneficiary: '' })])
    expect(rows[0].beneficiary).toBe('-')
  })

  it('passes through transaction count and amount', () => {
    const rows = buildApprovalRows([makeEntry({ transactionCount: 7, transactionAmount: 3500000 })])
    expect(rows[0].transactionCount).toBe(7)
    expect(rows[0].transactionAmount).toBe(3500000)
  })

  it('returns empty array for empty input', () => {
    expect(buildApprovalRows([])).toEqual([])
  })
})

describe('generateApprovalEmailBody', () => {
  it('produces subject in SOP format: STR APPROVAL - (MONTH YEAR) BATCH N', () => {
    const batch = makeBatch([makeEntry()])
    const { subject } = generateApprovalEmailBody(batch)
    expect(subject).toBe('STR APPROVAL - (APRIL 2026) BATCH 01')
  })

  it('uppercases the month name in the subject', () => {
    const batch = makeBatch([], { batchNumber: 'BATCH-2026-JAN-03', reportingPeriod: 'January 2026' })
    const { subject } = generateApprovalEmailBody(batch)
    expect(subject).toContain('JANUARY')
  })

  it('extracts the last segment of batchNumber as the batch number in subject', () => {
    const batch = makeBatch([], { batchNumber: 'BATCH-2026-APR-05', reportingPeriod: 'April 2026' })
    const { subject } = generateApprovalEmailBody(batch)
    expect(subject).toContain('BATCH 05')
  })

  it('body includes the count of REPORT entries', () => {
    const entries = [
      makeEntry({ id: 'e1', decision: 'REPORT' }),
      makeEntry({ id: 'e2', decision: 'REPORT' }),
      makeEntry({ id: 'e3', decision: 'NON_REPORT' })
    ]
    const { body } = generateApprovalEmailBody(makeBatch(entries))
    expect(body).toContain('2 UTR diajukan sebagai LTKM (Report)')
  })

  it('body includes the count of NON_REPORT entries', () => {
    const entries = [
      makeEntry({ id: 'e1', decision: 'REPORT' }),
      makeEntry({ id: 'e2', decision: 'NON_REPORT' })
    ]
    const { body } = generateApprovalEmailBody(makeBatch(entries))
    expect(body).toContain('1 UTR tidak memenuhi kriteria matriks TKM (Non-Report)')
  })

  it('body includes the reporting period', () => {
    const batch = makeBatch([makeEntry()], { reportingPeriod: 'Maret 2026' })
    const { body } = generateApprovalEmailBody(batch)
    expect(body).toContain('Maret 2026')
  })

  it('body starts with a greeting', () => {
    const { body } = generateApprovalEmailBody(makeBatch([makeEntry()]))
    expect(body).toContain('Dear Bapak/Ibu')
  })
})
