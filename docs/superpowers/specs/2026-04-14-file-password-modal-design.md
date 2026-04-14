# File Password Modal — Design Spec

**Date:** 2026-04-14  
**Feature:** Password prompt for locked/encrypted UTR bundle files  
**Affected zone:** Zone 2 — Logbook & Approval (BatchWorkspace)

---

## 1. Problem

UTR bundle files (`.docx` analysis documents, `.xlsx` working papers) may be password-protected. When a user uploads a locked file, the current parser throws a generic error and removes the entry from the batch. The user has no way to unlock the file and retry — they must close the app, remove the password externally, and re-upload.

---

## 2. Goals

- Detect password-protected files during parsing
- Show a single modal after all uploaded bundles have been attempted, collecting passwords for every locked file in one interaction
- Support a "same password for all" shortcut checkbox
- Retry locked bundles with the provided passwords
- Surface a clear error if a locked `.docx` cannot be decrypted (mammoth library limitation)

---

## 3. Non-goals

- Decrypting `.docx` files (mammoth does not support OLE-encrypted Word documents — retry will show an explicit error for this case)
- Remembering or caching passwords between sessions
- Bulk-unlock of files outside the upload flow

---

## 4. Approach

**Approach A — Catch-and-queue in BatchWorkspace.**

Process all bundles in parallel. On password error, queue the bundle as locked rather than failing it. After all bundles settle, show one modal for all locked files. On submit, retry locked bundles with passwords injected into the parser.

Rejected alternatives:
- **Approach B (two-pass probe):** double file reads, more parser complexity, same mammoth limitation
- **Approach C (byte-level scan):** brittle, format-knowledge coupling, same mammoth limitation

---

## 5. Architecture

### 5.1 Error class — `parser.ts`

```typescript
export class PasswordRequiredError extends Error {
  constructor(public lockedFiles: string[]) {
    super('Files are password-protected')
    this.name = 'PasswordRequiredError'
  }
}
```

### 5.2 Password error detection — `parser.ts`

```typescript
function isPasswordError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : ''
  return msg.includes('password') || msg.includes('encrypted') || msg.includes('cfb')
}
```

### 5.3 Parser changes — `parser.ts`

- `parseDocxAnalysis(file, password?: string)` — `password` param accepted for API consistency; mammoth ignores it (throws on encrypted docx regardless)
- `parseXlsxWorkingPaper(file, password?: string)` — passes password to `XLSX.read(buf, { type: 'array', password })`
- `parseBundle(files, passwords?: Record<string, string>)`:
  1. Try `parseDocxAnalysis(docx, passwords?.[docx.name])` — catch password errors, add filename to `lockedFiles`
  2. Try `parseXlsxWorkingPaper(xlsx, passwords?.[xlsx.name])` — catch password errors, add filename to `lockedFiles`
  3. If `lockedFiles.length > 0` → throw `PasswordRequiredError(lockedFiles)`
  4. Otherwise proceed as today

### 5.4 New component — `FilePasswordModal.vue`

**Props:**
```typescript
lockedFiles: string[]   // flat list of locked file names across all bundles
```

**Emits:**
```typescript
submit: (passwords: Record<string, string>) => void
cancel: () => void
```

**Internal state:**
```typescript
samePassword: boolean        // checkbox, default false
sharedPassword: string       // used when samePassword = true
perFilePasswords: Record<string, string>  // used when samePassword = false
```

**Layout (same-password mode):**
```
┌─────────────────────────────────────────┐
│ Files require a password                 │
│ 2 file(s) could not be opened           │
│                                         │
│ [✓] All files share the same password   │
│                                         │
│ Password  [________________]            │
│                                         │
│          [Cancel]  [Unlock & Retry]     │
└─────────────────────────────────────────┘
```

**Layout (per-file mode):**
```
┌─────────────────────────────────────────┐
│ Files require a password                 │
│ 3 file(s) could not be opened           │
│                                         │
│ [ ] All files share the same password   │
│                                         │
│ UTR-2026-001234-analysis.docx           │
│ [________________]                      │
│                                         │
│ UTR-2026-001234-workpaper.xlsx          │
│ [________________]                      │
│                                         │
│          [Cancel]  [Unlock & Retry]     │
└─────────────────────────────────────────┘
```

**Submit logic:**
- If `samePassword`: build `{ [file]: sharedPassword }` for every locked file
- If not: use `perFilePasswords` directly
- Emit `submit(passwordsMap)`

**Cancel logic:**
- Emit `cancel()` — BatchWorkspace removes placeholder entries for all locked bundles

### 5.5 BatchWorkspace changes

**New state refs:**
```typescript
const showPasswordModal = ref(false)
const allLockedFiles = ref<string[]>([])
const lockedBundles = ref<Array<{ files: File[]; entryIds: string[] }>>([])
```

**New flow:**

```
FileUploader emits bundle(s)
  → each bundle queued into pendingBundles[]
  → processAllBundles() called (debounced 50ms to batch rapid emits)
      → Promise.allSettled over all pending bundles
      → successes: proceed to investigation pipeline (existing logic)
      → PasswordRequiredError: push to lockedBundles[], add placeholder entry
      → other errors: remove placeholder, show errorMsg (existing behavior)
      → after settle: if lockedBundles.length > 0 → flatten locked filenames → showPasswordModal = true
  → modal submit(passwords):
      → showPasswordModal = false
      → retry each locked bundle: parser.parseBundle(files, passwords)
          → success: continue investigation pipeline
          → docx password error (mammoth limitation): remove placeholder, show specific error
          → other error: remove placeholder, show errorMsg
  → modal cancel():
      → showPasswordModal = false
      → remove all locked bundle placeholder entries
```

---

## 6. Error cases

| Scenario | Behavior |
|---|---|
| `.xlsx` locked, correct password | Unlocks, parsing proceeds normally |
| `.xlsx` locked, wrong password | SheetJS throws again → remove placeholder, show "Incorrect password for `<filename>`" |
| `.docx` locked | Retry still throws (mammoth limitation) → remove placeholder, show "Encrypted .docx files are not supported. Remove the password in Word and re-upload." |
| Both files locked, same password | Single password input (checkbox), both retry |
| Both files locked, different passwords | Two inputs (unchecked), each retried independently |
| Non-password parse error | Existing error path unchanged |

---

## 7. Files changed

| File | Change |
|---|---|
| `src/services/parser.ts` | Add `PasswordRequiredError`, `isPasswordError()`, password params |
| `src/components/FilePasswordModal.vue` | New component |
| `src/views/BatchWorkspace.vue` | Catch-and-queue logic, modal wiring, retry path |

No changes to `src/types/utr.ts`, `src/stores/batch.ts`, or other components.

---

## 8. Out of scope / future

- If a user frequently uploads locked files, a "default password" setting could be added to user preferences
- Microsoft Graph API integration (future Zone 3) may retrieve files pre-decrypted from SharePoint — this modal would then only trigger for locally-uploaded locked files
