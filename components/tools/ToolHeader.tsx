import type { CatalogTool } from "@/lib/tools-catalog"

/**
 * Server-rendered heading for a tool page. The copy comes from the catalog so
 * every tool page has a unique, consistent H1 without hand-maintained markup
 * (CONTENT.md §6).
 */
export default function ToolHeader({ tool }: { tool: CatalogTool }) {
  return (
    <header className="mb-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        {tool.seo?.title ?? tool.name}
      </h1>
      <p className="mt-2 text-zinc-500">{tool.description}</p>
    </header>
  )
}
