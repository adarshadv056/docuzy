"use server"

import { put } from "@vercel/blob"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

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

    await prisma.document.create({
        data: {
            userId: user.id,
            title: file.name,
            fileUrl: blob.url,
        }
    })

    revalidatePath("/dashboard")

    return { success: true, url: blob.url }
}