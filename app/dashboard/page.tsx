import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import DashboardShell from "@/components/dashboard/DashboardShell"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/dashboard")}`)
  }

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  const recent = documents.slice(0, 4).map((d) => ({
    id: d.id,
    title: d.title,
    fileType: d.fileType,
  }))

  const allFiles = documents.map((d) => ({
    id: d.id,
    title: d.title,
    fileType: d.fileType,
    size: d.size,
    createdAt: d.createdAt.toISOString(),
  }))

  const chatDocs = documents.map((d) => ({ id: d.id, title: d.title }))

  return (
    <DashboardShell
      documentsCount={documents.length}
      recent={recent}
      allFiles={allFiles}
      chatDocs={chatDocs}
    />
  )
}
