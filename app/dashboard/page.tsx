import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import UploadDropzone from "@/components/UploadDropzone"
import DocumentGrid from "@/components/DocumentGrid"
import ChatZone from "@/components/ChatZone"
import ToastProvider from "@/components/ToastProvider"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/dashboard")}`)
  }

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  const recent = documents.slice(0, 6)

  return (
    <ToastProvider>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt="Profile"
              className="w-12 h-12 rounded-full border border-zinc-200"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {session.user.name ?? session.user.email?.split("@")[0] ?? "there"}</h1>
            <p className="text-sm text-zinc-400">{session.user.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Recent Documents</h2>
            {documents.length > 6 && (
              <Link
                href="/dashboard/files"
                className="text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300"
              >
                View all {documents.length} files →
              </Link>
            )}
          </div>
          <DocumentGrid
            documents={recent.map((d) => ({
              id: d.id,
              title: d.title,
              content: d.content,
            }))}
          />
        </div>

        <UploadDropzone />

        <ChatZone
          documents={documents.map((d) => ({ id: d.id, title: d.title }))}
        />
      </div>
    </ToastProvider>
  )
}
