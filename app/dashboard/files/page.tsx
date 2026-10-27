import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import UploadDropzone from "@/components/UploadDropzone"
import DocumentGrid from "@/components/DocumentGrid"
import ToastProvider from "@/components/ToastProvider"

export default async function AllFilesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/dashboard/files")}`)
  }

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <ToastProvider>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">All Files</h1>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300"
          >
            ← Recent
          </Link>
        </div>

        <DocumentGrid
          documents={documents.map((d) => ({
            id: d.id,
            title: d.title,
            content: d.content,
          }))}
        />

        <UploadDropzone />
      </div>
    </ToastProvider>
  )
}
