"use client"

import { motion } from "framer-motion"
import {
  FileText,
  Sparkles,
  Sliders,
  Check,
  FolderOpen,
  ArrowRight,
  UploadCloud
} from "lucide-react"

interface AnimatedAppVisualProps {
  type: "hero" | "ai" | "tools" | "workflow"
  placeholderLabel?: string
}

export default function AnimatedAppVisual({
  type,
  placeholderLabel,
}: AnimatedAppVisualProps) {

  return (
    <div className="relative w-full rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)] overflow-hidden transition-all duration-300">
      {/* App Window Header Bar */}
      <div className="flex h-11 w-full items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4">
        {/* macOS Traffic Lights */}
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-rose-400/90" />
          <div className="h-3 w-3 rounded-full bg-amber-400/90" />
          <div className="h-3 w-3 rounded-full bg-emerald-400/90" />
        </div>

        {/* Address / Tab Route */}
        <div className="flex items-center gap-2 rounded-md border border-slate-200/70 bg-white px-3 py-1 text-[11px] font-mono text-slate-500 shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span>docuzy.app/workspace</span>
        </div>

        {/* Placeholder Tag Badge */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
            Interactive Preview
          </span>
        </div>
      </div>

      {/* Main Visual Canvas based on Type */}
      <div className="relative p-6 md:p-8 bg-slate-50/40 min-h-[340px] md:min-h-[420px] flex flex-col justify-between">
        {type === "hero" && (
          <div className="grid grid-cols-12 gap-5 h-full">
            {/* Left Sidebar: Folder taxonomy */}
            <div className="hidden md:block col-span-3 rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 pb-2 border-b border-slate-100">
                <FolderOpen className="h-3.5 w-3.5 text-indigo-600" />
                <span>Documents</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-medium">
                  <span>Biology 101</span>
                  <span className="text-[10px] bg-indigo-100 px-1.5 py-0.2 rounded font-mono">4</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50">
                  <span>Algorithms & Data</span>
                  <span className="text-[10px] text-slate-400">7</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50">
                  <span>Thesis Research</span>
                  <span className="text-[10px] text-slate-400">12</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-medium text-slate-600">#finals</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-medium text-slate-600">#reading</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[10px] font-medium text-indigo-600">#active</span>
                </div>
              </div>
            </div>

            {/* Center Area: Document Cards */}
            <div className="col-span-12 md:col-span-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-900">Recent Files</div>
                <span className="text-[11px] text-slate-400 font-mono">3 indexed</span>
              </div>

              {/* Document 1 (Active) */}
              <motion.div
                whileHover={{ y: -2 }}
                className="p-3.5 rounded-xl border-2 border-indigo-500/40 bg-white shadow-xs space-y-2 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 truncate">Cellular_Respiration_Ch4.pdf</div>
                    <div className="text-[10px] text-slate-400 font-mono">42 pages • 8.4 MB</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Indexed with pgvector
                  </span>
                </div>
              </motion.div>

              {/* Document 2 */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5 opacity-80">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-700 truncate">Algorithms_Lecture_Slides.pdf</div>
                    <div className="text-[10px] text-slate-400 font-mono">68 slides • 14.1 MB</div>
                  </div>
                </div>
              </div>

              {/* Document 3 */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5 opacity-70">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-700 truncate">Thesis_Methodology_Draft.docx</div>
                    <div className="text-[10px] text-slate-400 font-mono">19 pages • 1.2 MB</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Area: Interactive Streaming AI Chat */}
            <div className="col-span-12 md:col-span-5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Docuzy AI Assistant</span>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    Grounded RAG
                  </span>
                </div>

                {/* User Prompt */}
                <div className="ml-auto max-w-[85%] rounded-xl bg-indigo-600 text-white px-3 py-2 text-xs font-medium shadow-xs">
                  What triggers ATP synthesis in mitochondria?
                </div>

                {/* AI Streaming Response */}
                <div className="mr-auto max-w-[95%] rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2 text-xs text-slate-700">
                  <p className="leading-relaxed">
                    ATP synthesis is driven by the <strong>proton-motive force</strong> generated across the inner mitochondrial membrane by the electron transport chain{" "}
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-mono text-[10px] font-bold">
                      [1]
                    </span>
                    . Protons flow back into the matrix through ATP synthase rotor complexes{" "}
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-mono text-[10px] font-bold">
                      [2]
                    </span>
                    .
                  </p>
                  <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 text-indigo-600 font-medium">
                      <Check className="h-3 w-3" /> Cited from Page 18 & 22
                    </span>
                    <span className="font-mono">Gemini Flash</span>
                  </div>
                </div>
              </div>

              {/* Chat Input Bar */}
              <div className="mt-3 flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <input
                  type="text"
                  readOnly
                  value="Ask a question about this chapter..."
                  className="w-full bg-transparent text-xs text-slate-400 px-2 focus:outline-none"
                />
                <button
                  type="button"
                  className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {type === "ai" && (
          <div className="max-w-2xl mx-auto w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900">Cellular_Biology_Notes.pdf · Question Answering</span>
              </div>
              <span className="text-[10px] text-emerald-600 bg-emerald-50 font-bold px-2 py-0.5 rounded-md">
                100% Document Grounded
              </span>
            </div>

            <div className="space-y-3">
              <div className="ml-auto max-w-sm rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-xs font-medium">
                &ldquo;Summarize the 3 key takeaways of this chapter for my midterm.&rdquo;
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">Key Midterm Takeaways:</p>
                <ul className="space-y-1.5 list-disc pl-4">
                  <li>Glycolysis yields 2 net ATP and 2 NADH in the cytoplasm without oxygen <span className="font-mono text-indigo-600 font-bold">[1]</span>.</li>
                  <li>The Krebs Cycle completely oxidizes acetyl-CoA into CO₂ inside the mitochondrial matrix <span className="font-mono text-indigo-600 font-bold">[2]</span>.</li>
                  <li>Oxidative phosphorylation produces ~28 ATP via chemiosmosis and Complex I-IV electron transfer <span className="font-mono text-indigo-600 font-bold">[3]</span>.</li>
                </ul>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="text-indigo-600 font-medium">Sources: Pages 14, 21, and 33</span>
                  <span className="font-mono text-[10px]">Zero Hallucination Guarantee</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {type === "tools" && (
          <div className="max-w-xl mx-auto w-full p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900">PDF Compression & Utilities</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Client-Side WASM</span>
            </div>

            <div className="p-6 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 text-center space-y-2">
              <UploadCloud className="h-8 w-8 text-indigo-600 mx-auto" />
              <div className="text-xs font-bold text-slate-800">Final_Thesis_Manuscript.pdf</div>
              <div className="text-[11px] text-slate-500">Original size: 28.4 MB</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">Compression Quality</span>
                <span className="font-bold text-indigo-600 font-mono">75% (Recommended)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="w-3/4 h-full bg-indigo-600 rounded-full" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                <span>Reduced to 3.8 MB (86% reduction)</span>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-xs hover:bg-indigo-700 transition-colors"
              >
                Download PDF
              </button>
            </div>
          </div>
        )}

        {type === "workflow" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="text-[10px] font-mono font-bold text-indigo-600">STEP 01</div>
              <div className="text-xs font-bold text-slate-900">Upload & Parse</div>
              <p className="text-[11px] text-slate-500">Extracts text and layout per-page without server size caps.</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="text-[10px] font-mono font-bold text-indigo-600">STEP 02</div>
              <div className="text-xs font-bold text-slate-900">Vector Embeddings</div>
              <p className="text-[11px] text-slate-500">Chunks indexed in pgvector for sub-10ms semantic retrieval.</p>
            </div>
            <div className="p-4 rounded-xl border border-indigo-300 bg-indigo-50/50 space-y-2">
              <div className="text-[10px] font-mono font-bold text-indigo-600">STEP 03</div>
              <div className="text-xs font-bold text-indigo-950">Grounded Chat</div>
              <p className="text-[11px] text-slate-600">Instant answers streamed with clickable [1][2] page citations.</p>
            </div>
          </div>
        )}

        {/* Clear Visual Placeholder Banner for the User */}
        <div className="mt-6 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100">
            [ VISUAL PLACEHOLDER: {placeholderLabel || "Interactive App Interface Demonstration"} ]
          </span>
          <span>Swap with your MP4 screen recording or high-res UI asset</span>
        </div>
      </div>
    </div>
  )
}
