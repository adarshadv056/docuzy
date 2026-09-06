"use server"

import { del } from "@vercel/blob"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export type DeleteResult =
  | { success: true }
  | { success: false; message: string }

export async function deleteDocument(documentId: string): Promise<DeleteResult> {
  const session = await auth()

  if (!session?.user?.id) {
    return { success: false, message: "You must be signed in to delete documents." }
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId, userId: session.user.id },
  })

  if (!document) {
    return { success: false, message: "Document not found." }
  }

  try {
    await prisma.document.delete({ where: { id: documentId } })
    if (document.fileUrl) {
      await del(document.fileUrl).catch((err) => {
        console.error("[delete-document] blob del failed:", err)
      })
    }
  } catch (error) {
    console.error("[delete-document] delete failed:", error)
    return {
      success: false,
      message: "Could not delete the document. Please try again.",
    }
  }

  revalidatePath("/dashboard")
  return { success: true }
}