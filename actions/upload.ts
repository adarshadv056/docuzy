"use server"

import { put, del } from "@vercel/blob"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import {
    extractDocumentContent,
    MAX_UPLOAD_BYTES,
    ACCEPTED_IMAGE_TYPES,
} from "@/lib/processors/extractor"
import { chunkDocument } from "@/lib/processors/chunker"

function isAcceptedType(file: File): boolean {
    return (
        file.type === "application/pdf" ||
        ACCEPTED_IMAGE_TYPES.includes(file.type) ||
        file.type === "text/plain" ||
        file.type === "text/markdown" ||
        /\.(txt|md|markdown)$/i.test(file.name)
    )
}

function sanitizeFileName(name: string): string {
    const base = name.split(/[\\/]+/).pop() || "file"
    const cleaned = base.replace(/[\x00-\x1f\x7f]/g, "").trim()
    return (cleaned || "file").slice(0, 120)
}

export async function uploadDocument(formData: FormData) {
    const session = await auth()

    if (!session?.user?.email) {
        return { success: false as const, message: "Unauthorized" }
    }

    const file = formData.get("file")
    if (!(file instanceof File)) {
        return { success: false as const, message: "No file provided." }
    }

    if (!isAcceptedType(file)) {
        return {
            success: false as const,
            message: `"${file.name}" has an unsupported type (${file.type || "unknown"}). Supported: PDF, images, txt/md.`,
        }
    }

    if (file.size > MAX_UPLOAD_BYTES) {
        return {
            success: false as const,
            message: `"${file.name}" is too large. Maximum size is 15MB.`,
        }
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    })

    if (!user) {
        return { success: false as const, message: "User not found in database." }
    }

    const safeName = sanitizeFileName(file.name)

    const blob = await put(`documents/${user.id}/${safeName}`, file, {
        access: "private",
    })

    try {
        const { text, method } = await extractDocumentContent(file)

        const document = await prisma.document.create({
            data: {
                userId: user.id,
                title: safeName,
                fileType: file.type || "application/octet-stream",
                content: text,
                fileUrl: blob.url,
            }
        })
        const chunks = chunkDocument(text, method)
        if (chunks.length > 0) {
            await prisma.documentChunk.createMany({
                data: chunks.map((c) => ({
                    documentId: document.id,
                    content: c.content,
                    chunkIndex: c.chunkIndex,
                    metadata: c.metadata,
                })),
            })
        }
    } catch (error) {
        console.error("Content extraction failed:", error)
        await del(blob.url).catch(() => { })
        return {
            success: false as const,
            message: `Could not extract text from "${file.name}". Please try a different file.`,
        }
    }

    revalidatePath("/dashboard")

    return { success: true as const, url: blob.url }
}
