"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Folder, FileText, Search } from "lucide-react"

const folders = ["Semester 5", "BDM", "Projects", "Research"]
const tags = ["Assignments", "Notes", "Research"]
const files = [
  { name: "Research Paper.pdf", meta: "2 MB" },
  { name: "BDM Report.docx", meta: "1.2 MB" },
  { name: "MAD Project.pdf", meta: "4.5 MB" },
  { name: "Lecture Notes.pdf", meta: "800 KB" },
]

export default function OrganizationFeature() {
  const prefersReduced = useReducedMotion()

  const reveal = (delay = 0) =>
    prefersReduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" },
          transition: { duration: 0.5, delay, ease: "easeOut" as const },
        }

  return (
    <section id="organization" className="scroll-mt-24 w-full bg-[#FAFAFA] text-zinc-900">
      <div className="w-full max-w-6xl mx-auto px-6 py-24 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <motion.div {...reveal()}>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-indigo-600 mb-3">
              Your Documents
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.1] mb-5">
              Everything has a place.
            </h2>
            <p className="text-lg text-zinc-600 leading-relaxed">
              Keep lecture notes, assignments, research papers, and project files easy to find.
              Use folders, tags, and search to organize your documents around the way you study
              and work.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {["Folders", "Tags", "Search"].map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600"
                >
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* File-manager mock */}
          <motion.div
            {...reveal(0.1)}
            className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 shadow-[0_20px_60px_rgba(24,24,27,0.10)]"
          >
            {/* Search */}
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="text-sm text-zinc-400">Search documents...</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Folders */}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Folders
                </div>
                <ul className="space-y-1.5">
                  {folders.map((folder, i) => (
                    <li
                      key={folder}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium ${
                        i === 0 ? "bg-indigo-50 text-indigo-700" : "text-zinc-600"
                      }`}
                    >
                      <Folder
                        className={`h-4 w-4 shrink-0 ${i === 0 ? "text-indigo-500" : "text-zinc-400"}`}
                      />
                      {folder}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tags */}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Tags
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recent documents */}
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Recent Documents
              </div>
              <ul className="space-y-2">
                {files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-white px-3 py-2"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                    <span className="flex-1 truncate text-sm font-medium text-zinc-700">
                      {file.name}
                    </span>
                    <span className="text-xs text-zinc-400">{file.meta}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>

        {/* DESIGN.md §16 / CONTENT.md §4.6 placeholder — keep labelled. */}
        <p className="mt-6 text-center text-[11px] font-medium text-zinc-400">
          [PLACEHOLDER: Replace with real Docuzy file manager screenshot]
        </p>
      </div>
    </section>
  )
}
