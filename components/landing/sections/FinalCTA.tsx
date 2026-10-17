"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Button from "@/components/landing/ui/Button"

export default function FinalCTA() {
  const prefersReduced = useReducedMotion()

  const reveal = (delay = 0) =>
    prefersReduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" },
          transition: { duration: 0.6, delay, ease: "easeOut" as const },
        }

  return (
    <section className="relative overflow-hidden bg-[#FAFAFA] text-zinc-900">
      {/* Gentle indigo halo — no dark slab (DESIGN.md §10) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[400px] bg-indigo-600/15 blur-[100px] md:blur-[120px] rounded-full"
      />

      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 py-24 md:py-32 text-center">
        <motion.h2
          {...reveal()}
          className="text-4xl md:text-6xl font-bold tracking-tight text-zinc-900 leading-[1.08] mb-6"
        >
          Make your documents easier to work with.
        </motion.h2>

        <motion.p
          {...reveal(0.1)}
          className="max-w-2xl mx-auto text-lg text-zinc-600 leading-relaxed mb-10"
        >
          Bring your files, everyday tools, and document Q&amp;A together in Docuzy.
        </motion.p>

        <motion.div {...reveal(0.2)} className="flex flex-col items-center gap-6">
          <Button href="/login" size="lg" variant="primary" className="group">
            Get Started Free
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <p className="text-sm font-medium text-zinc-500">
            Your documents. Your workspace. Your AI.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
