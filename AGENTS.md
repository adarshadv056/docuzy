# Docuzy

AI-powered document workspace (pre-launch MVP): users upload documents (PDFs,
images/scans), text is extracted, then chunked → embedded (pgvector) → retrieved
for AI chat. Standalone client-side PDF/image tools live under `app/tools/`.

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Known Next 16 differences active in this repo:
- Route protection uses `proxy.ts` at the root (middleware was renamed to proxy).
- Server Action request bodies are capped at 1MB by default
  (`experimental.serverActions.bodySizeLimit`); uploads flow through
  `actions/upload.ts`, so large files silently fail without config.

## Commands

- Dev: `npm run dev` · Build: `npm run build` · Lint: `npm run lint`
- Typecheck (no script): `npx tsc --noEmit`
- No test framework is configured.

## Prisma / database

- Schema-first via `npx prisma db push` — there is NO migrations history.
- pgvector is declared in the datasource extensions; vector columns use
  `Unsupported("vector")` and require raw SQL for similarity queries.
- After any schema change: `npx prisma generate`, then confirm the new model
  fields actually exist in the generated client — stale generated clients have
  already caused drift in this repo (`lib/generated/prisma` is gitignored and
  currently outdated; app code imports from `@prisma/client`).

## Environment

`.env` (gitignored): DATABASE_URL, AUTH_SECRET, GOOGLE_CLIENT_ID,
GOOGLE_CLIENT_SECRET, BLOB_READ_WRITE_TOKEN, GEMINI_API_KEY, GA_ID.

## Extraction pipeline

Uploads go through `actions/upload.ts` → `lib/processors/extractor.ts`.

**PDFs — per-page hybrid:**
1. `pdfjs-dist` (via `serverExternalPackages`) extracts text per page.
2. Images on each page are detected via operator list, encoded with `sharp`,
   and sent to Gemini Flash (`describeImage`) for alt-text.
3. **IMG_HEAVY routing**: if any page's image pixel-area ≥ 100% of page area,
   the pipeline aborts early and routes the *whole PDF* to
   `transcribeDocument()` — Gemini sees the layout natively, producing
   labeled output identical to an image upload. This is the path taken for
   scanned documents and visual IDs.
4. Fallback chain: pdf-parse density check → whole-doc Gemini vision.

Flags (`SPARSE`, `IMG_HEAVY`, `FRAGMENTED`) are logged for diagnostics but
never gate storage — extracted content is always persisted.

**Images:** sent directly to Gemini (`describeImage`).

**Text files:** read as UTF-8, no processing.

Key constants in `extractor.ts`: `IMAGE_COVERAGE_THRESHOLD = 1.0`,
`IMAGE_WAIT_TIMEOUT_MS = 3000`, `MAX_IMAGES_PER_DOC = 50`,
`MIN_CHARS_PER_PAGE = 200`.

## Conventions

- Path alias: `@/*` maps to the repo root (there is no `src/`).
- Auth checks are three-layered by design: `proxy.ts` route guard → `auth()`
  check in the page → ownership re-check inside every server action/route.
  Copy the pattern in `actions/upload.ts`; never trust a client-sent ID alone.
- `rag-backend/` contains only an unused Python venv — there is no Python
  service; do not build against it.
- `CLAUDE.md` simply imports this file (`@AGENTS.md`); keep guidance here.
