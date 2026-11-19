"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  FileText, FileImage, File, MoreVertical, Trash2, Loader2, Search, Grid3x3, List,
  Folder, X, Share2, Star, Download, MessageSquare,
  Sparkles, FileSearch, FileOutput, Combine, Scissors,
} from "lucide-react"
import { deleteDocument } from "@/actions/delete-document"
import { useToast } from "@/components/ToastProvider"

export type AllFile = {
  id: string
  title: string
  fileType: string
  size: number | null
  createdAt: string
  updatedAt?: string
}

type Filter = "all" | "documents" | "pdf" | "images" | "presentation" | "other"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "documents", label: "Documents" },
  { key: "pdf", label: "PDF" },
  { key: "images", label: "Images" },
  { key: "presentation", label: "Presentation" },
  { key: "other", label: "Other" },
]

const FOLDERS = [
  { name: "Documents", count: 12, color: "text-indigo-600 bg-indigo-50" },
  { name: "Images", count: 8, color: "text-emerald-600 bg-emerald-50" },
  { name: "Presentations", count: 3, color: "text-amber-600 bg-amber-50" },
  { name: "Archive", count: 5, color: "text-zinc-600 bg-zinc-100" },
]

function matchesFilter(f: AllFile, filter: Filter): boolean {
  const t = (f.fileType || "").toLowerCase()
  switch (filter) {
    case "all": return true
    case "pdf": return t === "application/pdf"
    case "images": return t.startsWith("image/")
    case "documents": return t.startsWith("text/") || t.includes("document") || t.includes("word")
    case "presentation": return t.includes("presentation") || t.includes("powerpoint") || t.includes("ppt")
    case "other": return !(t === "application/pdf" || t.startsWith("image/") || t.startsWith("text/"))
    default: return true
  }
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return iso
  }
}

function fileIcon(type: string) {
  const t = (type || "").toLowerCase()
  if (t.startsWith("image/")) return FileImage
  if (t === "application/pdf") return FileText
  return File
}

const QUICK_ACTIONS = [
  { key: "ask", label: "Ask AI", icon: MessageSquare, href: null },
  { key: "summarize", label: "Summarize", icon: Sparkles, href: null },
  { key: "extract", label: "Extract text", icon: FileSearch, href: "/dashboard/tools/extract-text" },
  { key: "compress", label: "Compress", icon: FileOutput, href: "/dashboard/tools/compress-pdf" },
  { key: "merge", label: "Merge", icon: Combine, href: "/dashboard/tools/merge-pdf" },
  { key: "split", label: "Split", icon: Scissors, href: "/dashboard/tools/split-pdf" },
]

export default function AllFilesPageView({ files }: { files: AllFile[] }) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [view, setView] = useState<"list" | "card">("list")
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [preview, setPreview] = useState<AllFile | null>(null)
  const [starred, setStarred] = useState<Set<string>>(new Set())
  const router = useRouter()
  const toast = useToast()

  const filtered = files.filter((f) => {
    if (!f.title.toLowerCase().includes(query.toLowerCase())) return false
    return matchesFilter(f, filter)
  })

  const handleDelete = async (id: string) => {
    setDeleting(id)
    const res = await deleteDocument(id)
    setDeleting(null)
    setOpenMenu(null)
    if (res.success) {
      toast.success("Document deleted")
      setPreview(null)
      router.refresh()
    } else {
      toast.error(res.message)
    }
  }

  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onQuickAction = (key: string) => {
    if (key === "ask" || key === "summarize") {
      toast.success("Coming soon")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">All files</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Browse, search, and manage every document in your workspace.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-indigo-600 text-white"
                : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Folders */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">Folders</h2>
          <button type="button" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            View all
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {FOLDERS.map((folder) => {
            const [textColor, bgColor] = folder.color.split(" ")
            return (
              <button
                key={folder.name}
                type="button"
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-300 hover:shadow-md"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgColor}`}>
                  <Folder className={`h-5 w-5 ${textColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{folder.name}</p>
                  <p className="text-xs text-zinc-500">{folder.count} files</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Files */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Files</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files…"
                className="w-48 rounded-lg border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none"
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
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">
            {files.length === 0 ? "No files yet." : "No files match your search."}
          </p>
        ) : view === "card" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((f) => {
              const Icon = fileIcon(f.fileType)
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPreview(f)}
                  className="rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-300 hover:shadow-md"
                >
                  <Icon className="mb-2 h-8 w-8 text-indigo-600" />
                  <p className="truncate text-sm font-medium text-zinc-900" title={f.title}>{f.title}</p>
                  <p className="text-xs text-zinc-500">{formatSize(f.size)}</p>
                </button>
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
                    <tr
                      key={f.id}
                      onClick={() => setPreview(f)}
                      className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-indigo-600" />
                          <span className="truncate text-zinc-900" title={f.title}>{f.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">{f.fileType || "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{formatSize(f.size)}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{formatDate(f.createdAt)}</td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
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
      </section>

      {/* File preview drawer (Windows 11 style) */}
      {preview && (
        <>
          <div
            className="fixed inset-0 z-40 bg-zinc-900/40"
            onClick={() => setPreview(null)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h3 className="truncate text-sm font-semibold text-zinc-900" title={preview.title}>
                {preview.title}
              </h3>
              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Close preview"
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Thumbnail */}
              <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
                {preview.fileType.startsWith("image/") ? (
                  <FileImage className="h-16 w-16 text-zinc-300" />
                ) : (
                  (() => {
                    const Icon = fileIcon(preview.fileType)
                    return <Icon className="h-16 w-16 text-zinc-300" />
                  })()
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                  Open
                </button>
                <button type="button" className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  <Share2 className="h-4 w-4" /> Share
                </button>
                <button type="button" className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  <Download className="h-4 w-4" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => toggleStar(preview.id)}
                  className={`flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 ${starred.has(preview.id) ? "text-amber-600" : "text-zinc-700"}`}
                >
                  <Star className={`h-4 w-4 ${starred.has(preview.id) ? "fill-amber-500" : ""}`} /> Star
                </button>
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === preview.id ? null : preview.id)}
                  className="rounded-lg border border-zinc-200 p-1.5 text-zinc-700 hover:bg-zinc-50"
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {openMenu === preview.id && (
                  <div className="absolute right-4 z-10 mt-10 w-32 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleDelete(preview.id)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Details</h4>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Type</dt>
                    <dd className="truncate text-zinc-900">{preview.fileType || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Size</dt>
                    <dd className="text-zinc-900">{formatSize(preview.size)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Modified</dt>
                    <dd className="text-zinc-900">{formatDate(preview.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Created</dt>
                    <dd className="text-zinc-900">{formatDate(preview.createdAt)}</dd>
                  </div>
                </dl>
              </div>

              {/* Quick actions */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Quick actions</h4>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_ACTIONS.map((a) => {
                    const Icon = a.icon
                    const content = (
                      <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 bg-white p-3 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50">
                        <Icon className="h-5 w-5 text-indigo-600" />
                        <span className="text-xs font-medium text-zinc-700">{a.label}</span>
                      </div>
                    )
                    return a.href ? (
                      <a key={a.key} href={a.href} className="block">
                        {content}
                      </a>
                    ) : (
                      <button key={a.key} type="button" onClick={() => onQuickAction(a.key)} className="block">
                        {content}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
