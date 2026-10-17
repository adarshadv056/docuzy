import type { Metadata } from "next"
import Navbar from "@/components/landing/Navbar"
import Footer from "@/components/landing/sections/Footer"
import ToolsDirectory from "@/components/tools/ToolsDirectory"

export const metadata: Metadata = {
  title: "PDF & Image Tools for Everyday File Tasks",
  description:
    "Find the PDF and image tool you need—from merging and compressing PDFs to cropping, resizing, and converting images.",
  alternates: {
    canonical: "/tools",
  },
}

export default function ToolsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAFAFA] font-sans text-zinc-900 selection:bg-indigo-500/20">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-28 md:pt-32">
        <header className="mb-12 max-w-2xl">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-indigo-600">All Tools</div>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-zinc-900 md:text-5xl">
            PDF &amp; Image Tools for Everyday File Tasks
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-600">
            Find the PDF and image tool you need—from merging and compressing PDFs to cropping, resizing,
            and converting images.
          </p>
        </header>

        <ToolsDirectory />
      </main>
      <Footer />
    </div>
  )
}
