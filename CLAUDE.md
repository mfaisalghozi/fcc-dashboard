# CLAUDE.md

# LTKM Automation Platform — Project Context for Claude Code

> **Read this file first.** It contains everything you need to understand the project's purpose, architecture, domain constraints, and current state before writing any code.

---

## 1. Project overview

**Project name:** LTKM Automation Platform (internal codename: "FCC Agent")

**One-line description:** A web-based dashboard that automates the reporting of Suspicious Transaction Reports (LTKM) from PT EDIK (DANA Indonesia) to PPATK (Indonesia's Financial Intelligence Unit).

**Business context:** PT EDIK is a licensed payment service provider. Under Indonesian AML regulations (UU No. 8/2010, Peraturan Bank Indonesia No. 10/2024, PPATK regulations), it is legally required to report suspicious financial transactions to PPATK via the GoAML system within strict SLA windows (3 business days from escalation to approval, 3 more business days from approval to submission).

**The problem we're solving:** The FCC (Financial Crime Compliance) team currently performs this entire workflow manually — from investigating flagged transactions to filling government web forms. Each UTR (Unusual Transaction Report) takes 50-80 minutes of manual work. At 30-50 UTRs per month, this consumes roughly one full-time headcount's worth of repetitive, rule-based work.

**Our solution:** An agentic AI workflow system that automates ~70% of the pipeline while keeping humans in control at every compliance checkpoint. The AI proposes, the human disposes.

---

## 2. The user — who you're building for

**Primary user:** FCC Pelapor (reporter) — a compliance officer at PT EDIK's Legal & Compliance department. They receive UTR escalations, investigate them, document findings, get approval from the Pejabat APUPPT (AML/CFT Officer), and submit reports to PPATK.

**User's current pain points:**

- Manually reading every UTR document to extract key facts (5W2H framework)
- Typing the same 18 fields into an Excel logbook for every UTR
- Creating pivot tables in Excel for approval emails
- Logging into GoAML (government system) and RACE (internal system) to fill long forms
- Daily manual checks of GoAML to see if reports were accepted or rejected
- Stress of meeting 3-business-day SLAs

**User's tech comfort:** Medium. They use Excel daily, navigate SharePoint, work with email-based approvals. Not developers. UI must be obvious, not clever.

**Language context:** Users speak bilingual Indonesian/English. The app UI is in English, but generated outputs (email bodies, report narratives) are in formal Indonesian. Technical terms like "tipologi", "LTKM", "UTR", "pelapor", "eskalasi" stay in Indonesian because they're regulatory vocabulary.

---

## 3. The regulatory workflow we're automating

The SOP defines 7 sequential stages. Understanding this flow is essential — the software architecture mirrors it directly.

**Stage 1 — UTR Escalation (from AML Operations to FCC).** AML Operations detects a suspicious transaction via the Transaction Monitoring System (TMS) or other alerts. They escalate to FCC through two channels: the Case Manager system (status flips to "TL Confirm") or an email with subject "UNUSUAL TRANSACTION REPORT ESCALATION". The FCC Pelapor monitors both daily.

**Stage 2 — Investigation & Analysis.** The Pelapor downloads the UTR document bundle from SharePoint — typically an analysis document (.docx), a working paper with transaction data (.xlsx), and optionally a user profile. They analyze using the 5W2H framework: What transaction, Why suspicious, Who involved, When, Where, How (modus operandi), How Much (nominal + count). They compare findings against the internal LTKM matrix (7 categories of suspicious activity) and decide: REPORT, NON_REPORT, or REJECT.

**Stage 3 — Logbook Documentation.** The Pelapor records 18 fields in the FCC internal logbook (Excel on SharePoint): batch number, source, UTR number, user info, CIF, account ID, tipologi, criminal association, beneficiary, escalation date, transaction count/amount, and more. Both REPORT and NON_REPORT decisions are logged (with justification for NON_REPORT).

**Stage 4 — Approval Request.** The Pelapor accumulates confirmed UTRs into a batch, generates a pivot table summary in Excel, and emails it to the Pejabat APUPPT for approval. The email follows a strict SOP format: subject `STR APPROVAL - (MONTH YEAR) BATCH N`.

**Stage 5 — Approval Response.** The Pejabat APUPPT reviews the batch, approves or requests changes via email reply. Tanggal approval is stamped in the logbook.

**Stage 6 — Report Submission.** For each approved UTR, the Pelapor submits to PPATK via GoAML. Two paths exist: (a) for UTRs originating from TMS User alerts, generate XML via the internal RACE system (`race.dana.local`) then upload the XML to GoAML; (b) for all other UTR types, fill the GoAML web report form manually. Both paths require attaching the UTR documents and entering the 5W+1H narrative as "Alasan Pelaporan".

**Stage 7 — Status Monitoring & Receipt.** The Pelapor checks GoAML daily for status: "P - Processed" (accepted, green indicator) or "R - Rejected" (red, requires correction within 3 business days, status becomes "O - Reverted"). When accepted, PPATK emails a PDF receipt which the Pelapor saves to SharePoint.

**SLAs (strict, regulatory):**

- Escalation → Approval: ≤ 3 business days
- Approval → Report submission: ≤ 3 business days
- Rejection → Corrected resubmission: ≤ 3 business days

**Business days = Indonesian business calendar** (exclude weekends and Indonesian public holidays — this matters for SLA math).

---

## 4. Automation architecture — three zones

The platform is organized into three independent automation zones. Each can be developed, deployed, and used separately. A zone card on the main dashboard routes to each zone's workspace.

**Zone 1 — Investigation & Analysis UTR** (Stages 1-2 above)

- Automates: SharePoint document retrieval, 5W2H extraction via LLM, tipologi classification against the LTKM matrix, decision recommendation
- Tech: Claude API (Anthropic SDK) for extraction, mammoth.js for .docx parsing, SheetJS for .xlsx parsing, Vue review UI for Pelapor confirmation
- Status: **Partially built** — the `InvestigationAgent` service exists in Zone 2 MVP and can be extracted

**Zone 2 — Logbook Registration & Approval** (Stages 3-5 above)

- Automates: Logbook field auto-population (14 of 18 fields auto-fillable), batch accumulation, approval pivot table generation as Excel, approval email composition
- Tech: Vue 3 + TypeScript frontend, Pinia store for batch state, SheetJS for Excel generation, mailto: for MVP (Microsoft Graph API later)
- Status: **MVP built** — this is the current working implementation (see repo structure below)

**Zone 3 — Drafting & Reporting** (Stages 6-7 above)

- Automates: GoAML web form filling (browser automation), RACE XML generation, daily status monitoring, rejection handling with auto-fix, receipt PDF archival to SharePoint
- Tech: Playwright for browser automation (runs on backend server, not in browser), scheduled jobs via node-cron, Microsoft Graph API for receipt email monitoring
- Status: **Not started** — designed but not implemented

---

## 5. Repository structure (current state)

```
ltkm-zone2-mvp/
├── CLAUDE.md                    <- YOU ARE READING THIS
├── README.md                    <- Setup instructions
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── .env.example                 <- Copy to .env, add Anthropic API key
└── src/
    ├── main.ts                  <- App entry point, mounts BatchWorkspace
    ├── types/
    │   └── utr.ts               <- All TypeScript contracts: UTREntry, Batch, FiveW2H, etc.
    ├── services/
    │   ├── parser.ts            <- mammoth + SheetJS document extraction
    │   ├── investigation.ts     <- Claude API call for 5W2H + tipologi classifier
    │   └── approval.ts          <- Excel generation + email template composition
    ├── stores/
    │   └── batch.ts             <- Pinia store: current batch state, metrics, actions
    ├── components/
    │   ├── FileUploader.vue     <- Drag-drop upload zone with file grouping
    │   └── EntryList.vue        <- Displays batch entries with status badges
    └── views/
        └── BatchWorkspace.vue   <- Main Zone 2 page (current default route)
```

**Note:** The current MVP only has Zone 2. The dashboard landing page (with 3 zone cards) and Zone 1 / Zone 3 workspaces are not yet built.

---

## 6. Tech stack decisions — and why

**Frontend:** Vue 3 (Composition API) + TypeScript + Vite + Pinia. Chosen because the primary developer works with this stack daily at DANA on the `dana-transaction` and `dana-game` codebases. Zero learning curve, maximum velocity.

**Styling:** Scoped component styles, no Tailwind or UI library. Keeping it lean for the MVP — we can add a component library (PrimeVue, Vuetify) later if needed.

**AI:** Anthropic Claude API via the official SDK (`@anthropic-ai/sdk`). Model: `claude-opus-4-6` for investigation (accuracy matters, latency tolerable), could downgrade to Sonnet for cost optimization later. **Important:** The MVP uses `dangerouslyAllowBrowser: true` which exposes the API key — this is a known shortcut for demo purposes only. Before any real deployment, move the investigation agent to a backend proxy.

**Document parsing:** `mammoth` for .docx (extracts clean text from Word), `xlsx` (SheetJS) for .xlsx (reads transaction tables). Both work client-side.

**State:** Pinia (successor to Vuex). Batch state lives in `stores/batch.ts`. Currently uses localStorage for batch number persistence — replace with PostgreSQL before production.

**Browser automation (Zone 3, not yet built):** Playwright. Will run on a backend Node.js worker, not in the browser. Communicates with frontend via WebSocket for status updates.

**Email integration (future):** Microsoft Graph API for proper Outlook draft creation, reply detection, and receipt monitoring. MVP uses `mailto:` links as a placeholder.

**Database (future):** PostgreSQL for logbook persistence, batch history, audit trail. Prisma or Drizzle ORM. SQLite acceptable for early prototype.

---

## 7. Domain terminology — key terms you'll see in code

| Term                | Meaning                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| LTKM                | Laporan Transaksi Keuangan Mencurigakan (Suspicious Transaction Report)        |
| STR                 | Suspicious Transaction Report (English equivalent of LTKM)                     |
| UTR                 | Unusual Transaction Report — internal doc created by AML Ops before FCC review |
| PPATK               | Pusat Pelaporan dan Analisis Transaksi Keuangan (Indonesia's FIU)              |
| GoAML               | PPATK's official reporting system (https://goaml.ppatk.go.id/)                 |
| RACE                | Reporting AML Compliance Environment — internal DANA system for XML generation |
| TMS                 | Transaction Monitoring System — detects unusual transactions                   |
| CIF                 | Customer Information File — internal customer ID                               |
| Pelapor             | The reporter (FCC compliance officer executing the workflow)                   |
| Pejabat APUPPT      | AML/CFT Officer who approves LTKM submissions                                  |
| FCC                 | Financial Crime Compliance (the team/department)                               |
| AML / APU           | Anti-Money Laundering / Anti Pencucian Uang                                    |
| PPT                 | Pencegahan Pendanaan Terorisme (Counter-Terrorism Financing)                   |
| Tipologi            | Typology/category of suspicious transaction pattern                            |
| 5W2H                | What, Why, Who, When, Where, How, How Much — investigation framework           |
| Eskalasi            | Escalation (from AML Ops to FCC)                                               |
| TL Confirm          | Case Manager status indicating AML Ops has escalated                           |
| Batch               | A group of UTRs submitted together for approval                                |
| Alasan Pelaporan    | "Reason for reporting" — free-text field in GoAML                              |
| Reporting Indicator | Code in GoAML matching the tipologi category                                   |
| DTTOT               | Daftar Terduga Teroris & Organisasi Teroris (terrorism suspects list)          |
| SIPENDAR            | Sistem Informasi Pendanaan Terorisme (terrorism financing info system)         |
| DPPSPM              | Daftar Pendanaan Proliferasi Senjata Pemusnah Massal (WMD financing list)      |
| TPPU                | Tindak Pidana Pencucian Uang (Money Laundering Crime)                          |

---

## 8. Design principles — how to think about changes

**Human-in-the-loop at every regulatory decision.** The AI proposes, the human disposes. Never auto-submit anything to PPATK without explicit human click. Never finalize a "Report" decision without Pelapor confirmation. The system can pre-fill, suggest, and draft — but it cannot act unilaterally on compliance-relevant actions.

**Full audit trail.** Every automated action logs timestamp, inputs, outputs, and user context. Screenshots for browser automation. This isn't optional — it's a compliance requirement. When adding new features, ask: "Could an auditor reconstruct what happened and why?"

**SLA-aware by default.** Every feature that touches a UTR should respect the 3-business-day clocks. Dashboards should surface SLA warnings prominently. Batch operations should flag items approaching deadlines.

**Fail safe, not fast.** If document parsing fails, show a clear error — do not silently skip. If the AI is uncertain (low confidence score), surface that to the human. If GoAML rejects a submission, preserve the draft for correction rather than discarding.

**Incremental deployment.** Each zone is independent. A user can use Zone 2 today without Zone 1 or Zone 3 existing. Features should degrade gracefully when upstream zones are incomplete.

**Indonesian compliance vocabulary in user-facing text.** Use the terminology in Section 7. Do not translate "UTR" to "Report" or "Pelapor" to "Reporter" in the UI — that would confuse users who read it alongside the SOP documents.

---

## 9. Current known shortcuts and limitations

These are deliberate MVP compromises. Flag them if touching related code:

1. **API key exposed to browser** (`dangerouslyAllowBrowser: true` in `investigation.ts`). Move to backend proxy before deployment.
2. **localStorage for batch numbering.** Replace with database persistence.
3. **No user authentication.** Add SSO (DANA internal identity provider) before deployment.
4. **mailto: links instead of Graph API.** Upgrade for proper email integration and reply tracking.
5. **No data persistence.** Batch state is lost on page refresh. Add database.
6. **Entry review modal is stubbed.** Clicks on entries emit `review` events but no modal exists. Needs building.
7. **No landing dashboard.** The app currently opens directly to Zone 2. A dashboard with 3 zone cards needs building.
8. **No routing.** Single-page setup. Add Vue Router when building multiple zones.
9. **Parser uses filename regex for UTR number detection.** Fragile. Upgrade to content-based detection.
10. **Tipologi matrix hardcoded in `investigation.ts` prompt.** Move to a structured config file that compliance can update without developer intervention.

---

## 10. What to build next — priority order

When the user (human developer) asks "what should we build next", suggest this order:

1. **Landing dashboard with 3 zone cards.** The app entry point. Routes to each zone's workspace. Low complexity, high UX impact.
2. **Review modal component.** Opens when clicking an entry in the batch list. Shows AI's 5W2H extraction with editable fields, confidence indicators, and accept/override actions. Critical for Zone 2 to feel complete.
3. **Backend proxy for Claude API.** Small Express/Fastify server that holds the API key. Deployable to the developer's home lab (Ubuntu + Docker + Tailscale mesh).
4. **Vue Router + multi-page setup.** Prerequisite for zones 1 and 3.
5. **Database persistence.** Swap localStorage for PostgreSQL. Keep the Pinia store API, change only the implementation layer.
6. **Zone 1 workspace.** Extract the existing `InvestigationAgent` into its own page with document upload + review UI. Can largely reuse Zone 2 components.
7. **Zone 3 reporting agent.** This is the big one — Playwright-based browser automation on a backend worker. Needs its own architecture document before coding.

---

## 11. Conventions to follow

**File naming:** PascalCase for Vue components (`BatchWorkspace.vue`), camelCase for services and composables (`parser.ts`, `useBatch.ts`), kebab-case for directories.

**Imports:** Use the `@/` alias for `src/` imports. Never use relative imports beyond `./`.

**TypeScript strictness:** `strict: true` is on. No `any`. Use proper types from `@/types/utr.ts` or extend them if needed.

**Component style:** Composition API with `<script setup lang="ts">`. No Options API.

**Error handling:** User-facing errors go into a ref + displayed in the UI. Console errors are fine for developer debugging but not sufficient as the only error path.

**Indonesian strings in code:** OK when they're compliance vocabulary (see Section 7) or user-facing labels that should stay in Indonesian. Not OK when they're variable names or internal identifiers — those stay in English.

**Commits:** Small, focused. One logical change per commit. Commit messages describe the what and why, not the how.

---

## 12. Reference documents

These exist in the project owner's head / notes but aren't in the repo. If you need deeper context on any of these, ask:

- PT EDIK Working Instruction for LTKM Reporting (internal SOP, draft version)
- Peraturan Kepala PPATK No. PER-09/1.02.2/PPATK/09/12 (reporting procedure regulation)
- Peraturan PPATK Nomor 14 Tahun 2021 (GoAML usage technical guidance)
- Surat Edaran Kepala PPATK No. 03 Tahun 2015 (suspicious transaction indicators)
- Original workflow diagrams (4 Miro flowchart images provided to the platform designer)
- LTKM Automation Blueprint PDF (the detailed design document)

---

## 13. How to work with this codebase

When given a task, follow this order:

1. **Read this file completely.** You're doing that now. Good.
2. **Understand which zone the task affects.** Most UI tasks will be Zone 2 (current focus).
3. **Check the type definitions first.** `src/types/utr.ts` is the contract. If your change requires new data shapes, update types first, then propagate.
4. **Respect the service boundary.** Business logic (parsing, AI calls, Excel generation) lives in `src/services/`. Components should not call APIs directly — they call services.
5. **State changes go through the store.** Don't mutate `currentBatch` from a component. Add actions to `batch.ts`.
6. **Test with real UTR file naming.** Use `UTR-2026-001234-analysis.docx` pattern so the file grouper works.
7. **Run `npm run build` before declaring done.** The TypeScript compiler catches issues the dev server ignores.
8. **When unsure about domain logic, ask.** Compliance requirements are specific — don't guess. Ask the human what the SOP requires.

When the human says something ambiguous, prefer asking for clarification over guessing. The domain has too many subtleties (business days, batch numbering conventions, email subject formats) where a wrong guess wastes time.

---

_End of context file. Keep this current as the project evolves — stale context is worse than none._

# Technical Overview

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Type-check (vue-tsc) + production build
npm run preview   # Preview production build locally
```

There is no test suite. Manual testing uses real or mock UTR document bundles — see "Testing" below.

## Setup

```bash
cp .env.example .env   # Add VITE_ANTHROPIC_API_KEY
npm install
npm run dev
```

## Architecture

This is a Vue 3 SPA for PT EDIK's AML automation platform — specifically the **Logbook & Approval zone** (Zone 2) for Suspicious Transaction Reports (UTR/LTKM).

**Data flow:** Upload UTR documents → parse → run Claude investigation agent → auto-populate logbook → accumulate in batch → close batch to generate approval Excel and mailto: draft.

**Layers:**

```
src/types/utr.ts              Core TypeScript contracts (UTREntry, Batch, Transaction, FiveW2H, etc.)
src/services/
  parser.ts                   mammoth.js (.docx) + SheetJS (.xlsx) extraction; groups files by UTR prefix
  investigation.ts            Claude API agent (claude-opus-4-6); produces 5W2H + tipologi + decision
  approval.ts                 Excel generation (SheetJS CDN) + Outlook mailto: template
src/stores/batch.ts           Pinia store; single source of truth for batch state and computed metrics
src/components/
  FileUploader.vue            Drag-drop upload, triggers parser then investigation agent
  EntryList.vue               UTR entries display; emits `review` events (review modal not yet built)
src/views/BatchWorkspace.vue  Root view, composes all components
```

**UTR entry lifecycle:**  
`EXTRACTING` → `PENDING_REVIEW` → decision set → `BATCHED` → (batch close) → `APPROVAL_SENT`

**State:** All batch state lives in `useBatchStore` (Pinia). Key actions: `addEntry()`, `updateEntry()`, `removeEntry()`, `closeBatch()`. Batch numbering persists in `localStorage`.

**Claude integration:** `InvestigationAgent` in `services/investigation.ts` calls the Anthropic SDK with `dangerouslyAllowBrowser: true` — the API key is exposed in the browser. This is a known MVP shortcut; move to a backend before deploying.

## Testing

Name test files with the UTR number prefix for auto-detection and grouping:

```
UTR-2026-001234-analysis.docx
UTR-2026-001234-workpaper.xlsx
```

## Known MVP Shortcuts (pre-production blockers)

1. **API key in browser** — `dangerouslyAllowBrowser: true` exposes the Anthropic key; needs backend proxy
2. **localStorage batch numbering** — replace with PostgreSQL
3. **No auth** — needs DANA internal SSO
4. **mailto: email** — upgrade to Microsoft Graph API
5. **No persistence** — batch data is lost on page refresh
6. **No review modal** — `EntryList` emits `review` events that currently only log; modal needs to be built
