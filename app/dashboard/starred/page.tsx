import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function StarredPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/starred")
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900">Starred</h1>
      <p className="text-sm text-zinc-500">Starred documents.</p>
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        Coming soon
      </div>
    </div>
  )
}
