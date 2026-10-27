"use client"

import { useState } from "react"
import { Trash2, Loader2, Check } from "lucide-react"

export default function DeleteDocumentButton({
  documentId,
  onDeleted,
}: {
  documentId: string
  onDeleted: (id: string) => Promise<void> | void
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleClick = async () => {
    if (deleting) return

    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }

    setDeleting(true)
    try {
      await onDeleted(documentId)
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={deleting}
      title={confirming ? "Click again to confirm delete" : "Delete document"}
      className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        confirming
          ? "bg-red-600 text-white"
          : "text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
      }`}
    >
      {deleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : confirming ? (
        <Check className="h-4 w-4" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  )
}