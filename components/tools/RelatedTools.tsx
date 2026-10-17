import Link from "next/link"
import { relatedTools, toolHref, type CatalogTool } from "@/lib/tools-catalog"

/**
 * Server-rendered internal links to closely related tools (CONTENT.md §6.8).
 * Resolved from each tool's `related` slugs in the catalog.
 */
export default function RelatedTools({ tool }: { tool: CatalogTool }) {
  const tools = relatedTools(tool)
  if (tools.length === 0) return null

  return (
    <section className="mt-16 border-t border-zinc-200 pt-8">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Related tools</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tools.map((related) => (
          <Link
            key={related.slug}
            href={toolHref(related)}
            className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600">
              <related.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-zinc-800 group-hover:text-indigo-700">
                {related.name}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{related.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
