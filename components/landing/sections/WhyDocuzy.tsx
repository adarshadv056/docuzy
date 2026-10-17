"use client"

import { motion, useReducedMotion } from "framer-motion";
import {
  FileText,
  Cloud,
  Image as ImageIcon,
  MessageSquare,
  Download,
  FileEdit,
  Search,
  Sparkles,
} from "lucide-react";

// Fragmented tools shown in the "Before Docuzy" state.
// Labels are the approved set from CONTENT.md §4.3. Icons stay neutral (no rainbow
// palette) so the neutral "before" side reads as unresolved vs. the indigo-accented
// "With Docuzy" side.
const fragmentedTools = [
  { name: "PDF Tool", icon: FileText },
  { name: "Cloud Folder", icon: Cloud },
  { name: "Image Converter", icon: ImageIcon },
  { name: "AI Chat", icon: MessageSquare },
  { name: "Downloads", icon: Download },
  { name: "Document Editor", icon: FileEdit },
];

// Believable fictional sample files (DESIGN.md §10 organization guidance).
const workspaceFiles = [
  { name: "Lecture Notes.pdf", type: "PDF", meta: "24 pages" },
  { name: "Research Paper.pdf", type: "PDF", meta: "18 pages" },
  { name: "Project Report.docx", type: "DOC", meta: "12 pages" },
  { name: "Semester Project.pdf", type: "PDF", meta: "6 pages" },
];

export default function WhyDocuzy() {
  const prefersReduced = useReducedMotion();

  const reveal = (delay = 0) =>
    prefersReduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" },
          transition: { duration: 0.5, delay, ease: "easeOut" as const },
        };

  return (
    <section className="w-full bg-[#FAFAFA] text-zinc-900">
      <div className="w-full max-w-6xl mx-auto px-6 py-24 md:py-28">
        {/* Header */}
        <motion.div {...reveal()} className="max-w-3xl mx-auto text-center">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-indigo-600 mb-3">
            Why Docuzy
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.1]">
            Your documents are everywhere.{" "}
            <br className="hidden md:block" />
            Your workspace shouldn&apos;t be.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-600 leading-relaxed">
            Files in one place. PDF tools in another. AI somewhere else. Docuzy brings them
            together into one workspace.
          </p>
        </motion.div>

        {/* Comparison */}
        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          {/* BEFORE — quiet, neutral, fragmented */}
          <motion.div
            {...reveal(0.05)}
            className="flex flex-col rounded-[22px] border border-zinc-200 bg-[#F4F4F5] p-6 md:p-8"
          >
            <h3 className="text-xl md:text-2xl font-bold text-zinc-900">Before Docuzy</h3>
            <p className="mt-2 text-sm md:text-base text-zinc-600">
              Files here. Tools there. AI somewhere else.
            </p>

            <div className="mt-6 grid flex-1 grid-cols-2 content-start gap-3">
              {fragmentedTools.map((tool, i) => (
                <div
                  key={tool.name}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]"
                  style={{
                    transform:
                      i % 2 === 1
                        ? "translateY(12px) rotate(0.6deg)"
                        : "translateY(0) rotate(-0.6deg)",
                  }}
                >
                  <div className="flex items-center gap-1 border-b border-zinc-100 bg-zinc-50 px-2.5 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <tool.icon className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span className="truncate text-xs font-medium text-zinc-600">
                      {tool.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-auto pt-6 text-sm font-medium text-zinc-500">
              Too many tools. Too many tabs. Too much friction.
            </p>
          </motion.div>

          {/* WITH DOCUZY — resolved, coherent, light workspace */}
          <motion.div
            {...reveal(0.1)}
            className="flex flex-col rounded-[22px] border border-indigo-100 bg-white p-6 md:p-8 shadow-[0_20px_60px_rgba(24,24,27,0.10)]"
          >
            <h3 className="text-xl md:text-2xl font-bold text-zinc-900">With Docuzy</h3>
            <p className="mt-2 text-sm md:text-base text-zinc-600">
              Store your documents. Work with them. Use the right tools. Ask AI when you need
              it.
            </p>

            {/* Workspace preview */}
            <div className="mt-6 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_28px_rgba(24,24,27,0.06)]">
              {/* Window bar: destinations + search */}
              <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                <div className="ml-2 hidden items-center gap-1 text-xs font-medium sm:flex">
                  <span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">
                    Documents
                  </span>
                  <span className="px-2 py-1 text-zinc-500">Tools</span>
                  <span className="px-2 py-1 text-zinc-500">AI</span>
                </div>
                <div className="ml-auto flex max-w-[180px] items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-400">
                  <Search className="h-3 w-3 shrink-0" />
                  <span className="truncate">Search workspace...</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-700">
                    Recent Documents
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">4 files</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {workspaceFiles.map((file, i) => (
                    <div
                      key={file.name}
                      className={`flex items-center gap-2 rounded-lg border p-2 ${
                        i === 0
                          ? "border-indigo-200 bg-indigo-50/50"
                          : "border-zinc-100 bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                          i === 0 ? "bg-indigo-100 text-indigo-600" : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-medium text-zinc-700">
                          {file.name}
                        </span>
                        <span className="block text-[10px] text-zinc-400">
                          {file.type} · {file.meta}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* AI entry point */}
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                  <span className="truncate text-[11px] text-zinc-400">
                    Ask AI about your documents...
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* DESIGN.md §16 placeholder — keep labelled until a real screenshot exists. */}
        <p className="mt-6 text-center text-[11px] font-medium text-zinc-400">
          [PRODUCT UI PLACEHOLDER — &ldquo;With Docuzy&rdquo; workspace preview. Replace with a
          real screenshot once the workspace screen is implemented.]
        </p>
      </div>
    </section>
  );
}
