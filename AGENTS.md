# Docuzy

AI-powered document workspace (pre-launch MVP): users upload documents (PDFs,
images/scans), text is extracted, then chunked → embedded (pgvector) → retrieved
for AI chat. **Chunking and embedding are implemented; retrieval and the AI
chat are NOT yet** — the `DocumentChunk.embedding` column is populated at upload,
but nothing queries it. Standalone client-side PDF/image tools live under
`app/tools/`.

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
- `DocumentChunk` has `content`, `chunkIndex`, `metadata Json?`, and
  `embedding Unsupported("vector")?` — the embedding column is populated at
  upload via raw SQL (see Embeddings section); nothing queries it yet.

## Environment

`.env` (gitignored): DATABASE_URL, AUTH_SECRET, GOOGLE_CLIENT_ID,
GOOGLE_CLIENT_SECRET, BLOB_READ_WRITE_TOKEN, GEMINI_API_KEY, GA_ID,
GEMINI_EMBEDDING_MODEL.

## Embeddings (`lib/gemini.ts` + `actions/upload.ts`)

- `embedTexts(texts)` → `number[][]` calls `models.embedContent` with
  `text-embedding-004` by default (override via `GEMINI_EMBEDDING_MODEL`).
  Batch — one API call for all chunk texts, NOT a per-chunk loop.
- Vectors are written with raw `$executeRaw` — `embedding` is
  `Unsupported("vector")`, so the typed Prisma client can't write it. `upload.ts`
  does `createMany` (rows, empty embedding) → `findMany` to get row ids →
  a single `UPDATE ... FROM unnest(...)` batches all vectors.
- This means uploads are synchronous: a large doc adds one embed call + one
  batched UPDATE. None of this runs when chunks are absent.

## Extraction pipeline

Uploads go through `actions/upload.ts` → `lib/processors/extractor.ts` →
`lib/processors/chunker.ts`.

**PDFs — per-page hybrid (`extractor.ts`):**
1. `pdfjs-dist` (via `serverExternalPackages`) extracts text per page.
2. Images on each page are detected via operator list, encoded with `sharp`,
   and sent to Gemini Flash (`describeImage`) for per-crop alt-text.
3. **IMG_HEAVY routing**: if any page's image pixel-area ≥ 100% of page area,
   the pipeline aborts early and routes the *whole PDF* to
   `transcribeDocument()` — Gemini sees the layout natively, producing
   labeled output identical to an image upload. This is the path taken for
   scanned documents and visual IDs. **Known limitation:** this is whole-doc,
   not per-page — a single image-heavy page discards the other pages' pdfjs
   text.
4. Fallback chain: pdf-parse density check → whole-doc Gemini vision.

Flags (`SPARSE`, `IMG_HEAVY`, `FRAGMENTED`) are logged for diagnostics but
never gate storage — extracted content is always persisted.

**Images:** sent directly to Gemini as a whole (`transcribeDocument`).
`describeImage` is only used for per-crop descriptions inside PDF pages.

**Text files:** read as UTF-8, no processing.

Key constants in `extractor.ts`: `IMAGE_COVERAGE_THRESHOLD = 1.0`,
`IMAGE_WAIT_TIMEOUT_MS = 3000`, `MAX_IMAGES_PER_DOC = 50`,
`MIN_CHARS_PER_PAGE = 200`.

## Chunking (`lib/processors/chunker.ts`)

`chunkDocument(text, extractionMethod)` → `DocumentChunkData[]`. Wired into
`upload.ts` via `prisma.documentChunk.createMany` (chunks are created after the
document row; they cascade on delete). Pure functions, no deps, no test file.

- Strips `--- Page N ---` markers, chunks the whole body continuously
  (paragraphs → sentences → hard split) with ~300-char overlap, then maps each
  chunk back to `pageNumbers` in metadata.
- **Known bug:** the chunk→page mapping locates chunks via `indexOf`, which
  misassigns `pageNumbers` when overlap text repeats across chunks. Don't rely
  on `metadata.pageNumbers` accuracy until fixed — preferred fix is thread
  true source offsets out of `splitLargeText` instead of substring search.
- `MAX_CHUNK_SIZE = 3000` (chars, not tokens) and `OVERLAP_SIZE = 300`.

## pdfjs page rasterization (server-side)

- pdfjs v5 ships an internal `NodeCanvasFactory` that auto-loads
  `@napi-rs/canvas` on Node — no custom canvas factory is needed.
- `@napi-rs/canvas@0.1.100` is already installed as pdfjs-dist's
  optionalDependency, so a page can be rendered to PNG without adding deps:
  `page.render({ canvasContext: ctx, viewport })` then
  `canvas.toBuffer("image/png")`. This is the enabler for per-page Gemini
  vision (instead of the current whole-doc IMG_HEAVY routing).

## Conventions

- Path alias: `@/*` maps to the repo root (there is no `src/`).
- Auth checks are three-layered by design: `proxy.ts` route guard → `auth()`
  check in the page → ownership re-check inside every server action/route.
  Copy the pattern in `actions/upload.ts`; never trust a client-sent ID alone.
- `rag-backend/` contains only an unused Python venv — there is no Python
  service; do not build against it.
- `CLAUDE.md` simply imports this file (`@AGENTS.md`); keep guidance here.
