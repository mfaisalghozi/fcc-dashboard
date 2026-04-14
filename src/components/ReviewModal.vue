<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { UTREntry, Decision, FiveW2H } from '@/types/utr'

const props = defineProps<{ entry: UTREntry | null }>()
const emit = defineEmits<{
  close: []
  confirm: [updates: Partial<UTREntry>]
}>()

// ---------------------------------------------------------------------------
// Local form state
// ---------------------------------------------------------------------------
const userName = ref('')
const cif = ref('')
const accountId = ref('')
const beneficiary = ref('')
const escalationDate = ref('')        // yyyy-MM-dd for the date input
const escalationSource = ref<'CASE_MANAGER' | 'EMAIL'>('CASE_MANAGER')
const fccPic = ref('')
const tipologi = ref('')
const criminalAssociation = ref('')
const decision = ref<Decision | null>(null)

// 5W2H
const fiveW2H = ref<FiveW2H | null>(null)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isoToDateInput(iso: string): string {
  if (!iso) return ''
  // handles both full ISO and date-only strings
  return iso.slice(0, 10)
}

function dateInputToISO(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toISOString()
}

function populateForm(e: UTREntry) {
  userName.value = e.userName
  cif.value = e.cif
  accountId.value = e.accountId
  beneficiary.value = e.beneficiary
  escalationDate.value = isoToDateInput(e.escalationDate)
  escalationSource.value = e.escalationSource
  fccPic.value = e.fccPic
  tipologi.value = e.tipologi
  criminalAssociation.value = e.criminalAssociation
  decision.value = e.decision

  if (e.fiveW2H) {
    fiveW2H.value = {
      what: e.fiveW2H.what,
      why: e.fiveW2H.why,
      who: { ...e.fiveW2H.who },
      when: e.fiveW2H.when,
      where: e.fiveW2H.where,
      how: e.fiveW2H.how,
      howMuch: { ...e.fiveW2H.howMuch }
    }
  } else {
    fiveW2H.value = null
  }
}

watch(
  () => props.entry,
  (e) => {
    if (e) {
      populateForm(e)
      nextTick(() => trapFocus())
    }
  },
  { immediate: true }
)

// ---------------------------------------------------------------------------
// Confirm & Save
// ---------------------------------------------------------------------------
function handleConfirm() {
  if (!decision.value) return

  const updates: Partial<UTREntry> = {
    userName: userName.value,
    cif: cif.value,
    accountId: accountId.value,
    beneficiary: beneficiary.value,
    escalationDate: escalationDate.value ? dateInputToISO(escalationDate.value) : props.entry!.escalationDate,
    escalationSource: escalationSource.value,
    fccPic: fccPic.value,
    tipologi: tipologi.value,
    criminalAssociation: criminalAssociation.value,
    decision: decision.value,
    status: 'CONFIRMED',
    confirmedAt: new Date().toISOString()
  }

  if (fiveW2H.value) {
    updates.fiveW2H = {
      what: fiveW2H.value.what,
      why: fiveW2H.value.why,
      who: { ...fiveW2H.value.who },
      when: fiveW2H.value.when,
      where: fiveW2H.value.where,
      how: fiveW2H.value.how,
      howMuch: { ...fiveW2H.value.howMuch }
    }
  }

  emit('confirm', updates)
}

// ---------------------------------------------------------------------------
// Focus trap
// ---------------------------------------------------------------------------
const modalCard = ref<HTMLElement | null>(null)

function trapFocus() {
  if (!modalCard.value) return
  const focusable = modalCard.value.querySelectorAll<HTMLElement>(
    'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (focusable.length) focusable[0].focus()
}

function handleTabKey(e: KeyboardEvent) {
  if (!modalCard.value || !props.entry) return
  const focusable = Array.from(
    modalCard.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  )
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault()
      last.focus()
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

// ---------------------------------------------------------------------------
// Keyboard handler
// ---------------------------------------------------------------------------
function handleKeydown(e: KeyboardEvent) {
  if (!props.entry) return
  if (e.key === 'Escape') emit('close')
  if (e.key === 'Tab') handleTabKey(e)
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------
function statusLabel(s: UTREntry['status']): string {
  const map: Record<UTREntry['status'], string> = {
    EXTRACTING: 'Extracting',
    PENDING_REVIEW: 'Pending Review',
    CONFIRMED: 'Confirmed',
    BATCHED: 'Batched',
    APPROVAL_SENT: 'Approval Sent',
    APPROVED: 'Approved',
    REPORTING: 'Reporting',
    REPORTED: 'Reported'
  }
  return map[s] ?? s
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="entry"
      class="overlay"
      @click.self="$emit('close')"
      role="dialog"
      aria-modal="true"
      :aria-label="`Review UTR ${entry.utrNumber}`"
    >
      <div class="modal-card" ref="modalCard">

        <!-- ── Header ─────────────────────────────────────────────────── -->
        <div class="modal-header">
          <div class="header-left">
            <span class="utr-number">{{ entry.utrNumber }}</span>
            <span class="status-badge">{{ statusLabel(entry.status) }}</span>
          </div>
          <button class="close-btn" @click="$emit('close')" aria-label="Close modal">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- ── Section: Identity ──────────────────────────────────────── -->
        <section class="section">
          <h3 class="section-title">Identity</h3>
          <div class="grid-2">
            <div class="field">
              <label>User Name</label>
              <input type="text" v-model="userName" />
            </div>
            <div class="field">
              <label>CIF</label>
              <input type="text" v-model="cif" />
            </div>
            <div class="field">
              <label>Account ID</label>
              <input type="text" v-model="accountId" />
            </div>
            <div class="field">
              <label>Beneficiary</label>
              <input type="text" v-model="beneficiary" />
            </div>
            <div class="field">
              <label>Escalation Date</label>
              <input type="date" v-model="escalationDate" />
            </div>
            <div class="field">
              <label>Escalation Source</label>
              <select v-model="escalationSource">
                <option value="CASE_MANAGER">Case Manager</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
            <div class="field">
              <label>FCC PIC</label>
              <input type="text" v-model="fccPic" />
            </div>
          </div>
        </section>

        <!-- ── Section: 5W2H ─────────────────────────────────────────── -->
        <section v-if="entry.fiveW2H && fiveW2H" class="section">
          <h3 class="section-title">AI Investigation — 5W2H</h3>
          <div class="field">
            <label>What (what happened)</label>
            <textarea rows="3" v-model="fiveW2H.what" />
          </div>
          <div class="field">
            <label>Why (why suspicious)</label>
            <textarea rows="3" v-model="fiveW2H.why" />
          </div>
          <div class="field">
            <label>When (when it occurred)</label>
            <textarea rows="3" v-model="fiveW2H.when" />
          </div>
          <div class="field">
            <label>Where</label>
            <textarea rows="3" v-model="fiveW2H.where" />
          </div>
          <div class="field">
            <label>How (modus operandi)</label>
            <textarea rows="3" v-model="fiveW2H.how" />
          </div>
          <div class="grid-2">
            <div class="field">
              <label>How Much — Transaction Count</label>
              <input type="number" v-model.number="fiveW2H.howMuch.count" min="0" />
            </div>
            <div class="field">
              <label>How Much — Total IDR</label>
              <input type="number" v-model.number="fiveW2H.howMuch.totalIDR" min="0" />
            </div>
          </div>
        </section>

        <!-- ── Section: Classification ───────────────────────────────── -->
        <section class="section">
          <h3 class="section-title">Classification</h3>
          <div class="field">
            <label>Tipologi</label>
            <input type="text" v-model="tipologi" />
          </div>
          <div class="field">
            <label>Criminal Association</label>
            <input type="text" v-model="criminalAssociation" />
          </div>
        </section>

        <!-- ── Section: Decision ─────────────────────────────────────── -->
        <section class="section">
          <h3 class="section-title">Decision</h3>
          <div class="decision-group">
            <button
              class="decision-btn"
              :class="{ 'decision-report': decision === 'REPORT' }"
              @click="decision = 'REPORT'"
              type="button"
            >
              REPORT
            </button>
            <button
              class="decision-btn"
              :class="{ 'decision-nonreport': decision === 'NON_REPORT' }"
              @click="decision = 'NON_REPORT'"
              type="button"
            >
              NON_REPORT
            </button>
            <button
              class="decision-btn"
              :class="{ 'decision-reject': decision === 'REJECT' }"
              @click="decision = 'REJECT'"
              type="button"
            >
              REJECT
            </button>
          </div>
        </section>

        <!-- ── Footer ────────────────────────────────────────────────── -->
        <div class="modal-footer">
          <button class="btn-ghost" @click="$emit('close')" type="button">Cancel</button>
          <button
            class="btn-primary"
            :disabled="!decision"
            @click="handleConfirm"
            type="button"
          >
            Confirm &amp; Save
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────────────────── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(44, 44, 42, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* ── Modal card ──────────────────────────────────────────────────────────── */
.modal-card {
  background: #ffffff;
  border-radius: 14px;
  box-shadow:
    0 8px 40px rgba(44, 44, 42, 0.18),
    0 2px 8px rgba(44, 44, 42, 0.08);
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  animation: slide-in 200ms ease both;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 16px;
  border-bottom: 0.5px solid #d3d1c7;
  position: sticky;
  top: 0;
  background: #ffffff;
  z-index: 1;
  border-radius: 14px 14px 0 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.utr-number {
  font-family: monospace;
  font-size: 15px;
  font-weight: 700;
  color: #2c2c2a;
  letter-spacing: 0.03em;
}

.status-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 8px;
  background: #f1efe8;
  color: #5f5e5a;
  letter-spacing: 0.04em;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #888780;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.12s, color 0.12s;
  flex-shrink: 0;
}
.close-btn:hover {
  background: #f1efe8;
  color: #2c2c2a;
}

/* ── Sections ────────────────────────────────────────────────────────────── */
.section {
  padding: 20px 22px;
  border-bottom: 0.5px solid #d3d1c7;
}
.section:last-of-type {
  border-bottom: none;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #888780;
  border-bottom: 0.5px solid #d3d1c7;
  padding-bottom: 6px;
  margin: 0 0 14px;
}

/* ── Grid ────────────────────────────────────────────────────────────────── */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}

/* ── Fields ──────────────────────────────────────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
}
.field:last-child {
  margin-bottom: 0;
}

.grid-2 .field {
  margin-bottom: 0;
}

label {
  font-size: 11px;
  color: #5f5e5a;
  margin-bottom: 4px;
  font-family: system-ui, -apple-system, sans-serif;
}

input[type='text'],
input[type='date'],
input[type='number'],
select,
textarea {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  color: #2c2c2a;
  background: #fafaf8;
  border: 0.5px solid #d3d1c7;
  border-radius: 6px;
  padding: 8px 10px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.12s;
  outline: none;
  resize: vertical;
}

input[type='text']:focus,
input[type='date']:focus,
input[type='number']:focus,
select:focus,
textarea:focus {
  border-color: #185fa5;
}

/* ── Decision buttons ────────────────────────────────────────────────────── */
.decision-group {
  display: flex;
  gap: 10px;
}

.decision-btn {
  flex: 1;
  padding: 14px 8px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid #d3d1c7;
  background: #ffffff;
  color: #5f5e5a;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.decision-btn:hover {
  background: #f7f6f3;
}

.decision-report {
  background: #eaf3de !important;
  border-color: #3b6d11 !important;
  color: #3b6d11 !important;
}
.decision-nonreport {
  background: #faeeda !important;
  border-color: #854f0b !important;
  color: #854f0b !important;
}
.decision-reject {
  background: #fcebeb !important;
  border-color: #a32d2d !important;
  color: #a32d2d !important;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px 20px;
  border-top: 0.5px solid #d3d1c7;
  background: #ffffff;
  border-radius: 0 0 14px 14px;
  position: sticky;
  bottom: 0;
  z-index: 1;
}

.btn-ghost {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #5f5e5a;
  background: transparent;
  border: 0.5px solid #d3d1c7;
  border-radius: 7px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.btn-ghost:hover {
  background: #f1efe8;
  color: #2c2c2a;
}

.btn-primary {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  background: #185fa5;
  border: none;
  border-radius: 7px;
  padding: 8px 20px;
  cursor: pointer;
  transition: background 0.12s, opacity 0.12s;
}
.btn-primary:hover:not(:disabled) {
  background: #135089;
}
.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
