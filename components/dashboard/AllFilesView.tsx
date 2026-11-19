"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, FileImage, File, MoreVertical, Trash2, Loader2, Search, Grid3x3, List } from "lucide-react"
import { deleteDocument } from "@/actions/delete-document"
import { useToast } from "@/components/ToastProvider"

export type AllFile = {
  id: string
  title: string
  fileType: string
  size: number | null
  createdAt: string
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  try {
    // Fixed locale so SSR and client produce identical strings (avoids hydration mismatch).
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return iso
  }
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage
  if (type === "application/pdf") return FileText
  return File
}

export default function AllFilesView({ files }: { files: AllFile[] }) {
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"list" | "card">("list")
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()
  const toast = useToast()

  const filtered = files.filter((f) =>
    f.title.toLowerCase().includes(query.toLowerCase())
  )

  const handleDelete = async (id: string) => {
    setDeleting(id)
    const res = await deleteDocument(id)
    setDeleting(null)
    setOpenMenu(null)
    if (res.success) {
      toast.success("Document deleted")
      router.refresh()
    } else {
      toast.error(res.message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="List view"
            className={`rounded-md p-1.5 ${view === "list" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("card")}
            aria-label="Card view"
            className={`rounded-md p-1.5 ${view === "card" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          {files.length === 0 ? "No files yet." : "No files match your search."}
        </p>
      ) : view === "card" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {filtered.map((f) => {
            const Icon = fileIcon(f.fileType)
            return (
              <div key={f.id} className="relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <Icon className="mb-2 h-8 w-8 text-indigo-600" />
                <p className="truncate text-sm font-medium text-zinc-900" title={f.title}>{f.title}</p>
                <p className="text-xs text-zinc-500">{formatSize(f.size)}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Size</th>
                <th className="px-4 py-2.5">Modified</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const Icon = fileIcon(f.fileType)
                return (
                  <tr key={f.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-indigo-600" />
                        <span className="truncate text-zinc-900" title={f.title}>{f.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{f.fileType || "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{formatSize(f.size)}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{formatDate(f.createdAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => setOpenMenu(openMenu === f.id ? null : f.id)}
                          className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                          aria-label="More options"
                        >
                          {deleting === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                        </button>
                        {openMenu === f.id && (
                          <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => handleDelete(f.id)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
