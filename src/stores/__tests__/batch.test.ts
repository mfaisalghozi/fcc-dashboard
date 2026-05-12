import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBatchStore } from '@/stores/batch'
import type { UTREntry } from '@/types/utr'

function makeEntry(overrides: Partial<UTREntry> = {}): UTREntry {
  return {
    id: crypto.randomUUID(),
    utrNumber: 'UTR-2026-000001',
    status: 'PENDING_REVIEW',
    decision: null,
    batchId: null,
    userName: 'Budi Santoso',
    cif: 'CIF001',
    accountId: 'ACC001',
    beneficiary: 'Dana Indonesia',
    tipologi: 'Profile deviation',
    criminalAssociation: 'TPPU',
    transactionCount: 10,
    transactionAmount: 5000000,
    escalationDate: new Date().toISOString(),
    escalationSource: 'EMAIL',
    sourceFiles: [],
    fccPic: 'FCC Team',
    ...overrides
  }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useBatchStore — addEntry', () => {
  it('adds an entry to the current batch', () => {
    const store = useBatchStore()
    const entry = makeEntry()
    store.addEntry(entry)
    expect(store.currentBatch.entries).toHaveLength(1)
  })

  it('sets the entry batchId to the current batch id', () => {
    const store = useBatchStore()
    const entry = makeEntry({ batchId: null })
    store.addEntry(entry)
    expect(store.currentBatch.entries[0].batchId).toBe(store.currentBatch.id)
  })
})

describe('useBatchStore — updateEntry', () => {
  it('merges updates onto the matching entry', () => {
    const store = useBatchStore()
    const entry = makeEntry({ id: 'fixed-id', decision: null })
    store.addEntry(entry)
    store.updateEntry('fixed-id', { decision: 'REPORT' })
    expect(store.currentBatch.entries[0].decision).toBe('REPORT')
  })

  it('does not change other fields when partially updating', () => {
    const store = useBatchStore()
    const entry = makeEntry({ id: 'fixed-id', tipologi: 'Profile deviation' })
    store.addEntry(entry)
    store.updateEntry('fixed-id', { decision: 'REPORT' })
    expect(store.currentBatch.entries[0].tipologi).toBe('Profile deviation')
  })

  it('ignores an unknown id without throwing', () => {
    const store = useBatchStore()
    expect(() => store.updateEntry('non-existent', { decision: 'REPORT' })).not.toThrow()
  })
})

describe('useBatchStore — removeEntry', () => {
  it('removes the entry with the given id', () => {
    const store = useBatchStore()
    const e1 = makeEntry({ id: 'keep-me' })
    const e2 = makeEntry({ id: 'remove-me' })
    store.addEntry(e1)
    store.addEntry(e2)
    store.removeEntry('remove-me')
    expect(store.currentBatch.entries.map((e) => e.id)).toEqual(['keep-me'])
  })

  it('leaves the list unchanged when id is not found', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ id: 'keep-me' }))
    store.removeEntry('ghost')
    expect(store.currentBatch.entries).toHaveLength(1)
  })
})

describe('useBatchStore — confirmEntry', () => {
  it('sets the entry status to CONFIRMED', () => {
    const store = useBatchStore()
    const entry = makeEntry({ id: 'fixed-id' })
    store.addEntry(entry)
    store.confirmEntry('fixed-id', { decision: 'REPORT' })
    expect(store.currentBatch.entries[0].status).toBe('CONFIRMED')
  })

  it('stamps confirmedAt as an ISO date string', () => {
    const store = useBatchStore()
    const entry = makeEntry({ id: 'fixed-id' })
    store.addEntry(entry)
    store.confirmEntry('fixed-id', {})
    expect(store.currentBatch.entries[0].confirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('merges the supplied updates along with the status change', () => {
    const store = useBatchStore()
    const entry = makeEntry({ id: 'fixed-id', decision: null })
    store.addEntry(entry)
    store.confirmEntry('fixed-id', { decision: 'NON_REPORT' })
    expect(store.currentBatch.entries[0].decision).toBe('NON_REPORT')
  })
})

describe('useBatchStore — closeBatch', () => {
  it('throws when the batch has no entries', () => {
    const store = useBatchStore()
    expect(() => store.closeBatch()).toThrow('Batch cannot be closed yet')
  })

  it('throws when any entry still has null decision', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ status: 'CONFIRMED', decision: null }))
    expect(() => store.closeBatch()).toThrow('Batch cannot be closed yet')
  })

  it('throws when any entry is still EXTRACTING', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ status: 'EXTRACTING', decision: 'REPORT' }))
    expect(() => store.closeBatch()).toThrow('Batch cannot be closed yet')
  })

  it('sets batch status to CLOSED on success', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ status: 'CONFIRMED', decision: 'REPORT' }))
    store.closeBatch()
    expect(store.currentBatch.status).toBe('CLOSED')
  })

  it('stamps closedAt on success', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ status: 'CONFIRMED', decision: 'REPORT' }))
    store.closeBatch()
    expect(store.currentBatch.closedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('removes the persisted batch number key from localStorage on close', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ status: 'CONFIRMED', decision: 'REPORT' }))
    store.closeBatch()
    expect(localStorage.getItem('current-batch-number')).toBeNull()
  })
})

describe('useBatchStore — computed: reportCount', () => {
  it('counts entries with REPORT decision', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ decision: 'REPORT' }))
    store.addEntry(makeEntry({ decision: 'REPORT' }))
    store.addEntry(makeEntry({ decision: 'NON_REPORT' }))
    expect(store.reportCount).toBe(2)
  })

  it('returns 0 when no entries have REPORT decision', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ decision: 'NON_REPORT' }))
    expect(store.reportCount).toBe(0)
  })
})

describe('useBatchStore — computed: nonReportCount', () => {
  it('counts entries with NON_REPORT decision', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ decision: 'NON_REPORT' }))
    store.addEntry(makeEntry({ decision: 'REPORT' }))
    expect(store.nonReportCount).toBe(1)
  })
})

describe('useBatchStore — computed: totalNominal', () => {
  it('sums the transactionAmount across all entries', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ transactionAmount: 1000000 }))
    store.addEntry(makeEntry({ transactionAmount: 2500000 }))
    expect(store.totalNominal).toBe(3500000)
  })

  it('returns 0 when there are no entries', () => {
    const store = useBatchStore()
    expect(store.totalNominal).toBe(0)
  })
})

describe('useBatchStore — computed: canClose', () => {
  it('is false when the batch is empty', () => {
    const store = useBatchStore()
    expect(store.canClose).toBe(false)
  })

  it('is false when any entry is EXTRACTING', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ status: 'EXTRACTING', decision: 'REPORT' }))
    expect(store.canClose).toBe(false)
  })

  it('is false when any entry has a null decision', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ status: 'CONFIRMED', decision: null }))
    expect(store.canClose).toBe(false)
  })

  it('is true when all entries have a non-null decision and are not EXTRACTING', () => {
    const store = useBatchStore()
    store.addEntry(makeEntry({ status: 'CONFIRMED', decision: 'REPORT' }))
    store.addEntry(makeEntry({ status: 'CONFIRMED', decision: 'NON_REPORT' }))
    expect(store.canClose).toBe(true)
  })
})
