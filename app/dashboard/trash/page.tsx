import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function TrashPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/trash")
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900">Trash</h1>
      <p className="text-sm text-zinc-500">Deleted documents.</p>
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
        Coming soon
      </div>
    </div>
  )
}
