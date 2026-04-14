<script setup lang="ts">
import type { UTREntry } from '@/types/utr'

defineProps<{
  entries: UTREntry[]
}>()

defineEmits<{
  review: [entry: UTREntry]
  remove: [id: string]
}>()

function formatIDR(amount: number): string {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}M`
  return `Rp ${amount.toLocaleString('id-ID')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    month: 'short',
    day: 'numeric'
  })
}

function slaDay(escalationDate: string): number {
  return Math.floor((Date.now() - new Date(escalationDate).getTime()) / (1000 * 60 * 60 * 24))
}

function slaBadgeClass(days: number): string {
  if (days >= 3) return 'sla-red'
  if (days >= 2) return 'sla-amber'
  return 'sla-green'
}

function badgeClass(entry: UTREntry): string {
  if (entry.status === 'EXTRACTING') return 'b-processing'
  if (entry.status === 'CONFIRMED') return 'b-confirmed'
  if (entry.decision === 'REPORT') return 'b-report'
  if (entry.decision === 'NON_REPORT') return 'b-nonreport'
  if (entry.decision === 'REJECT') return 'b-reject'
  return 'b-pending'
}

function badgeText(entry: UTREntry): string {
  if (entry.status === 'EXTRACTING') return 'Extracting'
  if (entry.status === 'CONFIRMED') return 'Confirmed'
  if (entry.status === 'PENDING_REVIEW') return 'Needs review'
  if (entry.decision === 'REPORT') return 'Report'
  if (entry.decision === 'NON_REPORT') return 'Non-report'
  if (entry.decision === 'REJECT') return 'Reject'
  return 'Pending'
}
</script>

<template>
  <div v-if="entries.length === 0" class="empty">
    <p>No UTRs in batch yet.</p>
    <p class="hint">Upload UTR documents on the left to get started.</p>
  </div>

  <div v-else class="list">
    <div
      v-for="(entry, idx) in entries"
      :key="entry.id"
      class="entry"
      :class="{ 'entry--needs-review': entry.status === 'PENDING_REVIEW' }"
    >
      <!-- index -->
      <span class="num">{{ String(idx + 1).padStart(2, '0') }}</span>

      <!-- main info -->
      <div class="main">
        <p class="utr">{{ entry.utrNumber }}</p>
        <p class="meta">
          <template v-if="entry.status === 'EXTRACTING'">
            {{ entry.userName }} · Processing extraction...
          </template>
          <template v-else>
            {{ entry.userName }}
            <template v-if="entry.cif"> · CIF {{ entry.cif }}</template>
            <template v-if="entry.tipologi"> · {{ entry.tipologi }}</template>
          </template>
        </p>
      </div>

      <!-- amount -->
      <span class="amt">
        {{ entry.transactionAmount > 0 ? formatIDR(entry.transactionAmount) : '—' }}
      </span>

      <!-- SLA -->
      <span
        v-if="entry.status !== 'EXTRACTING'"
        class="sla-badge"
        :class="slaBadgeClass(slaDay(entry.escalationDate))"
        :title="`Escalated ${formatDate(entry.escalationDate)}`"
      >
        D+{{ slaDay(entry.escalationDate) }}
      </span>

      <!-- status badge -->
      <span class="badge" :class="badgeClass(entry)">
        {{ badgeText(entry) }}
      </span>

      <!-- review CTA -->
      <button
        v-if="entry.status === 'PENDING_REVIEW'"
        class="review-btn"
        @click.stop="$emit('review', entry)"
      >
        Review →
      </button>
      <button
        v-else-if="entry.status === 'CONFIRMED'"
        class="review-btn review-btn--ghost"
        @click.stop="$emit('review', entry)"
      >
        Edit
      </button>
      <span v-else class="review-placeholder" />
    </div>
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: 40px 16px;
  color: #888780;
}
.empty p {
  margin: 0;
  font-size: 14px;
}
.hint {
  font-size: 12px !important;
  margin-top: 4px !important;
  color: #b4b2a9;
}

.list {
  display: flex;
  flex-direction: column;
}

.entry {
  display: grid;
  grid-template-columns: 24px 1fr auto auto auto auto;
  gap: 10px;
  align-items: center;
  padding: 11px 0;
  border-bottom: 0.5px solid #d3d1c7;
  transition: background 0.1s;
}
.entry:last-child {
  border-bottom: none;
}
.entry--needs-review {
  background: #fffef9;
}
.entry--needs-review:hover {
  background: #f7f6f3;
}

.num {
  font-size: 12px;
  color: #b4b2a9;
  font-family: monospace;
}

.main {
  min-width: 0;
}

.utr {
  font-size: 13px;
  font-weight: 500;
  color: #2c2c2a;
  margin: 0 0 2px;
}

.meta {
  font-size: 11px;
  color: #5f5e5a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amt {
  font-size: 13px;
  font-weight: 500;
  color: #2c2c2a;
  text-align: right;
  white-space: nowrap;
}

/* SLA badge */
.sla-badge {
  font-size: 10px;
  font-family: monospace;
  padding: 2px 6px;
  border-radius: 6px;
  white-space: nowrap;
  font-weight: 600;
}
.sla-green {
  background: #eaf3de;
  color: #3b6d11;
}
.sla-amber {
  background: #faeeda;
  color: #854f0b;
}
.sla-red {
  background: #fcebeb;
  color: #a32d2d;
}

/* status badge */
.badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 500;
  white-space: nowrap;
}
.b-report    { background: #eaf3de; color: #3b6d11; }
.b-nonreport { background: #faeeda; color: #854f0b; }
.b-reject    { background: #fcebeb; color: #a32d2d; }
.b-processing{ background: #e6f1fb; color: #185fa5; }
.b-confirmed { background: #f1efe8; color: #2c2c2a; border: 0.5px solid #c2c0b6; }
.b-pending   { background: #f1efe8; color: #5f5e5a; }

/* review button */
.review-btn {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  border: none;
  background: #185fa5;
  color: white;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.review-btn:hover {
  background: #1450884;
}
.review-btn--ghost {
  background: transparent;
  color: #5f5e5a;
  border: 0.5px solid #d3d1c7;
}
.review-btn--ghost:hover {
  background: #f1efe8;
  color: #2c2c2a;
}

.review-placeholder {
  width: 60px;
}
</style>
