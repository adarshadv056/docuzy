"use server"

import { put } from "@vercel/blob"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse";

export async function uploadDocument(formData: FormData) {
    const session = await auth()

    if (!session?.user?.email) {
        throw new Error("Unauthorized")
    }

    const file = formData.get("file") as File
    if (!file) {
        throw new Error("No file provided")
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    })

    if (!user) throw new Error("User not found in database")

    const blob = await put(`documents/${user.id}/${file.name}`, file, {
        access: "private",
    })

    let extractedText = ""
    try {
        if (file.type === "application/pdf") {
            const arrayBuffer = await file.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const pdfData = await pdfParse(buffer)
            extractedText = pdfData.text
        }
    } catch (error) {
        console.error("Error extracting text from PDF:", error)
    }

    await prisma.document.create({
        data: {
            userId: user.id,
            title: file.name,
            content: extractedText,
            fileUrl: blob.url,
        }
    })

    revalidatePath("/dashboard")

    return { success: true, url: blob.url }
}