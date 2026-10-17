"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { availableToolsInCategory } from "@/lib/tools-catalog"

// CONTENT.md §4.5 — landing shelf shows approved (available) tools only, sourced
// from the shared catalog so nav/footer/directory never drift apart.
const pdfTools = availableToolsInCategory("pdf")
const imageTools = availableToolsInCategory("image")

const groups = [
  { label: "PDF tools", tools: pdfTools },
  { label: "Image tools", tools: imageTools },
]

export default function ToolsFeature() {
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
    <section id="tools" className="scroll-mt-24 w-full bg-white text-zinc-900">
      <div className="w-full max-w-6xl mx-auto px-6 py-24 md:py-28">
        {/* Header */}
        <motion.div
          {...reveal()}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-10 md:mb-14"
        >
          <div className="lg:col-span-7">
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-indigo-600 mb-3">
              PDF &amp; Image Tools
            </div>
            <h2 className="max-w-xl text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.1]">
              Handle file tasks without breaking your flow.
            </h2>
          </div>
          <p className="lg:col-span-5 text-lg text-zinc-600 leading-relaxed">
            Merge or compress PDFs, add page numbers, convert PDF pages to images, or crop and
            resize images. Docuzy brings everyday PDF and image tools together so common file
            tasks take fewer steps.
          </p>
        </motion.div>

        {/* Tool shelf */}
        <motion.div {...reveal(0.1)} className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {groups.map((group) => (
            <div
              key={group.label}
              className="rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-5 md:p-6"
            >
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {group.label}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.tools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="group flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600">
                      <tool.icon className="h-4 w-4" />
                    </span>
                    {tool.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div {...reveal(0.15)} className="mt-8 flex justify-center">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Browse all tools →
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
