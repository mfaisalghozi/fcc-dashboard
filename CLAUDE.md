# CLAUDE.md

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
