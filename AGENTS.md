# AGENTS.md — fcc-dashboard (LTKM Automation Platform)

> Start with `CLAUDE.md` for full domain/regulatory context. This file covers only agent-relevant technical gotchas.

---

## Commands

```bash
npm run dev       # Dev server at http://localhost:5173 (strictPort — fails if occupied)
npm run build     # vue-tsc --noEmit THEN vite build (type errors block the build)
npm run test      # vitest run (single-pass)
npm run test:watch # vitest (watch mode)
npm run preview   # preview production build
```

**No CI pipeline exists.** Run `npm run build` manually before declaring work done — `vue-tsc` catches errors the dev server silently ignores.

---

## Setup

```bash
cp .env.example .env   # add VITE_ANTHROPIC_API_KEY=sk-ant-...
npm install
npm run dev
```

Single env var: `VITE_ANTHROPIC_API_KEY`. Nothing else required.

Node 25.9.0 is pinned via Volta. If `npm run build` fails strangely, check your active Node version.

---

## Architecture at a glance

**Two active routes** (Vue Router 4, Web History):

| Path | View | Zone |
|------|------|------|
| `/` | `HomeView.vue` | Landing — 3 zone cards |
| `/logbook` | `BatchWorkspace.vue` | Zone 2 — Logbook & Approval (fully built) |

Zone 1 (Investigation) and Zone 3 (GoAML Reporting) buttons are disabled in the UI — the views don't exist yet.

**Layer contract** — enforce this when adding features:
```
types/utr.ts         ← change data shapes here first
services/            ← all business logic (parser, investigation, approval)
stores/batch.ts      ← all state mutations; components never mutate state directly
components/          ← UI only; call services and dispatch store actions
views/               ← compose components; read store via computed
```

Components must not call the Claude API or file parsers directly — that belongs in `services/`.

---

## TypeScript

- `strict: true` — no `any`, ever
- Path alias `@/` → `src/` — use for all cross-directory imports; never relative paths beyond `./`
- Module resolution is `bundler` (Vite-native), not `node`
- Component style: `<script setup lang="ts">` only; no Options API

---

## Testing

- Runner: **Vitest** with `globals: true` — `describe`/`it`/`expect` are available without importing
- Environment: jsdom + custom `localStorage` mock in `src/test/setup.ts` (required because jsdom 29 + Node 25 doesn't expose a working `localStorage`)
- Test files: `src/**/__tests__/*.test.ts`
- Existing test coverage: `stores/batch.ts`, `services/approval.ts`, `services/parser.ts`

Run a focused file:
```bash
npx vitest run src/stores/__tests__/batch.test.ts
```

---

## Key domain types (`src/types/utr.ts`)

`UTREntry` lifecycle (do not skip states):
```
EXTRACTING → PENDING_REVIEW → CONFIRMED → APPROVED → REPORTED
                           ↘ REJECTED
```

`Decision`: `'REPORT' | 'NON_REPORT' | 'REJECT'`

`Batch` status: `'OPEN' | 'CLOSED' | 'SENT' | 'APPROVED' | 'COMPLETE'`

When adding new fields to `UTREntry`, update `src/types/utr.ts` first, then propagate to services and store.

---

## Parser quirks (`src/services/parser.ts`)

Two distinct bundle types — the parser auto-detects which path to take:

1. **Standard UTR bundle** — one `.docx` + one `.xlsx`
2. **RISK_NOTES bundle** — one `.docx` + `profil_pengguna_jasa.xlsx` + one or more bank `.xlsx` files; returns `UTREntry[]` (multiple subjects), first entry is the group anchor

Password-protected Office files throw `PasswordRequiredError` (custom class with `lockedFiles: string[]`). The `FilePasswordModal.vue` component handles the retry flow.

Test files live in `utr-example/` — name them `UTR-YYYY-NNNNNN-*.docx/xlsx` for the grouper to work.

---

## `xlsx` (SheetJS) dependency

Installed from a SheetJS CDN tarball URL, not the npm registry:
```
"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

Do not try to upgrade this via `npm update xlsx` — the version is pinned deliberately.

---

## Known pre-production shortcuts (do not "fix" without understanding the impact)

| Shortcut | Location | Impact |
|---|---|---|
| `dangerouslyAllowBrowser: true` | `services/investigation.ts` | Exposes API key in browser bundle |
| `localStorage` for batch numbering | `stores/batch.ts` | Batch state lost on refresh |
| No auth | global | Anyone with the URL can use the app |
| `mailto:` links for email | `services/approval.ts` | No reply tracking or draft persistence |

These are documented in `CLAUDE.md §9` as deliberate MVP compromises.

---

## Batch numbering

Format: `BATCH-{YEAR}-{MON}-{NN}` (e.g., `BATCH-2026-MAY-01`)

Persisted in `localStorage`:
- Counter key: `batch-count-{year}-{month}`
- Current batch key: `current-batch-number`

`closeBatch()` in the store clears the current-batch-number key.

---

## What CLAUDE.md says that is now outdated

CLAUDE.md was written before several features shipped. Trust the code over CLAUDE.md on:

- "No routing" — Vue Router is live with two routes
- "Review modal is stubbed" — `ReviewModal.vue` exists and is wired up
- "No landing dashboard" — `HomeView.vue` exists with 3 zone cards
