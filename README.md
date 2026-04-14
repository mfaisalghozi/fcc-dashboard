# LTKM Zone 2 MVP — Batch Workspace

Vue 3 + TypeScript MVP for the Logbook & Approval zone of PT EDIK's LTKM automation platform.

## What this does

Users upload UTR document bundles (.docx analysis + .xlsx working paper). The system:

1. Parses the documents to extract transaction data
2. Runs the 5W2H investigation via Claude API
3. Auto-populates logbook fields
4. Accumulates entries in the current open batch
5. On batch close: generates the approval Excel and opens an Outlook mailto: draft

## Setup

```bash
cp .env.example .env
# Edit .env and add your Anthropic API key

npm install
npm run dev
```

Open http://localhost:5173

## Architecture

```
src/
├── types/utr.ts              TypeScript contracts
├── services/
│   ├── parser.ts             mammoth.js + SheetJS document extraction
│   ├── investigation.ts      Claude API 5W2H + tipologi agent
│   └── approval.ts           Excel generation + email template
├── stores/batch.ts           Pinia store for batch state
├── components/
│   ├── FileUploader.vue      Drag-drop upload zone
│   └── EntryList.vue         UTR entries in current batch
└── views/BatchWorkspace.vue  Main page
```

## Testing with real UTR files

Name your test files with the UTR number in the filename for auto-detection:

```
UTR-2026-001234-analysis.docx
UTR-2026-001234-workpaper.xlsx
```

The parser will group files with the same UTR prefix into one bundle.

## Production considerations

This is an MVP with known shortcuts that should be fixed before production:

1. **API key in browser** — The `dangerouslyAllowBrowser: true` flag exposes your Anthropic key to the browser. Move the investigation agent to a backend service before deploying.
2. **localStorage for batch numbering** — Replace with proper database (PostgreSQL).
3. **No auth** — Add SSO integration (DANA internal).
4. **mailto: for email** — Upgrade to Microsoft Graph API for proper email composition and reply tracking.
5. **No persistence** — Batch data is lost on page refresh. Add database persistence.
6. **No review modal** — The EntryList emits `review` events that currently just log. Build a full review modal for field editing.

## Next zones

- Zone 1 (Investigation): already partially built — the `InvestigationAgent` service can be extracted
- Zone 3 (Reporting): browser automation via Playwright on a backend worker
