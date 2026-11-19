"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileUp, FilePlus, MessageSquare, Wrench, Loader2 } from "lucide-react"
import { uploadDocument } from "@/actions/upload"
import { useToast } from "@/components/ToastProvider"

const actions = [
  { key: "upload", label: "Upload document", desc: "Add a PDF, image, or text file", icon: FileUp },
  { key: "new", label: "New document", desc: "Start a blank document", icon: FilePlus },
  { key: "ask", label: "Ask AI", desc: "Chat with your documents", icon: MessageSquare },
  { key: "tools", label: "Explore tools", desc: "PDF & image utilities", icon: Wrench },
] as const

export default function DashboardQuickActions() {
  const router = useRouter()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    let success = 0
    for (const file of files) {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadDocument(fd)
      if (res.success) success++
      else toast.error(res.message)
    }
    setUploading(false)
    if (success > 0) {
      toast.success(`${success} file${success > 1 ? "s" : ""} uploaded`)
      router.refresh()
    }
  }

  const onCardClick = (key: string) => {
    if (key === "upload") {
      fileInputRef.current?.click()
    } else if (key === "tools") {
      router.push("/dashboard/tools")
    } else if (key === "ask") {
      document.getElementById("ai-chat")?.scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      toast.success("Coming soon")
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,image/*,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          handleFiles(files)
          e.target.value = ""
        }}
      />
      {actions.map((a) => {
        const Icon = a.icon
        return (
          <button
            key={a.key}
            type="button"
            onClick={() => onCardClick(a.key)}
            disabled={uploading && a.key === "upload"}
            className="group flex flex-col items-start gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-300 hover:shadow-md disabled:opacity-60"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
              {uploading && a.key === "upload" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{a.label}</p>
              <p className="text-xs text-zinc-500">{a.desc}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
