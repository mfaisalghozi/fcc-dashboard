import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Batch, UTREntry } from '@/types/utr'

function generateBatchNumber(): string {
  const now = new Date()
  const month = now.toLocaleString('en', { month: 'short' }).toUpperCase()
  const year = now.getFullYear()
  const existing = Number(localStorage.getItem(`batch-count-${year}-${month}`) ?? '0')
  const next = existing + 1
  localStorage.setItem(`batch-count-${year}-${month}`, String(next))
  return `BATCH-${year}-${month}-${String(next).padStart(2, '0')}`
}

export const useBatchStore = defineStore('batch', () => {
  const currentBatch = ref<Batch>({
    id: crypto.randomUUID(),
    batchNumber: generateBatchNumber(),
    reportingPeriod: new Date().toLocaleString('id-ID', {
      month: 'long',
      year: 'numeric'
    }),
    status: 'OPEN',
    entries: [],
    createdAt: new Date().toISOString()
  })

  const reportCount = computed(
    () => currentBatch.value.entries.filter((e) => e.decision === 'REPORT').length
  )

  const nonReportCount = computed(
    () => currentBatch.value.entries.filter((e) => e.decision === 'NON_REPORT').length
  )

  const totalNominal = computed(() =>
    currentBatch.value.entries.reduce((sum, e) => sum + (e.transactionAmount ?? 0), 0)
  )

  const oldestSLADays = computed(() => {
    if (currentBatch.value.entries.length === 0) return 0
    const now = Date.now()
    const oldest = Math.min(
      ...currentBatch.value.entries.map((e) => new Date(e.escalationDate).getTime())
    )
    return Math.floor((now - oldest) / (1000 * 60 * 60 * 24))
  })

  const canClose = computed(
    () =>
      currentBatch.value.entries.length > 0 &&
      currentBatch.value.entries.every(
        (e) => e.status !== 'EXTRACTING' && e.decision !== null
      )
  )

  function addEntry(entry: UTREntry) {
    entry.batchId = currentBatch.value.id
    currentBatch.value.entries.push(entry)
  }

  function updateEntry(id: string, updates: Partial<UTREntry>) {
    const idx = currentBatch.value.entries.findIndex((e) => e.id === id)
    if (idx >= 0) {
      currentBatch.value.entries[idx] = {
        ...currentBatch.value.entries[idx],
        ...updates
      }
    }
  }

  function removeEntry(id: string) {
    currentBatch.value.entries = currentBatch.value.entries.filter((e) => e.id !== id)
  }

  function confirmEntry(id: string, updates: Partial<UTREntry>) {
    updateEntry(id, {
      ...updates,
      status: 'CONFIRMED',
      confirmedAt: new Date().toISOString()
    })
  }

  function closeBatch() {
    if (!canClose.value) throw new Error('Batch cannot be closed yet')
    currentBatch.value.status = 'CLOSED'
    currentBatch.value.closedAt = new Date().toISOString()
  }

  return {
    currentBatch,
    reportCount,
    nonReportCount,
    totalNominal,
    oldestSLADays,
    canClose,
    addEntry,
    updateEntry,
    removeEntry,
    confirmEntry,
    closeBatch
  }
})
