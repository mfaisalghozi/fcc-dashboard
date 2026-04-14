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

function badgeClass(entry: UTREntry): string {
  if (entry.status === 'EXTRACTING') return 'b-processing'
  if (entry.decision === 'REPORT') return 'b-report'
  if (entry.decision === 'NON_REPORT') return 'b-nonreport'
  if (entry.decision === 'REJECT') return 'b-reject'
  return 'b-pending'
}

function badgeText(entry: UTREntry): string {
  if (entry.status === 'EXTRACTING') return 'Extracting'
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
      @click="$emit('review', entry)"
    >
      <span class="num">{{ String(idx + 1).padStart(2, '0') }}</span>

      <div class="main">
        <p class="utr">{{ entry.utrNumber }}</p>
        <p class="meta">
          <template v-if="entry.status === 'EXTRACTING'">
            {{ entry.userName }} · Processing extraction...
          </template>
          <template v-else>
            {{ entry.userName }} · {{ entry.tipologi || 'Pending classification' }} ·
            escalated {{ formatDate(entry.escalationDate) }}
          </template>
        </p>
      </div>

      <span class="amt">
        {{ entry.transactionAmount > 0 ? formatIDR(entry.transactionAmount) : '—' }}
      </span>

      <span class="badge" :class="badgeClass(entry)">
        {{ badgeText(entry) }}
      </span>
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
  grid-template-columns: auto 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 0.5px solid #d3d1c7;
  cursor: pointer;
  transition: background 0.1s;
}
.entry:hover {
  background: #f7f6f3;
}
.entry:last-child {
  border-bottom: none;
}

.num {
  font-size: 12px;
  color: #888780;
  font-family: monospace;
  min-width: 24px;
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

.badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 500;
  white-space: nowrap;
}
.b-report {
  background: #eaf3de;
  color: #3b6d11;
}
.b-nonreport {
  background: #faeeda;
  color: #854f0b;
}
.b-reject {
  background: #fcebeb;
  color: #a32d2d;
}
.b-processing {
  background: #e6f1fb;
  color: #185fa5;
}
.b-pending {
  background: #f1efe8;
  color: #5f5e5a;
}
</style>
