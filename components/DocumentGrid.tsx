"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText } from "lucide-react"
import DeleteDocumentButton from "@/components/DeleteDocumentButton"
import { deleteDocument } from "@/actions/delete-document"
import { useToast } from "@/components/ToastProvider"

export type DashboardDocument = {
  id: string
  title: string
  content: string | null
}

export default function DocumentGrid({
  documents,
}: {
  documents: DashboardDocument[]
}) {
  const [items, setItems] = useState(documents)
  const router = useRouter()
  const toast = useToast()

  const handleDelete = async (id: string) => {
    const existing = items.find((d) => d.id === id)
    // Optimistic: remove the card immediately, restore on failure.
    if (existing) setItems((prev) => prev.filter((d) => d.id !== id))

    const result = await deleteDocument(id)

    if (!result.success && existing) {
      setItems((prev) => (prev.some((d) => d.id === id) ? prev : [...prev, existing]))
      toast.error(result.message)
    }

    router.refresh()
  }

  if (items.length === 0) {
    return (
      <p className="text-zinc-400">You haven&apos;t uploaded any documents yet.</p>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((doc) => (
        <div
          key={doc.id}
          className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800 transition-colors"
        >
          <DeleteDocumentButton documentId={doc.id} onDeleted={handleDelete} />
          <FileText className="w-8 h-8 text-blue-500 mb-2" />
          <h3 className="font-bold pr-8">{doc.title}</h3>
          <p className="text-sm text-zinc-400">
            {doc.content
              ? doc.content.length > 100
                ? `${doc.content.slice(0, 100).trimEnd()} ...`
                : doc.content
              : "No preview available"}
          </p>
        </div>
      ))}
    </div>
  )
}