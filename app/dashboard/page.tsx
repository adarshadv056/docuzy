import { auth, signOut } from "@/auth"
import prisma from "@/lib/prisma"
import UploadDropzone from "@/components/UploadDropzone"
import DocumentGrid from "@/components/DocumentGrid"
import { redirect } from "next/navigation"
import ChatZone from "@/components/ChatZone"
import ToastProvider from "@/components/ToastProvider"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect("/login")
  }

  const documents = await prisma.document.findMany({
    where: { userId: session?.user?.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <ToastProvider>
      <main className="min-h-screen bg-zinc-950 text-zinc-50 p-8 font-sans">
        <div className="max-w-4xl mx-auto">
          <header className="flex items-center justify-between border-b border-zinc-800 pb-6 mb-8">
            <div className="flex items-center gap-4">
              {session?.user?.image && (
                <img
                  src={session.user.image}
                  alt="Profile"
                  className="w-12 h-12 rounded-full border border-zinc-700"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">Welcome back, {session?.user?.name}</h1>
                <p className="text-sm text-zinc-400">{session?.user?.email}</p>
              </div>
            </div>

            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/" })
              }}
            >
              <button
                type="submit"
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors"
              >
                Log Out
              </button>
            </form>
          </header>

          <div className="space-y-6">
            <h2 className="text-xl font-bold">Your Documents</h2>
            <DocumentGrid
              documents={documents.map((d) => ({
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
      </main>
    </ToastProvider>
  )
}