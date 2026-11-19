"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react"
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions"
import AllFilesView, { type AllFile } from "@/components/dashboard/AllFilesView"
import ChatZone from "@/components/ChatZone"
import ToastProvider from "@/components/ToastProvider"

const STORAGE_KEY = "docuzy:dashboard-chat-collapsed"

export default function DashboardShell({
  documentsCount,
  recent,
  allFiles,
  chatDocs,
}: {
  documentsCount: number
  recent: { id: string; title: string; fileType: string }[]
  allFiles: AllFile[]
  chatDocs: { id: string; title: string }[]
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "true") setCollapsed(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false")
    } catch {
      // ignore
    }
  }, [collapsed])

  return (
    <ToastProvider>
      <div className={`grid grid-cols-1 gap-6 ${collapsed ? "" : "xl:grid-cols-[1fr_420px]"}`}>
        <div className="min-w-0 space-y-8">
          <DashboardQuickActions />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">Recently opened</h2>
              {documentsCount > 4 && (
                <span className="text-xs text-zinc-500">Showing 4 of {documentsCount}</span>
              )}
            </div>
            {recent.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
                No recent files yet. Upload a document to get started.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {recent.map((d) => (
                  <div key={d.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                    </div>
                    <p className="truncate text-sm font-medium text-zinc-900" title={d.title}>{d.title}</p>
                    <p className="text-xs text-zinc-500">{d.fileType || "file"}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900">All files</h2>
            <AllFilesView files={allFiles} />
          </section>
        </div>

        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand AI chat"
            className="hidden xl:flex fixed right-4 top-1/2 z-30 -translate-y-1/2 flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-4 shadow-lg hover:bg-zinc-50"
          >
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <span className="text-[10px] font-medium text-zinc-600 [writing-mode:vertical-rl] rotate-180">AI Chat</span>
          </button>
        ) : (
          <div id="ai-chat" className="xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">AI Chat</h2>
                  <p className="text-xs text-zinc-500">Ask questions about your documents</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse AI chat"
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatZone documents={chatDocs} />
              </div>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
