import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import AllFilesPageView, { type AllFile } from "@/components/dashboard/AllFilesPageView"
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

  const files: AllFile[] = documents.map((d) => ({
    id: d.id,
    title: d.title,
    fileType: d.fileType,
    size: d.size,
    createdAt: d.createdAt.toISOString(),
  }))

  return (
    <ToastProvider>
      <AllFilesPageView files={files} />
    </ToastProvider>
  )
}
