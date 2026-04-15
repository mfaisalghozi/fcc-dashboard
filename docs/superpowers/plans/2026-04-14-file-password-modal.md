# File Password Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When uploaded UTR bundle files are password-protected, show a single modal after all bundles are attempted, collect passwords (with a "same password" shortcut), and retry parsing with those passwords.

**Architecture:** Approach A (catch-and-queue). `BatchWorkspace` queues all emitted bundles, runs `parser.parseBundle` for each in parallel via `Promise.allSettled`, collects `PasswordRequiredError` results into a locked list, shows `FilePasswordModal` once, then retries locked bundles with the provided password map. SheetJS supports password retry natively; mammoth cannot decrypt OLE-encrypted `.docx` files — this case surfaces an explicit error message.

**Tech Stack:** Vue 3 + TypeScript, SheetJS (`xlsx`), mammoth, Pinia

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/services/parser.ts` | Add `PasswordRequiredError`, `isPasswordError()`, `isOleFile()`, password params on xlsx parser and `parseBundle` |
| Create | `src/components/FilePasswordModal.vue` | Modal UI: locked file list, same-password checkbox, per-file inputs, submit/cancel |
| Modify | `src/views/BatchWorkspace.vue` | Queue bundles, `processAllBundles()`, modal state, retry handler, cancel handler |

---

## Task 1: Add error infrastructure to `parser.ts`

**Files:**
- Modify: `src/services/parser.ts`

- [ ] **Step 1: Add `PasswordRequiredError` class and helpers above the `UTRDocumentParser` class**

  Open `src/services/parser.ts`. Insert the following block between the import statements and the `export class UTRDocumentParser` line:

  ```typescript
  export class PasswordRequiredError extends Error {
    constructor(public lockedFiles: string[]) {
      super('Files are password-protected')
      this.name = 'PasswordRequiredError'
    }
  }

  function isPasswordError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
    return msg.includes('password') || msg.includes('encrypted') || msg.includes('cfb')
  }

  async function isOleFile(file: File): Promise<boolean> {
    const buf = await file.slice(0, 8).arrayBuffer()
    const bytes = new Uint8Array(buf)
    // OLE2 Compound File Binary magic bytes: D0 CF 11 E0
    return bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/services/parser.ts
  git commit -m "feat: add PasswordRequiredError and OLE/password detection helpers"
  ```

---

## Task 2: Add password support to `parseXlsxWorkingPaper`

**Files:**
- Modify: `src/services/parser.ts`

- [ ] **Step 1: Update the method signature and XLSX.read call**

  Replace the existing `parseXlsxWorkingPaper` method with:

  ```typescript
  async parseXlsxWorkingPaper(file: File, password?: string): Promise<Transaction[]> {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      ...(password !== undefined ? { password } : {})
    })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    return rows.map((row): Transaction => ({
      number: String(row['Transaction Number'] ?? row['No'] ?? ''),
      date: String(row['Date'] ?? row['Tanggal'] ?? ''),
      amount: Number(row['Amount'] ?? row['Nilai'] ?? 0),
      method: String(row['Method'] ?? row['Cara'] ?? ''),
      origin: String(row['Origin'] ?? row['Asal'] ?? ''),
      destination: String(row['Destination'] ?? row['Tujuan'] ?? '')
    }))
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: build succeeds.

- [ ] **Step 3: Commit**

  ```bash
  git add src/services/parser.ts
  git commit -m "feat: add optional password param to parseXlsxWorkingPaper"
  ```

---

## Task 3: Update `parseBundle` to detect and collect locked files

**Files:**
- Modify: `src/services/parser.ts`

- [ ] **Step 1: Replace `parseBundle` with the two-file try/catch version**

  Replace the existing `parseBundle` method with:

  ```typescript
  async parseBundle(files: File[], passwords?: Record<string, string>): Promise<Partial<UTREntry>> {
    const docx = files.find((f) => f.name.endsWith('.docx'))
    const xlsx = files.find((f) => f.name.endsWith('.xlsx'))

    if (!docx) throw new Error('Missing .docx analysis document')
    if (!xlsx) throw new Error('Missing .xlsx working paper')

    const lockedFiles: string[] = []

    // Detect encrypted .docx (OLE2 format — mammoth cannot decrypt these)
    const docxIsOle = await isOleFile(docx)
    if (docxIsOle) {
      if (passwords?.[docx.name] !== undefined) {
        // Retry case: mammoth limitation — inform user explicitly
        throw new Error(
          `Cannot open "${docx.name}": encrypted .docx files are not supported. ` +
          `Remove the password in Word and re-upload.`
        )
      }
      lockedFiles.push(docx.name)
    }

    // Try .xlsx with optional password
    let transactions: Transaction[] = []
    try {
      transactions = await this.parseXlsxWorkingPaper(xlsx, passwords?.[xlsx.name])
    } catch (err) {
      if (isPasswordError(err)) {
        if (passwords?.[xlsx.name] !== undefined) {
          // Retry case: password was provided but still failed — wrong password
          throw new Error(`Incorrect password for "${xlsx.name}"`)
        }
        lockedFiles.push(xlsx.name)
      } else {
        throw err
      }
    }

    // Surface all locked files in one error so the modal can list them
    if (lockedFiles.length > 0) throw new PasswordRequiredError(lockedFiles)

    // Both files are accessible — proceed with full parse
    const narrative = await this.parseDocxAnalysis(docx)
    const { utrNumber, userName } = this.extractUTRMetadata(docx.name, narrative)
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)

    return {
      utrNumber,
      userName,
      transactions,
      transactionCount: transactions.length,
      transactionAmount: totalAmount,
      sourceFiles: files.map((f) => f.name),
      escalationDate: new Date().toISOString(),
      escalationSource: 'EMAIL'
    }
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: build succeeds.

- [ ] **Step 3: Commit**

  ```bash
  git add src/services/parser.ts
  git commit -m "feat: update parseBundle to detect locked files and throw PasswordRequiredError"
  ```

---

## Task 4: Create `FilePasswordModal.vue`

**Files:**
- Create: `src/components/FilePasswordModal.vue`

- [ ] **Step 1: Create the component**

  Create `src/components/FilePasswordModal.vue` with the following content:

  ```vue
  <script setup lang="ts">
  import { ref } from 'vue'

  const props = defineProps<{
    lockedFiles: string[]
  }>()

  const emit = defineEmits<{
    submit: [passwords: Record<string, string>]
    cancel: []
  }>()

  const samePassword = ref(false)
  const sharedPassword = ref('')
  const perFilePasswords = ref<Record<string, string>>(
    Object.fromEntries(props.lockedFiles.map((f) => [f, '']))
  )

  function handleSubmit() {
    const passwords: Record<string, string> = {}
    if (samePassword.value) {
      for (const file of props.lockedFiles) {
        passwords[file] = sharedPassword.value
      }
    } else {
      Object.assign(passwords, perFilePasswords.value)
    }
    emit('submit', passwords)
  }
  </script>

  <template>
    <div class="overlay" @click.self="emit('cancel')">
      <div class="modal">
        <div class="modal-header">
          <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div>
            <h2 class="modal-title">Files require a password</h2>
            <p class="modal-sub">{{ lockedFiles.length }} file(s) could not be opened</p>
          </div>
        </div>

        <label class="checkbox-row">
          <input type="checkbox" v-model="samePassword" />
          <span>All files share the same password</span>
        </label>

        <div v-if="samePassword" class="field">
          <label class="field-label">Password</label>
          <input
            class="field-input"
            type="password"
            v-model="sharedPassword"
            placeholder="Enter password"
            autofocus
          />
        </div>

        <div v-else class="fields">
          <div v-for="file in lockedFiles" :key="file" class="field">
            <label class="field-label">{{ file }}</label>
            <input
              class="field-input"
              type="password"
              v-model="perFilePasswords[file]"
              placeholder="Enter password"
            />
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="emit('cancel')">Cancel</button>
          <button class="btn-submit" @click="handleSubmit">Unlock &amp; Retry</button>
        </div>
      </div>
    </div>
  </template>

  <style scoped>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: white;
    border-radius: 12px;
    padding: 24px;
    width: 420px;
    max-width: calc(100vw - 32px);
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
  }
  .modal-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .lock-icon {
    width: 24px;
    height: 24px;
    color: #185fa5;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .modal-title {
    font-size: 16px;
    font-weight: 500;
    margin: 0;
    color: #2c2c2a;
  }
  .modal-sub {
    font-size: 13px;
    color: #5f5e5a;
    margin: 4px 0 0;
  }
  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #2c2c2a;
    cursor: pointer;
  }
  .fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field-label {
    font-size: 12px;
    color: #5f5e5a;
    font-family: 'Courier New', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .field-input {
    padding: 8px 10px;
    border: 1px solid #d3d1c7;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  .field-input:focus {
    border-color: #185fa5;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 4px;
  }
  .btn-cancel {
    padding: 8px 16px;
    background: white;
    border: 1px solid #d3d1c7;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    color: #2c2c2a;
  }
  .btn-cancel:hover {
    background: #f7f6f3;
  }
  .btn-submit {
    padding: 8px 16px;
    background: #185fa5;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-submit:hover {
    background: #145189;
  }
  </style>
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: build succeeds.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/FilePasswordModal.vue
  git commit -m "feat: add FilePasswordModal component"
  ```

---

## Task 5: Refactor `BatchWorkspace.vue` — queue-and-process all bundles

**Files:**
- Modify: `src/views/BatchWorkspace.vue`

This task replaces the existing `handleBundle` function with a queuing mechanism so that all bundles emitted synchronously in a single drop/upload event are collected before processing begins.

- [ ] **Step 1: Add imports and new state refs**

  In the `<script setup>` block, add the `PasswordRequiredError` import and the new state refs. The final imports block and new refs should look like:

  ```typescript
  import { computed, ref } from 'vue'
  import { storeToRefs } from 'pinia'
  import { useRouter } from 'vue-router'
  import FileUploader from '@/components/FileUploader.vue'
  import EntryList from '@/components/EntryList.vue'
  import ReviewModal from '@/components/ReviewModal.vue'
  import FilePasswordModal from '@/components/FilePasswordModal.vue'
  import { useBatchStore } from '@/stores/batch'
  import { parser, PasswordRequiredError } from '@/services/parser'
  import { InvestigationAgent } from '@/services/investigation'
  import {
    generateApprovalExcel,
    generateApprovalEmailBody
  } from '@/services/approval'
  import type { UTREntry } from '@/types/utr'
  ```

  Then, after the existing `const agent = ...` line, add:

  ```typescript
  // Password modal state
  interface LockedBundle {
    files: File[]
    entryId: string
  }
  const showPasswordModal = ref(false)
  const allLockedFiles = ref<string[]>([])
  const lockedBundles = ref<LockedBundle[]>([])

  // Bundle queue — collects all bundles emitted in one tick before processing
  const pendingBundles = ref<File[][]>([])
  let processingScheduled = false
  ```

- [ ] **Step 2: Replace `handleBundle` with the queue-and-schedule version**

  Delete the existing `handleBundle` function entirely and replace it with:

  ```typescript
  function handleBundle(files: File[]) {
    pendingBundles.value.push(files)
    if (!processingScheduled) {
      processingScheduled = true
      setTimeout(() => {
        processingScheduled = false
        const toProcess = [...pendingBundles.value]
        pendingBundles.value = []
        processAllBundles(toProcess)
      }, 0)
    }
  }
  ```

- [ ] **Step 3: Add the `runInvestigation` helper**

  Add this function after `handleBundle`:

  ```typescript
  async function runInvestigation(
    parsed: Partial<UTREntry>,
    files: File[],
    entryId: string
  ) {
    try {
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
      const message = err instanceof Error ? err.message : 'Investigation failed'
      errorMsg.value = `Failed to investigate bundle: ${message}`
      batchStore.removeEntry(entryId)
    }
  }
  ```

- [ ] **Step 4: Add the `processAllBundles` function**

  Add this function after `runInvestigation`:

  ```typescript
  async function processAllBundles(bundleList: File[][]) {
    processing.value = true
    errorMsg.value = null

    // Create placeholder entries for all bundles upfront
    const bundleEntries: LockedBundle[] = bundleList.map((files) => {
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
      return { files, entryId }
    })

    // Attempt parsing all bundles in parallel
    const results = await Promise.allSettled(
      bundleEntries.map(({ files, entryId }) =>
        parser.parseBundle(files).then((parsed) => ({ parsed, files, entryId }))
      )
    )

    const newLockedBundles: LockedBundle[] = []
    const investigationQueue: Array<{ parsed: Partial<UTREntry>; files: File[]; entryId: string }> = []

    results.forEach((result, i) => {
      const { files, entryId } = bundleEntries[i]
      if (result.status === 'fulfilled') {
        investigationQueue.push(result.value)
      } else {
        const err = result.reason
        if (err instanceof PasswordRequiredError) {
          newLockedBundles.push({ files, entryId })
          allLockedFiles.value.push(...err.lockedFiles)
        } else {
          const message = err instanceof Error ? err.message : 'Extraction failed'
          errorMsg.value = `Failed to process bundle: ${message}`
          batchStore.removeEntry(entryId)
        }
      }
    })

    // Investigate all successfully parsed bundles
    await Promise.allSettled(
      investigationQueue.map(({ parsed, files, entryId }) =>
        runInvestigation(parsed, files, entryId)
      )
    )

    // Show password modal if any bundles were locked
    if (newLockedBundles.length > 0) {
      lockedBundles.value = newLockedBundles
      showPasswordModal.value = true
    }

    processing.value = false
  }
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: build succeeds. (The modal is not wired into the template yet — that's Task 6.)

- [ ] **Step 6: Commit**

  ```bash
  git add src/views/BatchWorkspace.vue
  git commit -m "feat: refactor BatchWorkspace to queue-and-process all bundles in parallel"
  ```

---

## Task 6: Wire `FilePasswordModal` into `BatchWorkspace`

**Files:**
- Modify: `src/views/BatchWorkspace.vue`

- [ ] **Step 1: Add retry and cancel handlers**

  Add these two functions after `processAllBundles`:

  ```typescript
  async function handlePasswordSubmit(passwords: Record<string, string>) {
    showPasswordModal.value = false
    const bundlesToRetry = [...lockedBundles.value]
    lockedBundles.value = []
    allLockedFiles.value = []

    processing.value = true
    errorMsg.value = null

    const retryResults = await Promise.allSettled(
      bundlesToRetry.map(({ files, entryId }) =>
        parser.parseBundle(files, passwords).then((parsed) => ({ parsed, files, entryId }))
      )
    )

    const investigationQueue: Array<{ parsed: Partial<UTREntry>; files: File[]; entryId: string }> = []

    retryResults.forEach((result, i) => {
      const { files, entryId } = bundlesToRetry[i]
      if (result.status === 'fulfilled') {
        investigationQueue.push(result.value)
      } else {
        const err = result.reason
        const message = err instanceof Error ? err.message : 'Failed to open file'
        errorMsg.value = `Password error: ${message}`
        batchStore.removeEntry(entryId)
      }
    })

    await Promise.allSettled(
      investigationQueue.map(({ parsed, files, entryId }) =>
        runInvestigation(parsed, files, entryId)
      )
    )

    processing.value = false
  }

  function handlePasswordCancel() {
    showPasswordModal.value = false
    for (const { entryId } of lockedBundles.value) {
      batchStore.removeEntry(entryId)
    }
    lockedBundles.value = []
    allLockedFiles.value = []
  }
  ```

- [ ] **Step 2: Add `FilePasswordModal` to the template**

  In the `<template>`, add the modal right after the opening `<div class="page">` tag (alongside the existing `ReviewModal`):

  ```html
  <FilePasswordModal
    v-if="showPasswordModal"
    :locked-files="allLockedFiles"
    @submit="handlePasswordSubmit"
    @cancel="handlePasswordCancel"
  />
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: build succeeds with no errors.

- [ ] **Step 4: Manual smoke test — unprotected files (regression check)**

  ```bash
  npm run dev
  ```

  1. Open `http://localhost:5173/logbook`
  2. Upload a normal (unprotected) UTR bundle — `.docx` + `.xlsx`
  3. Confirm: entry appears, processes to `PENDING_REVIEW`, no password modal appears
  4. Confirm: existing batch features (close batch, review modal) still work

- [ ] **Step 5: Manual smoke test — locked `.xlsx`**

  1. Create a password-protected Excel file (e.g. open any `.xlsx` in Excel → Save with password)
  2. Upload it alongside a normal `.docx` as a bundle
  3. Confirm: password modal appears listing the `.xlsx` filename
  4. Enter the correct password → click "Unlock & Retry"
  5. Confirm: entry processes to `PENDING_REVIEW`

- [ ] **Step 6: Manual smoke test — same-password checkbox**

  1. Create two bundles each with a locked `.xlsx` (same password)
  2. Drop both bundles at once
  3. Confirm: one modal appears listing both `.xlsx` filenames
  4. Check "All files share the same password", enter the password
  5. Confirm: both entries process successfully

- [ ] **Step 7: Manual smoke test — cancel**

  1. Upload a locked bundle
  2. When modal appears, click Cancel
  3. Confirm: placeholder entry is removed from the batch list, no error shown

- [ ] **Step 8: Commit**

  ```bash
  git add src/views/BatchWorkspace.vue
  git commit -m "feat: wire FilePasswordModal for locked UTR bundle files"
  ```
