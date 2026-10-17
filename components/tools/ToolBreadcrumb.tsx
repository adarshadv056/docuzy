"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { allTools, toolHref } from "@/lib/tools-catalog"

// Resolve a /tools/<slug> path to its display name from the shared catalog.
const toolNameByHref = new Map(
  allTools()
    .filter((tool) => tool.status === "available" && !!tool.slug)
    .map((tool) => [toolHref(tool), tool.name] as const)
)

/**
 * Breadcrumb shown on every tool page (DESIGN.md §532). Also gives tool pages,
 * which otherwise render without any nav, a way back to the directory.
 * Renders nothing on the directory itself (/tools) or unknown paths.
 */
export default function ToolBreadcrumb() {
  const pathname = usePathname()
  const name = toolNameByHref.get(pathname)

  if (!name) return null

  return (
    <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-6xl px-6 pt-6">
      <ol className="flex items-center gap-1.5 text-sm">
        <li>
          <Link href="/tools" className="text-zinc-500 transition-colors hover:text-zinc-900">
            Tools
          </Link>
        </li>
        <li aria-hidden="true" className="flex items-center">
          <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
        </li>
        <li aria-current="page" className="font-medium text-zinc-900">
          {name}
        </li>
      </ol>
    </nav>
  )
}
