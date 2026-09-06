import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { embedTexts, RAG_PROMPT, GENERAL_PROMPT, getClient } from "@/lib/gemini"

const DEFAULT_TOP_K = 8
const RAG_TRIGGER_SCORE = 0.5
// Below the trigger but semantically adjacent (0.35–0.5): feed NO context,
// route to the general path so weak/irrelevant docs never reach the model.
const WEAK_MATCH_SCORE = 0.35
const CONTEXT_MAX_CHUNKS = 6
const CONTEXT_SCORE_MARGIN = 0.12
const MAX_CONTEXT_DOCS = 2
const PER_DOC_MAX_CHUNKS = 3
const CHUNK_MAX_CHARS = 2000
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash"

const CASUAL_QUERY_PATTERNS = [
    /\b(hi|hello|hey|yo|thanks|thank you|good (morning|afternoon|evening|night))\b/i,
    /\b(who are u|who are you|your name|what can you do|what are you|are you (a|an) ai|how are you)\b/i,
    /^\s*[0-9+\-*/.\s=?%]+\s*$/,
]

function looksCasual(question: string): boolean {
    return CASUAL_QUERY_PATTERNS.some((re) => re.test(question))
}

export type RetrievedChunk = {
    id: string
    content: string
    documentId: string
    title: string
    pageNumbers?: number[]
    score: number
}

type RawRow = {
    id: string
    content: string
    documentId: string
    title: string
    metadata: unknown
    score: number | string
}

function rowToChunk(row: RawRow): RetrievedChunk {
    const meta = (row.metadata ?? {}) as { pageNumbers?: number[] }
    return {
        id: row.id,
        content: row.content,
        documentId: row.documentId,
        title: row.title,
        pageNumbers: meta.pageNumbers,
        score: Number(row.score),
    }
}

export async function searchChunks(
    userId: string,
    queryText: string,
    topK = DEFAULT_TOP_K,
    priorityDocumentIds: string[] = []
): Promise<RetrievedChunk[]> {
    const [vector] = await embedTexts([queryText])
    const vec = `[${vector.join(",")}]`

    const priorityOrder = priorityDocumentIds.length
        ? Prisma.sql`(d.id = ANY(${priorityDocumentIds})) DESC, `
        : Prisma.empty

    const rows = await prisma.$queryRaw<RawRow[]>`
        SELECT c.id, c.content, c.metadata, c."documentId", d.title,
               1 - (c.embedding <=> ${vec}::vector) AS score
        FROM "DocumentChunk" c
        JOIN "Document" d ON d.id = c."documentId"
        WHERE d."userId" = ${userId}
          AND c.embedding IS NOT NULL
        ORDER BY ${priorityOrder} c.embedding <=> ${vec}::vector
        LIMIT ${topK}
    `

    return rows.map(rowToChunk)
}

export async function countUserDocuments(userId: string): Promise<number> {
    return prisma.document.count({ where: { userId } })
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max).trimEnd() + "…"
}

function dedupeSources(chunks: RetrievedChunk[]): RetrievedChunk[] {
    const byDoc = new Map<string, RetrievedChunk>()
    for (const c of chunks) {
        const prev = byDoc.get(c.documentId)
        if (!prev) {
            byDoc.set(c.documentId, c)
        } else {
            const pages = Array.from(
                new Set([...(prev.pageNumbers ?? []), ...(c.pageNumbers ?? [])])
            )
            byDoc.set(c.documentId, { ...prev, pageNumbers: pages })
        }
    }
    return Array.from(byDoc.values())
}

function parseCitedIndices(answer: string, maxIndex: number): Set<number> {
    const cited = new Set<number>()
    for (const m of answer.matchAll(/\[(\d{1,2})\]/g)) {
        const n = parseInt(m[1], 10)
        if (n >= 1 && n <= maxIndex) cited.add(n)
    }
    return cited
}

export function sourcesFromCitations(
    answer: string,
    contextChunks: RetrievedChunk[]
): RetrievedChunk[] {
    const cited = parseCitedIndices(answer, contextChunks.length)
    if (cited.size === 0) return []
    const used = contextChunks.filter((_, i) => cited.has(i + 1))
    return dedupeSources(used)
}

export type RagContext = {
    context: string
    contextChunks: RetrievedChunk[]
}

export function buildRagContext(
    chunks: RetrievedChunk[],
    opts?: { minScore?: number; maxDocs?: number }
): RagContext {
    const top = chunks[0]
    if (!top) return { context: "", contextChunks: [] }

    // Only chunks that actually match: every chunk must clear the minimum
    // score AND stay within a margin of the best match. Weak/irrelevant
    // documents (e.g. other notes) drop out instead of padding the context.
    const minScore = opts?.minScore ?? RAG_TRIGGER_SCORE
    const maxDocs = opts?.maxDocs ?? MAX_CONTEXT_DOCS
    const floor = Math.max(minScore, top.score - CONTEXT_SCORE_MARGIN)
    const matched = chunks.filter((c) => c.score >= floor)

    // Document-aware selection: prioritize the best-matching documents so a
    // resume question doesn't get flooded with fillers from every other doc.
    const byDoc = new Map<string, RetrievedChunk[]>()
    for (const c of matched) {
        const list = byDoc.get(c.documentId) ?? []
        list.push(c)
        byDoc.set(c.documentId, list)
    }

    const rankedDocs = Array.from(byDoc.values())
        .sort((a, b) => b[0].score - a[0].score)
        .slice(0, maxDocs)

    const selected = rankedDocs
        .flatMap((list) => list.slice(0, PER_DOC_MAX_CHUNKS))
        .slice(0, CONTEXT_MAX_CHUNKS)

    const lines = selected.map(
        (c, i) =>
            `[${i + 1}] (${c.title}${c.pageNumbers?.length ? `, page ${c.pageNumbers.join(",")}` : ""}): ${truncate(c.content, CHUNK_MAX_CHARS)}`
    )
    return {
        context: lines.join("\n\n"),
        contextChunks: selected,
    }
}

export type StreamCallback = (delta: string) => void | Promise<void>

async function streamGeneralAnswer(
    question: string,
    hasDocs: boolean,
    onDelta: StreamCallback
): Promise<void> {
    const note = hasDocs
        ? "Note: the user has uploaded documents, but nothing relevant matched this question. " +
          "If they are asking about their own documents (resume, notes, an uploaded file), say you " +
          "couldn't find it in their documents. Otherwise just answer normally."
        : "Note: the user has not uploaded any documents yet. " +
          "If they are asking about their documents or uploaded files, mention they haven't uploaded " +
          "any documents yet. Otherwise just answer normally."

    const prompt = `${GENERAL_PROMPT}\n\n${note}\n\nUser: ${question}`

    const stream = await getClient().models.generateContentStream({
        model: MODEL,
        config: { temperature: 0.7 },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    })

    for await (const chunk of stream) {
        const delta = chunk.text
        if (delta) await onDelta(delta)
    }
}

export async function streamAnswer(
    userId: string,
    question: string,
    onDelta: StreamCallback,
    priorityDocumentIds: string[] = []
): Promise<{ sources: RetrievedChunk[]; found: boolean }> {
    const chunks = await searchChunks(userId, question, DEFAULT_TOP_K, priorityDocumentIds)

    // Explicitly prioritized documents carry a strong user signal ("answer
    // from THIS doc"), so a skimmed mean (≥ WEAK_MATCH_SCORE) is enough to
    // route to RAG. Unprioritized searches keep the tighter trigger.
    const hasPriority = priorityDocumentIds.length > 0
    const trigger = hasPriority ? WEAK_MATCH_SCORE : RAG_TRIGGER_SCORE

    // Casual queries ("hi", "who are you", math) or no confident doc match
    // -> answer generally, never attach sources. The 0.35–0.5 gray band
    // (top score above WEAK_MATCH_SCORE but below RAG_TRIGGER_SCORE) also
    // lands here for unprioritized searches: a weak "match" like coursework
    // notes must NOT be fed as context when the user asks about a deleted or
    // absent document.
    if (
        looksCasual(question) ||
        chunks.length === 0 ||
        chunks[0].score < trigger
    ) {
        const hasDocs = (await countUserDocuments(userId)) > 0
        await streamGeneralAnswer(question, hasDocs, onDelta)
        return { sources: [], found: false }
    }

    const maxDocs = hasPriority
        ? Math.max(priorityDocumentIds.length, MAX_CONTEXT_DOCS)
        : MAX_CONTEXT_DOCS
    const { context, contextChunks } = buildRagContext(chunks, {
        minScore: trigger,
        maxDocs,
    })

    const prompt = `${RAG_PROMPT}\n\nDocument excerpts:\n${context}\n\nQuestion: ${question}`

    const stream = await getClient().models.generateContentStream({
        model: MODEL,
        config: { temperature: 0 },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    })

    let fullAnswer = ""
    for await (const chunk of stream) {
        const delta = chunk.text
        if (delta) {
            fullAnswer += delta
            await onDelta(delta)
        }
    }

    // Sources must reflect what the answer actually cited. No [n] citations
    // in the response -> no sources at all.
    const sources = sourcesFromCitations(fullAnswer, contextChunks)

    return { sources, found: sources.length > 0 }
}
