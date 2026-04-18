# RISK_NOTES Bundle → Logbook Export

**Date:** 2026-04-18
**Branch:** feat/logbook-enhance
**Scope:** Zone 2 — Logbook & Approval

---

## Problem

The existing parser assumes one bundle = one UTR subject (one `UTREntry`). Real RISK_NOTES bundles contain:

- One RISK_NOTES analysis `.docx` (shared narrative, typology, conclusion)
- Four bank working papers (`_BCA`, `_BNI`, `_BRI`, `_Permata` `.xlsx`) — each ~55K rows of outgoing P2B transactions for the entire DANA user base
- One user profile xlsx (`_Profil_Pengguna_Jasa.xlsx`) — 15 subjects (Name, CIF, Login ID)

All 15 subjects share one UTR number, one typology, and one REPORT decision. The logbook output is **one row per subject** (15 rows), with the total transaction count/amount on the first row only and per-bank breakdown in auxiliary columns.

---

## Decisions

| Question | Decision |
|---|---|
| Multi-subject display in UI | Flat rows — each subject appears as its own entry in the batch list |
| AI investigation | Skipped — typology and decision are parsed directly from the RISK_NOTES document text |
| Export format | Logbook Excel only, matching the exact column structure of `Logbook_Example.xlsx` |
| Approach | New `parseRiskNotesBundle()` method alongside existing `parseBundle()` (Approach A) |

---

## Architecture

### 1. Data model — `src/types/utr.ts`

Add optional fields to `UTREntry`:

```typescript
source?: string           // "Risk" | "Case Manager" — Source column
pov?: string              // "User" | "Account" — POV column
isv?: string              // ISV column (usually "N/A")
periode?: string          // Month name, e.g. "April" — derived from Roman numeral in UTR number
typologyText?: string     // Full typology description, e.g. "Structuring, Online Gambling Indicated"
tpa?: string              // Criminal category code, e.g. "PERJUDIAN"
tpaOther?: string         // TPA Other column (usually "N/A")
noSurat?: string          // No. Surat column (usually "N/A")
noteMark?: string         // Note/Mark column (usually "N/A")
utrGroupId?: string       // UUID linking all subjects from the same bundle
isGroupAnchor?: boolean   // true only on the first subject row — carries total trx/amount
perBankBreakdown?: Array<{ bank: string; count: number; amount: number }>
```

All fields are optional — the existing UTR-standard flow is untouched. Existing `tipologi` field stays as fallback for TPA when `tpa` is absent. `accountId` carries the Login ID (phone number, e.g. `62-87796113662`) for RISK_NOTES subjects.

---

### 2. File grouping — `src/components/FileUploader.vue`

**Problem:** Pass-2 grouper uses `docx.name.replace('.docx', '')` as the substring key. For `05.RISK_NOTES.UTR.IV.2026 (1).docx`, the base is `05.RISK_NOTES.UTR.IV.2026 (1)`, which does NOT match `WORKING_PAPER_05.RISK_NOTES.UTR.IV.2026_BCA (1).xlsx` because `_BCA` interrupts the match.

**Fix:** Strip trailing ` (N)` patterns from the base before the substring check:

```
"05.RISK_NOTES.UTR.IV.2026 (1)" → "05.RISK_NOTES.UTR.IV.2026"
```

Now all 5 xlsx files (`_BCA`, `_BNI`, `_BRI`, `_Permata`, `_Profil_Pengguna_Jasa`) are grouped with the docx automatically. One-line change.

---

### 3. New parser method — `src/services/parser.ts`

**Detection:** A bundle is RISK_NOTES type if it contains a file matching `*Profil_Pengguna_Jasa*`. Detection happens in `BatchWorkspace` before dispatching to the parser method.

**New method:** `parseRiskNotesBundle(files: File[], passwords?: Record<string, string>): Promise<UTREntry[]>`

**Steps:**

**3a. Classify files**
- Docx: the `.docx` file — RISK_NOTES narrative
- Profile xlsx: file whose name includes `Profil_Pengguna_Jasa`
- Bank xlsxs: remaining xlsx files (BCA, BNI, BRI, Permata)

**3b. Decrypt**
Same OLE decryption path as existing parser. One password applies to all files in the bundle. Throws `PasswordRequiredError` listing all locked files if password is absent.

**3c. Parse RISK_NOTES.docx**
Extract from filename and text:

- **UTR number**: from docx filename — strip extension, strip ` (N)` suffix, replace underscores with spaces.  
  `05.RISK_NOTES.UTR.IV.2026 (1).docx` → `05.RISK NOTES.UTR.IV.2026`
- **Source**: filename contains `RISK_NOTES` → `"Risk"`
- **Period**: Roman numeral from UTR number — the segment after `UTR.` and before the 4-digit year (e.g. `05.RISK NOTES.UTR.**IV**.2026` → `IV` → `"April"`). Mapping: I=January, II=February, III=March, IV=April, V=May, VI=June, VII=July, VIII=August, IX=September, X=October, XI=November, XII=December.
- **Typology text**: scan the text after the heading `Kesimpulan Hasil Investigasi` for known indicator phrases (case-insensitive): `Structuring`, `Online Gambling Indicated`, `Profile Deviation`, `Proceeds of Crime`, `Terrorism Financing`, `WMD Proliferation`. Join all found with `, `. If heading not found, scan the full document.
- **TPA**: keyword-to-category map applied to the typology text:
  - contains `gambling` or `judi` → `"PERJUDIAN"`
  - contains `fraud` or `penipuan` → `"PENIPUAN"`
  - contains `terrorism` or `teror` → `"TERORISME"`
  - contains `structuring` or `smurfing` → `"STRUKTURAL"`
  - fallback → `"TPPU"`

**3d. Parse profile xlsx**
Sheet `Profile`, rows 2–N. Columns: Nama (col 0), CIF (col 1), Login ID (col 2). Build subject list: `[{ name, cif, loginId }]`.

**3e. Parse bank xlsxs**
For each bank file:
- Sheet 0 (`Non Pay Merchant Outgoing`)
- Filter rows where `actor_role_id` (col 1) ∈ subject CIF set
- Aggregate: `{ bank: detectBankName(filename), count: matchedRows, amount: sum(actual_fund_amount col 13) }`

Bank name detection from filename: contains `BCA` → `"BCA"`, `BNI` → `"BNI"`, `BRI` → `"BRI"`, `Permata` → `"Permata"`.

Grand totals: `totalCount = sum of all bank counts`, `totalAmount = sum of all bank amounts`.

**3f. Build UTREntry[]**
One entry per subject (in profile order). Shared across all entries:
```
utrNumber, source, pov="User", isv="N/A", periode, typologyText, tpa,
tpaOther="N/A", noSurat="N/A", noteMark="N/A",
decision="REPORT", status="PENDING_REVIEW",
utrGroupId=crypto.randomUUID(), perBankBreakdown,
escalationSource="EMAIL", fccPic="", beneficiary="N/A",
escalationDate=new Date().toISOString()
```

Per-subject: `userName=subject.name`, `cif=subject.cif`, `accountId=subject.loginId`.

First subject only (`isGroupAnchor=true`): `transactionCount=totalCount`, `transactionAmount=totalAmount`. All others: `transactionCount=0`, `transactionAmount=0`.

---

### 4. BatchWorkspace — multi-entry handling — `src/views/BatchWorkspace.vue`

**Detection:** In `processAllBundles`, before dispatching each bundle:

```typescript
const isRiskNotes = files.some(f => f.name.includes('Profil_Pengguna_Jasa'))
```

**RISK_NOTES path:**
1. Create one placeholder entry (`status: 'EXTRACTING'`) per bundle
2. Call `parser.parseRiskNotesBundle(files, passwords)`
3. Remove placeholder
4. Add all N returned entries via `batchStore.addEntry()` — no AI call
5. All entries land in `PENDING_REVIEW` immediately

**Standard path:** unchanged.

Password handling: `PasswordRequiredError` is thrown by both paths, caught identically, retried with the same modal. No changes to the password flow.

---

### 5. Logbook export — `src/services/approval.ts`

New function: `generateLogbookExcel(batch: Batch): Blob`

Called from `handleCloseBatch` in BatchWorkspace instead of the current `generateApprovalExcel`. The existing `generateApprovalExcel` and `generateApprovalEmailBody` functions are kept but no longer called from the close-batch flow.

**Column mapping (A–X):**

| Col | Header | Value |
|-----|--------|-------|
| A | Batch | Numeric suffix of batchNumber (e.g. `4` from `BATCH-2026-APR-04`) |
| B | Source | `entry.source ?? "N/A"` |
| C | POV | `entry.pov ?? "N/A"` |
| D | No UTR | `entry.utrNumber` |
| E | NAMA PENGGUNA | `entry.userName` |
| F | CIF | `entry.cif` |
| G | Login ID | `entry.accountId` |
| H | ISV | `entry.isv ?? "N/A"` |
| I | PERIODE | `entry.periode ?? ""` |
| J | TYPOLOGY UTR | `entry.typologyText ?? entry.tipologi` |
| K | TPA | `entry.tpa ?? entry.tipologi` |
| L | TPA Other | `entry.tpaOther ?? "N/A"` |
| M | No. Surat | `entry.noSurat ?? "N/A"` |
| N | Note/Mark | `entry.noteMark ?? "N/A"` |
| O | Beneficiary/entity | `entry.beneficiary ?? "N/A"` |
| P | Tangal Eskalasi | escalationDate formatted `DD/MM/YYYY` |
| Q | Jumlah trx | `entry.isGroupAnchor ? entry.transactionCount : 0` |
| R | Nominal Trx | `entry.isGroupAnchor ? entry.transactionAmount : 0` |
| S | SLA Escalate to Approval | empty |
| T | Approval | empty |
| U | Send | empty |
| V | SLA Approval to Send | empty |
| W | FCC PIC | `entry.fccPic` |
| X | Account Closure Status | empty |

**Per-bank breakdown block** — one block per UTR group in the batch, each appended after the last subject row of that group, separated by 2 blank rows. Breakdown data is read from the `isGroupAnchor` entry of each group.

```
[blank row]
[blank row]
No UTR: 05.RISK NOTES.UTR.IV.2026        (in col D, as label)
Bank | Jumlah Trx | Nominal Trx           (in cols K–M)
BCA  | 71         | 315,036,899
BNI  | 17         | 40,872,516
BRI  | 53         | 83,923,588
Permata | 20      | 39,997,000
TOTAL | 161       | 479,830,003
```

If a batch contains multiple UTR groups (different UTR numbers), each group gets its own breakdown block. Entries without `perBankBreakdown` (standard UTR-format entries) emit no breakdown block.

Batch number extraction for column A: `/(\d+)$/.exec(batchNumber)?.[1]` parsed as integer (e.g. `"BATCH-2026-APR-04"` → `4`).

---

## Out of scope

- Approval email / mailto — removed from close-batch flow for now
- SLA computation — columns S and V remain empty (manual fill)
- FCC PIC auto-fill — remains empty (manual fill)
- Account Closure Status — remains empty
- AI investigation for RISK_NOTES bundles

---

## File change summary

| File | Change |
|------|--------|
| `src/types/utr.ts` | Add 9 optional fields to `UTREntry` |
| `src/components/FileUploader.vue` | Strip ` (N)` from base in pass-2 grouper (1 line) |
| `src/services/parser.ts` | Add `parseRiskNotesBundle()` method |
| `src/views/BatchWorkspace.vue` | RISK_NOTES detection + multi-entry add path |
| `src/services/approval.ts` | Add `generateLogbookExcel()`, update `handleCloseBatch` |
