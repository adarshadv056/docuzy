"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, X } from "lucide-react"
import {
  toolsCatalog,
  availableToolCount,
  toolHref,
  type CatalogTool,
  type ToolCategory,
} from "@/lib/tools-catalog"

function ToolCard({ tool }: { tool: CatalogTool }) {
  const href = tool.status === "available" && tool.slug ? toolHref(tool) : undefined
  const icon = (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        tool.status === "available" ? "bg-zinc-100 text-zinc-500" : "bg-zinc-100 text-zinc-400"
      }`}
    >
      <tool.icon className="h-4 w-4" />
    </span>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {icon}
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-zinc-800 group-hover:text-indigo-700">
            {tool.name}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{tool.description}</span>
        </span>
      </Link>
    )
  }

  return (
    <div
      aria-disabled="true"
      className="flex cursor-not-allowed items-start gap-3 rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-4 opacity-80"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-600">{tool.name}</span>
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            Coming soon
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">{tool.description}</span>
      </span>
    </div>
  )
}

function CategorySection({ category }: { category: ToolCategory }) {
  const total = category.groups.reduce((sum, group) => sum + group.tools.length, 0)

  return (
    <section id={category.id} className="scroll-mt-24">
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <category.icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">{category.label}</h2>
          <p className="text-sm text-zinc-500">
            {category.description} <span className="text-zinc-400">· {total} tools</span>
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {category.groups.map((group) => (
          <div key={group.label}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {group.label}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function ToolsDirectory() {
  const [query, setQuery] = useState("")
  const normalized = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!normalized) return toolsCatalog

    return toolsCatalog
      .map((category) => {
        const groups = category.groups
          .map((group) => ({
            ...group,
            tools: group.tools.filter(
              (tool) =>
                tool.name.toLowerCase().includes(normalized) ||
                tool.description.toLowerCase().includes(normalized)
            ),
          }))
          .filter((group) => group.tools.length > 0)

        return { ...category, groups }
      })
      .filter((category) => category.groups.length > 0)
  }, [normalized])

  const matchCount = filtered.reduce(
    (sum, category) => sum + category.groups.reduce((s, group) => s + group.tools.length, 0),
    0
  )

  return (
    <div className="w-full">
      {/* Search */}
      <div className="relative mb-10 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          aria-label="Search tools"
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-10 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 transition-colors hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {normalized && (
        <p className="mb-8 text-sm text-zinc-500">
          {matchCount} {matchCount === 1 ? "tool" : "tools"} matching “{query.trim()}”
        </p>
      )}

      {normalized && matchCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <p className="text-sm font-semibold text-zinc-700">No tools match your search.</p>
          <p className="mt-1 text-sm text-zinc-500">Try a different word, or clear the search to see everything.</p>
        </div>
      ) : (
        <div className="space-y-16">
          {filtered.map((category) => (
            <CategorySection key={category.id} category={category} />
          ))}
        </div>
      )}

      <p className="mt-16 text-sm text-zinc-400">
        {availableToolCount} tools are ready to use today. Tools marked “Coming soon” aren’t built yet.
      </p>
    </div>
  )
}
