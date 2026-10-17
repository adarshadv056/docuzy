"use client"

import { motion, useReducedMotion } from "framer-motion";
import { FileText, Sparkles, ArrowUp, ShieldCheck } from "lucide-react";

// Approved example prompts from CONTENT.md §4.4 (shown inside the interface).
const examplePrompts = [
  "Summarize this chapter.",
  "What are the main findings?",
  "Explain this concept in simple terms.",
];

type Block = { type: "heading" | "paragraph"; text: string; highlight?: boolean };

// Legible sample document content instead of endless grey skeleton lines
// (DESIGN.md §10). One passage is selected/highlighted.
const documentBlocks: Block[] = [
  { type: "heading", text: "Abstract" },
  {
    type: "paragraph",
    text: "This paper examines how AI-assisted tools affect document processing workflows, focusing on the time saved and the accuracy of information extraction across common document types.",
  },
  { type: "heading", text: "Results" },
  {
    type: "paragraph",
    text: "AI-assisted summarization reduced processing time by 40%. Key-information extraction accuracy exceeded 94%, and user satisfaction rose by 67% compared with manual review.",
    highlight: true,
  },
];

export default function AIChatFeature() {
  const prefersReduced = useReducedMotion();

  const reveal = (delay = 0, y = 20) =>
    prefersReduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" },
          transition: { duration: 0.5, delay, ease: "easeOut" as const },
        };

  return (
    <section id="ai" className="scroll-mt-24 w-full bg-[#FAFAFA] text-zinc-900">
      <div className="w-full max-w-6xl mx-auto px-6 py-24 md:py-28">
        {/* Header — asymmetric to vary rhythm from the centered sections above */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-10 md:mb-14">
          <motion.div {...reveal()} className="lg:col-span-7">
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-indigo-600 mb-3">
              AI Document Chat
            </div>
            <h2 className="max-w-xl text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.1]">
              Ask your documents, not the internet.
            </h2>
          </motion.div>
          <motion.p
            {...reveal(0.1)}
            className="lg:col-span-5 text-lg text-zinc-600 leading-relaxed"
          >
            Upload a PDF or supported document, ask a question, and get contextual answers
            based on its content. Summarize a chapter, explain a concept, or find key points
            without searching page by page.
          </motion.p>
        </div>

        {/* Subheading beside the UI */}
        <motion.div {...reveal(0.15)} className="mb-6 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold tracking-wide text-indigo-600">
            Understand more. Search less.
          </span>
        </motion.div>

        {/* Document reader + AI panel showcase */}
        <motion.div
          {...reveal(0.2, 24)}
          className="overflow-hidden rounded-[22px] border border-zinc-200 bg-white shadow-[0_20px_60px_rgba(24,24,27,0.10)]"
        >
          {/* Title bar */}
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                <FileText className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-medium text-zinc-700">
                Research Paper.pdf
              </span>
              <span className="hidden text-xs text-zinc-400 sm:inline">· 18 pages</span>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
              <Sparkles className="h-3.5 w-3.5" />
              Docuzy AI
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Document reader — gets the larger share of the width */}
            <div className="border-b border-zinc-100 p-5 md:p-7 lg:col-span-7 lg:border-b-0 lg:border-r">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Document
              </div>
              {documentBlocks.map((block, i) =>
                block.type === "heading" ? (
                  <div
                    key={i}
                    className="mb-2 mt-5 text-sm font-bold text-zinc-900 first:mt-0"
                  >
                    {block.text}
                  </div>
                ) : (
                  <p
                    key={i}
                    className={
                      block.highlight
                        ? "mb-3 rounded-lg border-l-4 border-indigo-500 bg-indigo-50 px-4 py-3 text-sm leading-relaxed text-zinc-700"
                        : "mb-3 text-sm leading-relaxed text-zinc-600"
                    }
                  >
                    {block.text}
                  </p>
                )
              )}
            </div>

            {/* AI panel */}
            <div className="flex flex-col bg-zinc-50/60 lg:col-span-5">
              <div className="flex-1 space-y-4 p-4 md:p-5">
                {/* Question */}
                <motion.div
                  {...reveal(0.35)}
                  className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm"
                >
                  What are the main findings?
                </motion.div>

                {/* Contextual answer */}
                <motion.div
                  {...reveal(0.55)}
                  className="mr-auto max-w-[92%] rounded-2xl rounded-bl-sm border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                      <Sparkles className="h-3 w-3" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Docuzy AI
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-700">
                    The paper reports three key findings:
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-zinc-700">
                    <li>
                      Processing time fell by{" "}
                      <span className="font-semibold text-indigo-600">40%</span> with
                      AI-assisted summarization.
                    </li>
                    <li>Key-information extraction accuracy exceeded 94%.</li>
                    <li>User satisfaction rose by 67% versus manual review.</li>
                  </ul>
                </motion.div>
              </div>

              {/* Prompt chips + composer + grounding label */}
              <div className="border-t border-zinc-100 bg-white p-4 md:p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  {examplePrompts.map((prompt) => (
                    <span
                      key={prompt}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-600"
                    >
                      {prompt}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <span className="flex-1 truncate text-sm text-zinc-400">
                    Ask a question about this document...
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <ArrowUp className="h-4 w-4" />
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                  Answers grounded in your document content.
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* DESIGN.md §16 placeholder — keep labelled until a real screenshot exists. */}
        <p className="mt-4 text-center text-[11px] font-medium text-zinc-400">
          [PRODUCT UI PLACEHOLDER — Document reader + AI chat. Replace with a real screenshot
          once the document reader and chat screens are implemented.]
        </p>
      </div>
    </section>
  );
}
