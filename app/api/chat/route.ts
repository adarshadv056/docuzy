import { NextRequest } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { streamAnswer } from "@/lib/processors/retrieval"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 })
    }

    let question: string
    let rawPriorityIds: unknown[] = []
    try {
        const body = await req.json()
        question = String(body?.question ?? "").trim()
        if (Array.isArray(body?.prioritizeDocumentIds)) {
            rawPriorityIds = body.prioritizeDocumentIds
        }
    } catch {
        return new Response("Invalid request", { status: 400 })
    }

    const userId = session.user.id

    if (!question) {
        return new Response("Question is required", { status: 400 })
    }

    // Only accept document ids that actually belong to this user. Ownership is
    // enforced here (in SQL via Prisma), never trusted from the client.
    const requestedIds = [...new Set(rawPriorityIds.filter((x): x is string => typeof x === "string"))].slice(0, 20)
    const owned = requestedIds.length
        ? await prisma.document.findMany({
              where: { id: { in: requestedIds }, userId },
              select: { id: true },
          })
        : []
    const priorityDocumentIds = owned.map((d) => d.id)

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: unknown) => {
                controller.enqueue(
                    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                )
            }

            try {
                const { sources, found } = await streamAnswer(
                    userId,
                    question,
                    (delta) => send("delta", delta),
                    priorityDocumentIds
                )

                if (found) {
                    send("sources", sources.map((s) => ({
                        title: s.title,
                        pageNumbers: s.pageNumbers,
                        documentId: s.documentId,
                        score: s.score,
                    })))
                }

                send("done", { found })
            } catch (error) {
                console.error("[chat] stream error:", error)
                send("error", "Something went wrong while answering. Please try again.")
            } finally {
                controller.close()
            }
        },
    })

    return new Response(readable, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    })
}
