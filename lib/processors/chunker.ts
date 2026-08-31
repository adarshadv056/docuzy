const MAX_CHUNK_SIZE = 3000
const OVERLAP_SIZE = 300

export type ChunkMetadata = {
    pageNumbers?: number[]
    sectionTitle?: string
    extractionMethod?: string
}

export type DocumentChunkData = {
    content: string
    chunkIndex: number
    metadata: ChunkMetadata
}

function splitBySentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean)
}

function splitLargeText(text: string): string[] {
    if (text.length <= MAX_CHUNK_SIZE) {
        return [text.trim()]
    }

    const paragraphs = text
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(Boolean)

    if (paragraphs.length > 1) {
        return combineParts(paragraphs)
    }

    const sentences = splitBySentences(text)

    if (sentences.length > 1) {
        return combineParts(sentences)
    }

    const chunks: string[] = []

    for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
        chunks.push(text.slice(i, i + MAX_CHUNK_SIZE).trim())
    }

    return chunks.filter(Boolean)
}

function splitPart(part: string, chunks: string[]): void {
    if (part.length <= MAX_CHUNK_SIZE) {
        chunks.push(part)
        return
    }
    for (const sub of splitLargeText(part)) {
        chunks.push(sub)
    }
}

function combineParts(parts: string[]): string[] {
    const chunks: string[] = []
    let current = ""

    const flush = () => {
        if (current.trim()) chunks.push(current)
        current = ""
    }

    for (const part of parts) {
        if (part.length > MAX_CHUNK_SIZE) {
            flush()
            splitPart(part, chunks)
            continue
        }

        if (!current) {
            current = part
        } else if (current.length + part.length + 2 <= MAX_CHUNK_SIZE) {
            current += "\n\n" + part
        } else {
            const overlap = current.slice(-Math.min(OVERLAP_SIZE, current.length))
            flush()
            current = overlap + "\n\n" + part
        }
    }

    flush()

    return chunks
}

function extractPageNumber(marker: string): number | null {
    const match = marker.match(/--- Page (\d+) ---/i)
    return match ? Number(match[1]) : null
}

export function chunkDocument(
    text: string,
    extractionMethod: string
): DocumentChunkData[] {
    const pageRegex = /--- Page (\d+) ---/gi

    const matches = [...text.matchAll(pageRegex)]

    // No page markers → chunk exactly like vision extraction
    if (matches.length === 0) {
        return splitLargeText(text.trim()).map((content, index) => ({
            content,
            chunkIndex: index,
            metadata: {
                extractionMethod,
            },
        }))
    }

    // Remove page markers but keep track of where each page starts/ends
    const pages: { pageNumber: number; text: string }[] = []

    for (let i = 0; i < matches.length; i++) {
        const pageNumber = Number(matches[i][1])

        const start = (matches[i].index ?? 0) + matches[i][0].length
        const end =
            i + 1 < matches.length
                ? matches[i + 1].index ?? text.length
                : text.length

        const pageText = text.slice(start, end).trim()

        if (pageText) {
            pages.push({
                pageNumber,
                text: pageText,
            })
        }
    }

    // Create one continuous document
    const fullText = pages.map(page => page.text).join("\n\n")

    // Chunk the entire document exactly like vision extraction
    const contents = splitLargeText(fullText)

    const chunks: DocumentChunkData[] = []

    let searchStart = 0

    for (const content of contents) {
        const start = fullText.indexOf(content, searchStart)

        if (start === -1) continue

        const end = start + content.length

        const pageNumbers = pages
            .filter((page, index) => {
                const pageStart = pages
                    .slice(0, index)
                    .reduce(
                        (sum, p) => sum + p.text.length + 2,
                        0
                    )

                const pageEnd = pageStart + page.text.length

                return start < pageEnd && end > pageStart
            })
            .map(page => page.pageNumber)

        chunks.push({
            content,
            chunkIndex: chunks.length,
            metadata: {
                pageNumbers,
                extractionMethod,
            },
        })

        searchStart = start + 1
    }

    return chunks
}