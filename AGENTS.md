# Docuzy

AI-powered document workspace (pre-launch MVP): users upload documents (PDFs,
images/scans), text is extracted, then chunked → embedded (pgvector) → retrieved
for AI chat. **Chunking, embedding, retrieval, and the streaming AI chat are
implemented.** Vectors are populated at upload and queried via the chat route.
Standalone client-side PDF/image tools live under `app/tools/` (see the Tools
section — routes are catalog-driven, not one folder per tool).

## Project documentation

Product, design, content, and flow decisions live in these repo-root docs. Read
the relevant one before changing UI, copy, or navigation — they are the source of
truth, not this file:

- `PRODUCT.md` — product definition, launch scope, target users, capabilities,
  supported file types, pricing, and product truth.
- `DESIGN.md` — visual system and design tokens (color palette, typography,
  layout, components, motion, responsive, accessibility). **Authoritative for all
  color decisions** (the light-mode Zinc/Indigo system); the typeface is **Geist**,
  matching `next/font` in `app/layout.tsx`.
- `CONTENT.md` — page architecture, approved marketing copy, naming, metadata,
  and SEO.
- `USER-FLOWS.md` — routes, navigation, user journeys, and access/redirect rules.

Ownership rule: product truth comes from `PRODUCT.md`, flow truth from
`USER-FLOWS.md`, wording/SEO from `CONTENT.md`, and visual truth from
`DESIGN.md`. Follow the doc responsible for a given concern rather than inventing
a compromise, and keep the docs' cross-references to each other intact.

### Resolving conflicts with the user's request

If any instruction in the project documentation conflicts with the user's latest
request, do not blindly follow either one. Explain the conflict and ask for the
user's confirmation before changing any existing instruction or source-of-truth
document. Once the user confirms, follow the user's decision and update the
relevant documentation so the docs and the implementation stay consistent.

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
  upload via raw SQL and queried by the chat route (see Retrieval section).

## Environment

`.env` (gitignored): DATABASE_URL, AUTH_SECRET, GOOGLE_CLIENT_ID,
GOOGLE_CLIENT_SECRET, BLOB_READ_WRITE_TOKEN, GEMINI_API_KEY, GA_ID,
GEMINI_EMBEDDING_MODEL.

## Embeddings (`lib/gemini.ts` + `actions/upload.ts`)

- `embedTexts(texts)` → `number[][]` calls `models.embedContent` with
  `text-embedding-004` as code fallback, overridden by `GEMINI_EMBEDDING_MODEL`
  (currently `gemini-embedding-001` in `.env`). Batch — one API call for all
  chunks/query texts, NOT a per-chunk loop.
- Vectors are written with raw `$executeRaw` — `embedding` is
  `Unsupported("vector")`, so the typed Prisma client can't write it. `upload.ts`
  does `createMany` (rows, empty embedding) → `findMany` to get row ids →
  a single `UPDATE ... FROM unnest(...)` batches all vectors.
- This means uploads are synchronous: a large doc adds one embed call + one
  batched UPDATE. None of this runs when chunks are absent.

## Retrieval + chat (`lib/processors/retrieval.ts` + `app/api/chat/route.ts`)

- `searchChunks(userId, query, topK?, priorityDocumentIds?)` embeds the query
  via the SAME `embedTexts` (so dimensions match stored vectors), then raw
  `$queryRaw` does `c.embedding <=> $vec::vector` cosine similarity, filtered by
  `d."userId"` (ownership enforced in SQL, never by a client-sent ID). Returns
  top-K chunks with `score` (1 - distance) and `metadata.pageNumbers`.
  `DEFAULT_TOP_K = 8`. When `priorityDocumentIds` is non-empty, the ORDER BY
  adds `(d.id = ANY($ids)) DESC` FIRST — selected documents' chunks rank ahead
  of everything else (still similarity-ordered among themselves).
- `streamAnswer(userId, question, onDelta, priorityDocumentIds?)` chooses one of
  two paths:
  - **RAG**: only when the question is NOT casual AND there is a confident match.
    The trigger is `RAG_TRIGGER_SCORE (0.5)`, but when the user explicitly
    prioritized documents (`priorityDocumentIds.length > 0`) it drops to
    `WEAK_MATCH_SCORE (0.35)` — deliberate selection is a strong signal that the
    selected doc is the intended target. Unprioritized searches keep the tight
    0.5 trigger so the 0.35–0.5 gray band never feeds context (weak matches
    like coursework notes must NOT reach the model). Casual queries are matched
    by `looksCasual()` regexes (greetings, "who are you", bare math) and always
    skip RAG so a greeting never gets sources. Calls `generateContentStream`
    with `RAG_PROMPT` → model cites `[n]` excerpts. Returns `found: true`.
  - **General fallback** (otherwise): `streamGeneralAnswer` calls Gemini WITHOUT
    doc context using `GENERAL_PROMPT` (identity = "Docuzy AI"), temperature 0.7.
    Scripted note tells Gemini to flag "couldn't find it in your documents" only
    when the user seems to be asking about their own docs. Returns `found: false`
    → no Sources shown. This is how "hi", "who are you", Taj Mahal trivia get
    real answers without bogus citations.
  - Latency guardrails: RAG context is capped at `CONTEXT_MAX_CHUNKS = 6` chunks
    of `CHUNK_MAX_CHARS = 2000` each (retrieval still scans top-8). There is NO
    `maxOutputTokens` cap — answers run to completion.
  - `buildRagContext(chunks, { minScore?, maxDocs? })` is document-aware: chunks
    must clear `max(minScore, topScore - CONTEXT_SCORE_MARGIN (0.12))`, then
    only the top `MAX_CONTEXT_DOCS = 2` documents contribute (≤
    `PER_DOC_MAX_CHUNKS = 3` chunks each). When documents are prioritized,
    `maxDocs` is raised to `max(priorityCount, 2)` so every selected doc can
    feed context. Only chunks that clear the floor are sent — 3 matches means 3
    chunks, never a padded top-6.
  - **Sources are citation-derived**: the route accumulates the full streamed
    answer, then `sourcesFromCitations` keeps only the context chunks whose
    `[n]` index actually appears in the answer (deduped to one entry per
    document, page numbers merged). No citations → `found: false` → no Sources.
    Sources always reflect what the answer used.
- `/api/chat` accepts `{ question, prioritizeDocumentIds }`; the route filters
  the requested ids through `prisma.document.findMany({ where: { id: { in },
  userId } })` — ownership re-checked server-side, foreign ids silently dropped.
- `/api/chat` is an SSE route handler (server actions can't stream). Client
  (`components/ChatZone.tsx`) reads the stream via `getReader()` +
  `TextDecoder({ stream: true })`, appends `delta` events (all `setMessages`
  updates are PURE — React StrictMode dev double-invokes state updaters, and
  impure mutation caused duplicated text), then attaches the trailing `sources`
  event as citations. Empty assistant bubble + `isStreaming` renders animated
  "thinking" dots. Assistant bubbles render via `react-markdown` +
  `remark-gfm` (`Components.code`) — `[n]` markers are pre-tokenized as inline
  code and styled as citation chips.
- `RAG_PROMPT`, `GENERAL_PROMPT`, and `getClient` are exported from
  `lib/gemini.ts` for reuse.
- Chat input controls (`ChatZone.tsx`, dashboards passes `documents` prop): the
  **Plus** button opens a multi-select popup (list of the user's docs) that
  sends `prioritizeDocumentIds` with every message; the **Mic** button uses the
  browser Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`) for
  voice-to-text (Chrome/Edge only; fallback shows a toast). Selection persists
  across messages until "Clear selection".
- Toasts: `components/ToastProvider.tsx` (context + `useToast()`, framer-motion
  animated, auto-dismiss 4s). Wired into `DocumentGrid` (delete failures) and
  `UploadDropzone` (upload success) and mic errors. Any client subtree that
  needs toast must live under the provider (currently wraps `/dashboard` only).

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

## Tools (`/tools`)

All public PDF/image tools are client-side and catalog-driven:

- **`lib/tools-catalog.ts` is the single source of truth.** Each entry declares
  `name`, `description`, `icon`, `status`, and (for built tools) `slug`, `seo`
  (`title`/`description`), `width`, and `related`. The landing tools shelf,
  Navbar, Footer, `/tools` directory, `/tools/[slug]` route, per-page metadata,
  OG image, sitemap, breadcrumbs, and related-tool links all derive from it.
  Add a tool by adding one catalog entry + one widget; never hand-write a route
  folder, metadata, or sitemap entry.
- **One route, not one folder per tool.** `app/tools/[slug]/page.tsx` is a server
  component: `generateStaticParams()` returns `availableSlugs()`,
  `generateMetadata()` uses `toolMetadata(tool)`, unknown/`coming-soon` slugs
  `notFound()`. The shell renders `ToolHeader` (H1 = `seo.title`) →
  `ToolRunner` (client, resolves the widget) → `RelatedTools`.
- **Widgets** live in `components/tools/widgets/<slug>.tsx` and are pure
  interactive content — the page supplies the header/outer container, so a
  widget must not include its own page wrapper or H1. `registry.tsx` maps
  slug → widget. Any widget that imports `pdfjs-dist` must be loaded with
  `{ ssr: false }` (pdfjs touches browser globals at import time):
  `add-page-numbers`, `watermark-pdf`, `sign-pdf`, `pdf-to-image`,
  `compress-pdf`, `organize-pdf`, `rotate-pdf`. `ssr: false` only skips
  server-rendering the *widget* — the page's `generateMetadata` still runs on
  the server for every tool.
- **`compress-pdf` is hybrid**, so it never bloats a file:
  1. A **lossless structural pass** (`pdf-lib` `save({ useObjectStreams: true })`)
     preserves selectable text and is kept whenever it is smaller.
  2. It only **rasterizes** (pdfjs → white-filled canvas, since JPEG has no
     alpha → JPEG at a tier's DPI/quality → pdf-lib rebuild) when the PDF
     actually contains images, detected via `getOperatorList()` image ops.
  3. The rasterized version replaces the lossless one only if it is ≥10% smaller
     (`RASTER_WIN_RATIO = 0.9`); otherwise text stays selectable.
  The result card reports which path won (`raster` / `vector` / `original`) and
  only shows the amber "already optimized" notice when nothing beat the
  original. Tiers live in a single `TIERS` constant in the widget.
  **Gotcha:** compare candidate sizes as *numbers* — `pdfjs.getDocument({ data })`
  detaches the source `ArrayBuffer`, so re-reading a buffer's `byteLength` after
  the fact returns 0 and silently rejects every raster result.
- **`organize-pdf` is a visual page organizer** (client-only, `pdfjs` + `pdf-lib`):
  - One thumbnail grid; the **whole card** is the drag target (dnd-kit
    `rectSortingStrategy`). The card carries the sortable `attributes` +
    `listeners` with `role="group"` (not `role="button"`, so the inner
    controls stay valid buttons); the per-card buttons stop propagation of
    pointer/mouse/touch start events so they never begin a drag.
  - State is `PageItem[] = { id, sourceIndex, rotation, removed }` — order is the
    array order, `rotation` is an extra 0/90/180/270 delta, `removed` pages stay
    in the grid dimmed so they can be restored (nothing is destructive until
    Apply).
  - Thumbnails render lazily via `IntersectionObserver` (~320px wide JPEG), so
    long documents stay responsive.
  - **Rotation is additive:** on export `setRotation(degrees(base + delta))`,
    where `base` is the page's existing `/Rotate` — never overwrite it. pdfjs
    `getViewport({ rotation })` *replaces* the page rotation, so the thumbnail
    must pass `page.rotate + delta`.
  - Export = `copyPages` in the current order → apply rotation → `save()`.
    Applying shows a result card (pages kept, size before/after) with an
    explicit Download — no auto-download.
  - **Gotcha:** pdfjs detaches the `ArrayBuffer` it is given, so the widget
    keeps the original bytes for pdf-lib and hands pdfjs a `slice(0)` copy.
- **`rotate-pdf` turns pages without re-rendering** (pdf-lib + pdfjs preview):
  - Direction (`DIRECTIONS`: right 90°, left 270°, flip 180°) is a **delta added
    to the page's existing `/Rotate`** — `setRotation(degrees((base + delta) %
    360))` — never an overwrite.
  - Scope is "all pages" or a page range. **Every page is copied to the output**;
    only pages inside the range are turned, the rest keep their original
    rotation. (Copying just the affected pages silently drops the others.)
  - The preview uses pdfjs `getViewport({ rotation: page.rotate + delta })`
    because pdfjs *replaces* the page rotation instead of adding to it.
  - Pages are turned via `/Rotate`, so text and vectors stay sharp and
    selectable — nothing is rasterized.
- Tool pages intentionally render **without Navbar/Footer** — only the
  breadcrumb (`app/tools/layout.tsx`) provides navigation back to `/tools`.
- URLs are flat `/tools/<slug>` (category is UI-only). `next.config.ts` holds
  permanent redirects from the older nested paths; keep them working.
- Titles: root `app/layout.tsx` sets `title.template = "%s — Docuzy"`, so
  catalog `seo.title` and page titles must be **brandless**.

## Conventions

- Path alias: `@/*` maps to the repo root (there is no `src/`).
- Auth checks are three-layered by design: `proxy.ts` route guard → `auth()`
  check in the page → ownership re-check inside every server action/route.
  Copy the pattern in `actions/upload.ts`; never trust a client-sent ID alone.
- Document deletion lives in `actions/delete-document.ts` (server action,
  `DeleteDocumentButton` client component, grid owned by `DocumentGrid` client
  component on `/dashboard`): `DocumentGrid` removes the card optimistically
  on confirm and restores it on failure; the action looks the doc up with
  `where: { id, userId }` (ownership enforced), deletes the DB row FIRST (fast,
  chunks cascade), then `del(doc.fileUrl)` (errors swallowed/logged), then
  `revalidatePath("/dashboard")`. Blob delete failure must not fail the DB
  delete.
- `rag-backend/` contains only an unused Python venv — there is no Python
  service; do not build against it.
- `CLAUDE.md` simply imports this file (`@AGENTS.md`); keep guidance here.
