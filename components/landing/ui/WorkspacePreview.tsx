"use client"

import { motion } from "framer-motion";
import { FileText, Folder, Layers, Sparkles, Settings, Search } from "lucide-react";

export default function WorkspacePreview() {
  return (
    <div className="relative -mt-20 z-10">
      <div className="relative w-full max-w-5xl mx-auto">
        <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-[0_20px_60px_rgba(24,24,27,0.10)] overflow-hidden aspect-[16/10] md:aspect-[21/10] flex flex-col">
          {/* Window header */}
          <div className="h-12 border-b border-zinc-100 bg-zinc-50 flex items-center px-4 gap-2 shrink-0">
            <div className="w-3 h-3 rounded-full bg-zinc-300" />
            <div className="w-3 h-3 rounded-full bg-zinc-300" />
            <div className="w-3 h-3 rounded-full bg-zinc-300" />
            <div className="mx-auto text-xs font-medium text-zinc-500">Docuzy Workspace</div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-48 md:w-64 border-r border-zinc-100 p-4 flex flex-col gap-2 bg-zinc-50/60 hidden sm:flex">
              <div className="text-xs font-semibold text-zinc-400 mb-2 px-2">MENU</div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md">
                <Folder className="w-4 h-4" /> Documents
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900">
                <Layers className="w-4 h-4" /> Recent
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md mt-4">
                <Sparkles className="w-4 h-4" /> AI Chat
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 p-6 flex flex-col gap-6 relative">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900">Recent Documents</h3>
                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-zinc-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { title: "Biology Notes", type: "PDF" },
                  { title: "Research Paper", type: "DOC" },
                  { title: "Final Project", type: "PDF" }
                ].map((doc, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                    className="p-4 rounded-xl border border-zinc-200 bg-white shadow-xs flex flex-col gap-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-800">{doc.title}</div>
                      <div className="text-xs text-zinc-500">{doc.type}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* AI Chat preview - animated */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              className="absolute bottom-6 right-6 w-72 rounded-xl border border-zinc-200 bg-white shadow-[0_12px_36px_rgba(24,24,27,0.12)] p-4 flex flex-col gap-3 hidden md:flex"
            >
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-sm text-zinc-700 leading-relaxed">
                  Based on your research paper, the key findings highlight a 40% increase in efficiency.
                </div>
              </div>
              <div className="h-10 mt-2 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center px-3 gap-2">
                <Search className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-400">Ask your document...</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* DESIGN.md §16 placeholder — keep labelled until a real screenshot exists. */}
      <p className="mx-auto mt-4 max-w-5xl px-6 text-center text-[11px] font-medium text-zinc-400">
        [PRODUCT UI PLACEHOLDER — Illustrative Docuzy workspace preview. Replace with a real
        screenshot once the workspace screen is implemented.]
      </p>
    </div>
  );
}
