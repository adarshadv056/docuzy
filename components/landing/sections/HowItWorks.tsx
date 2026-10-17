"use client"

import { motion, useReducedMotion } from "framer-motion"
import { UploadCloud, FolderOpen, Wrench, Sparkles, type LucideIcon } from "lucide-react"

// CONTENT.md §4.7 — one connected workflow, one sentence per step.
const steps: { num: string; title: string; desc: string; icon: LucideIcon }[] = [
  {
    num: "01",
    title: "Upload",
    desc: "Bring your PDFs and other supported files into Docuzy.",
    icon: UploadCloud,
  },
  {
    num: "02",
    title: "Organize",
    desc: "Use folders, tags, and search to keep documents easy to find.",
    icon: FolderOpen,
  },
  {
    num: "03",
    title: "Work",
    desc: "Use available editing, PDF, and image tools for everyday file tasks.",
    icon: Wrench,
  },
  {
    num: "04",
    title: "Ask AI",
    desc: "Ask questions about supported documents and explore the information inside them.",
    icon: Sparkles,
  },
]

export default function HowItWorks() {
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
    <section id="how-it-works" className="scroll-mt-24 w-full bg-white text-zinc-900">
      <div className="w-full max-w-6xl mx-auto px-6 py-24 md:py-28">
        <motion.div {...reveal()} className="max-w-2xl mx-auto text-center mb-12 md:mb-16">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-indigo-600 mb-3">
            How it works
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.1] mb-5">
            From file to finished work.
          </h2>
          <p className="text-lg text-zinc-600 leading-relaxed">
            One straightforward workflow for organizing documents, working with files, and
            understanding their content.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connector line (desktop) */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute left-0 right-0 top-6 h-px bg-zinc-200"
          />

          <ol className="relative grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-6">
            {steps.map((step, i) => (
              <motion.li key={step.num} {...reveal(i * 0.08)} className="relative">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-600 shadow-sm">
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="mt-5">
                  <div className="font-mono text-xs font-semibold tracking-widest text-zinc-400">
                    {step.num}
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-zinc-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{step.desc}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
