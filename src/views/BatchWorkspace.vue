<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import FileUploader from '@/components/FileUploader.vue'
import EntryList from '@/components/EntryList.vue'
import ReviewModal from '@/components/ReviewModal.vue'
import { useBatchStore } from '@/stores/batch'
import { parser } from '@/services/parser'
import { InvestigationAgent } from '@/services/investigation'
import {
  generateApprovalExcel,
  generateApprovalEmailBody
} from '@/services/approval'
import type { UTREntry } from '@/types/utr'

const router = useRouter()
const batchStore = useBatchStore()
const { currentBatch, reportCount, totalNominal, oldestSLADays, canClose } =
  storeToRefs(batchStore)

const reviewEntry = ref<UTREntry | null>(null)

function handleReviewOpen(entry: UTREntry) {
  reviewEntry.value = entry
}

function handleReviewClose() {
  reviewEntry.value = null
}

function handleReviewConfirm(updates: Partial<UTREntry>) {
  if (reviewEntry.value) {
    batchStore.confirmEntry(reviewEntry.value.id, updates)
    reviewEntry.value = null
  }
}

const processing = ref(false)
const errorMsg = ref<string | null>(null)

const agent = new InvestigationAgent(import.meta.env.VITE_ANTHROPIC_API_KEY ?? '')

const slaStatus = computed(() => {
  if (oldestSLADays.value === 0) return null
  if (oldestSLADays.value >= 2) return 'warn'
  return 'ok'
})

function formatIDR(amount: number): string {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}M`
  return `Rp ${amount.toLocaleString('id-ID')}`
}

async function handleBundle(files: File[]) {
  processing.value = true
  errorMsg.value = null

  const entryId = crypto.randomUUID()
  const placeholder: UTREntry = {
    id: entryId,
    utrNumber: 'Extracting...',
    status: 'EXTRACTING',
    decision: null,
    batchId: null,
    userName: 'Processing...',
    cif: '',
    accountId: '',
    beneficiary: '',
    tipologi: '',
    criminalAssociation: '',
    transactionCount: 0,
    transactionAmount: 0,
    escalationDate: new Date().toISOString(),
    escalationSource: 'EMAIL',
    sourceFiles: files.map((f) => f.name),
    fccPic: 'Current User'
  }
  batchStore.addEntry(placeholder)

  try {
    const parsed = await parser.parseBundle(files)
    const narrativeFile = files.find((f) => f.name.endsWith('.docx'))!
    const narrative = await parser.parseDocxAnalysis(narrativeFile)

    const investigation = await agent.investigate(
      narrative,
      parsed.transactions ?? [],
      parsed.userName ?? 'Unknown'
    )

    batchStore.updateEntry(entryId, {
      ...parsed,
      status: 'PENDING_REVIEW',
      fiveW2H: investigation.fiveW2H,
      tipologi: investigation.tipologi,
      criminalAssociation: investigation.criminalAssociation,
      decision: investigation.decision,
      beneficiary: investigation.fiveW2H.who.name
    } as Partial<UTREntry>)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    errorMsg.value = `Failed to process bundle: ${message}`
    batchStore.removeEntry(entryId)
  } finally {
    processing.value = false
  }
}


function handleCloseBatch() {
  if (!canClose.value) return

  batchStore.closeBatch()

  const excelBlob = generateApprovalExcel(currentBatch.value)
  const { subject, body } = generateApprovalEmailBody(currentBatch.value)

  const url = URL.createObjectURL(excelBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${currentBatch.value.batchNumber}_approval.xlsx`
  link.click()
  URL.revokeObjectURL(url)

  const mailto = `mailto:pejabat.apuppt@dana.co.id?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`
  window.location.href = mailto
}
</script>

<template>
  <div class="page">
    <ReviewModal
      :entry="reviewEntry"
      @close="handleReviewClose"
      @confirm="handleReviewConfirm"
    />

    <nav class="breadcrumb">
      <button class="back-btn" @click="router.push('/')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>
      <span class="breadcrumb-trail">Dashboard / <span class="breadcrumb-current">Logbook &amp; Approval</span></span>
    </nav>
    <h1 class="title">Batch workspace</h1>
    <p class="sub">
      Upload UTR documents to add them to the current batch. Close the batch when ready
      to generate the approval package.
    </p>

    <header class="batch-hdr">
      <div class="hdr-left">
        <div>
          <div class="batch-num">{{ currentBatch.batchNumber }}</div>
          <p v-if="slaStatus === 'warn'" class="sla-warn">
            <span class="dot" />Oldest UTR: day {{ oldestSLADays }} of 3 SLA
          </p>
          <p v-else-if="currentBatch.entries.length > 0" class="sla-ok">
            Oldest UTR: day {{ oldestSLADays }} of 3 SLA
          </p>
        </div>
        <span class="badge">{{ currentBatch.status }}</span>
      </div>
      <button
        class="close-btn"
        :disabled="!canClose"
        @click="handleCloseBatch"
      >
        Close batch &amp; generate approval
      </button>
    </header>

    <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

    <div class="grid">
      <section class="card">
        <h2 class="card-title">Add UTR to batch</h2>
        <FileUploader @bundle="handleBundle" />
        <p v-if="processing" class="processing">
          Extracting documents and running investigation...
        </p>
      </section>

      <section class="card">
        <h2 class="card-title">Current batch entries</h2>
        <EntryList
          :entries="currentBatch.entries"
          @review="handleReviewOpen"
          @remove="batchStore.removeEntry"
        />

        <div v-if="currentBatch.entries.length > 0" class="summary">
          <div class="metric">
            <p class="metric-lbl">Total UTRs</p>
            <p class="metric-val">{{ currentBatch.entries.length }}</p>
          </div>
          <div class="metric">
            <p class="metric-lbl">Reports</p>
            <p class="metric-val">{{ reportCount }}</p>
          </div>
          <div class="metric">
            <p class="metric-lbl">Total nominal</p>
            <p class="metric-val small">{{ formatIDR(totalNominal) }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  font-family: system-ui, -apple-system, sans-serif;
  color: #2c2c2a;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0.5px solid #d3d1c7;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  color: #5f5e5a;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.back-btn:hover {
  background: #f1efe8;
  color: #2c2c2a;
}
.back-btn svg {
  width: 14px;
  height: 14px;
  display: block;
}
.breadcrumb-trail {
  font-size: 13px;
  color: #5f5e5a;
}
.breadcrumb-current {
  color: #2c2c2a;
}

.title {
  font-size: 22px;
  font-weight: 500;
  margin: 0 0 4px;
  margin-left: 38px;
}
.sub {
  font-size: 13px;
  color: #5f5e5a;
  margin: 0 0 20px;
  margin-left: 38px;
}

.batch-hdr {
  background: white;
  border: 0.5px solid #d3d1c7;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hdr-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.batch-num {
  font-size: 18px;
  font-weight: 500;
}
.sla-warn {
  font-size: 12px;
  color: #854f0b;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0 0;
}
.sla-ok {
  font-size: 12px;
  color: #5f5e5a;
  margin: 4px 0 0;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ba7517;
}
.badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 12px;
  font-weight: 500;
  background: #e6f1fb;
  color: #185fa5;
}

.close-btn {
  padding: 8px 18px;
  background: #185fa5;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.close-btn:disabled {
  background: #d3d1c7;
  color: #888780;
  cursor: not-allowed;
}

.error {
  background: #fcebeb;
  color: #791f1f;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
  gap: 16px;
}

.card {
  background: white;
  border: 0.5px solid #d3d1c7;
  border-radius: 12px;
  padding: 16px 20px;
}
.card-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 12px;
}

.processing {
  margin-top: 12px;
  font-size: 12px;
  color: #185fa5;
  font-style: italic;
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 16px;
}
.metric {
  background: #f7f6f3;
  border-radius: 8px;
  padding: 10px 12px;
}
.metric-lbl {
  font-size: 11px;
  color: #888780;
  margin: 0 0 2px;
}
.metric-val {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
}
.metric-val.small {
  font-size: 15px;
  line-height: 22px;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
