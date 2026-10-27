import Link from "next/link"
import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import Sidebar from "@/components/dashboard/Sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/dashboard")}`)
  }

  async function signOutAction() {
    "use server"
    await signOut({ redirectTo: "/" })
  }

  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans">
      <Sidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
        signOutAction={signOutAction}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 p-6 md:p-8">{children}</main>
        <footer className="border-t border-zinc-200 bg-white px-6 py-3 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {year} Docuzy</span>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/tools" className="transition-colors hover:text-zinc-900">
              All tools
            </Link>
            <Link href="/" className="transition-colors hover:text-zinc-900">
              Back to site
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
