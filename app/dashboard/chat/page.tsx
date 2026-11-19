import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import ChatZone from "@/components/ChatZone"
import ToastProvider from "@/components/ToastProvider"

export default async function ChatPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/dashboard/chat")}`)
  }

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  const chatDocs = documents.map((d) => ({ id: d.id, title: d.title }))

  return (
    <ToastProvider>
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">AI Chat</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ask questions about your documents. Select files with the + button to focus the answer.
          </p>
        </div>
        <div className="h-[calc(100vh-12rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <ChatZone documents={chatDocs} />
        </div>
      </div>
    </ToastProvider>
  )
}
