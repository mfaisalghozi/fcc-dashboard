export type Decision = 'REPORT' | 'NON_REPORT' | 'REJECT'

export type UTRStatus =
  | 'EXTRACTING'
  | 'PENDING_REVIEW'
  | 'CONFIRMED'
  | 'BATCHED'
  | 'APPROVAL_SENT'
  | 'APPROVED'
  | 'REPORTING'
  | 'REPORTED'

export type BatchStatus = 'OPEN' | 'CLOSED' | 'SENT' | 'APPROVED' | 'COMPLETE'

export interface Transaction {
  number: string
  date: string
  amount: number
  method: string
  origin: string
  destination: string
}

export interface FiveW2H {
  what: string
  why: string
  who: { name: string; cif?: string; accountId?: string }
  when: string
  where: string
  how: string
  howMuch: { count: number; totalIDR: number }
}

export interface UTREntry {
  id: string
  utrNumber: string
  status: UTRStatus
  decision: Decision | null
  batchId: string | null

  userName: string
  cif: string
  accountId: string
  beneficiary: string
  tipologi: string
  criminalAssociation: string
  transactionCount: number
  transactionAmount: number

  fiveW2H?: FiveW2H
  transactions?: Transaction[]

  escalationDate: string
  escalationSource: 'CASE_MANAGER' | 'EMAIL'
  escalationLetterNo?: string
  confirmedAt?: string

  sourceFiles: string[]
  fccPic: string
}

export interface Batch {
  id: string
  batchNumber: string
  reportingPeriod: string
  status: BatchStatus
  entries: UTREntry[]
  createdAt: string
  closedAt?: string
  sentAt?: string
}

export interface UploadResult {
  success: boolean
  entry?: UTREntry
  error?: string
}
