"use client"

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Sparkles, FileText, Files, Image } from "lucide-react";
import Button from "@/components/landing/ui/Button";
import WorkspacePreview from "@/components/landing/ui/WorkspacePreview";

export default function Hero() {
  const { scrollY } = useScroll();
  const glowOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const glowScale = useTransform(scrollY, [0, 500], [1, 0.8]);
  const previewY = useTransform(scrollY, [0, 500], [0, -100]);

  return (
    <>
      <section className="relative min-h-screen flex flex-col items-center pt-2 pb-20 px-6 overflow-hidden bg-[#FAFAFA] text-zinc-900">
        {/* Background glow - animated on scroll (original blurred-indigo blob) */}
        <motion.div
          aria-hidden="true"
          style={{ opacity: glowOpacity, scale: glowScale }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[400px] bg-indigo-600/30 blur-[100px] md:blur-[120px] rounded-full pointer-events-none"
        />

        <div className="relative z-10 w-full max-w-5xl px-6 py-24 mx-auto text-center flex flex-col items-center">
          {/* Eyebrow badge - matches waitlist page */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center px-3 py-1.5 mb-8 space-x-2 text-sm font-medium rounded-full bg-white border border-zinc-200 text-zinc-700 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Docuzy · Live</span>
          </motion.div>

          {/* Headline - from waitlist page */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-b from-zinc-800 to-zinc-500 selection:text-zinc-900 leading-[1.05]"
          >
            Your Entire Workspace. <br className="hidden md:block" />
            Organized & <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-indigo-600">AI-Powered.</span>
          </motion.h1>

          {/* Description - from waitlist page */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-600 mb-10 font-medium leading-relaxed"
          >
            Every editing tool you need, in one place. Organize your files, share your work,
            and let our AI handle the heavy lifting with <span className="font-bold text-zinc-900">Docuzy</span>.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <Button size="lg" variant="primary" className="group">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="lg" className="group">
              Explore the Workspace
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>

          {/* Capability row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-zinc-600 mt-8"
          >
            <span className="inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              PDFs
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Files className="w-3.5 h-3.5 text-indigo-500" />
              Documents
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5 text-indigo-500" />
              Images
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              AI
            </span>
          </motion.div>
        </div>
      </section>


      {/* Dashboard Preview Section - overlaps with hero */}
      <motion.section
        style={{ y: previewY }}
        className="relative -mt-20 z-10"
      >
        <WorkspacePreview />
      </motion.section>
    </>
  );
}