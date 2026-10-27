"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useReducedMotion } from "framer-motion"
import {
  ArrowRight,
  ChevronDown,
  Menu,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react"
import { findTool, toolHref } from "@/lib/tools-catalog"

// Public nav — CONTENT.md §4.1. Section links use absolute anchors so they also
// resolve from /tools; the tools entry opens a curated showcase of top tools.
const navLinks = [
  { label: "AI Workspace", href: "/#ai" },
  { label: "PDF & Image Tools", href: "/#tools", mega: true },
  { label: "Organization", href: "/#organization" },
  { label: "How It Works", href: "/#how-it-works" },
] as const

interface CuratedTool {
  name: string
  description: string
  href: string
  icon: LucideIcon
}

interface CuratedColumn {
  title: string
  tools: CuratedTool[]
}

// Option A: 3 thematic columns with the top 5 most essential tools per category
const curatedColumns: CuratedColumn[] = [
  {
    title: "Organize & Edit",
    tools: [
      "merge-pdf",
      "split-pdf",
      "compress-pdf",
      "edit-pdf",
      "scan-document",
    ]
      .map((slug) => findTool(slug))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => ({ name: t.name, description: t.description, href: toolHref(t), icon: t.icon })),
  },
  {
    title: "Convert to & from PDF",
    tools: [
      "pdf-to-word",
      "word-to-pdf",
      "image-to-pdf",
      "pdf-to-excel",
      "ebook-to-pdf",
    ]
      .map((slug) => findTool(slug))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => ({ name: t.name, description: t.description, href: toolHref(t), icon: t.icon })),
  },
  {
    title: "Security & Images",
    tools: [
      "sign-pdf",
      "encrypt-pdf",
      "compress-image",
      "edit-image",
      "watermark-pdf",
    ]
      .map((slug) => findTool(slug))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => ({ name: t.name, description: t.description, href: toolHref(t), icon: t.icon })),
  },
]

export default function Navbar() {
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const prefersReduced = useReducedMotion()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleOpenTools = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setToolsOpen(true)
  }

  const handleCloseTools = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setToolsOpen(false)
    }, 200)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Hide while scrolling down, reveal immediately on any scroll up — so the nav
  // is always one small gesture away (DESIGN.md §13 motion guardrails).
  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y < 96) setHidden(false)
      else if (y > lastY) setHidden(true)
      else if (y < lastY) setHidden(false)
      lastY = y
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        transform: hidden && !menuOpen ? "translateY(-100%)" : "translateY(0)",
        transition: prefersReduced
          ? "none"
          : `transform ${hidden && !menuOpen ? "220ms" : "0ms"} cubic-bezier(0.2, 0.7, 0.2, 1)`,
      }}
    >
      <div className="border-b border-zinc-200/80 bg-white/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md"
          >
            Docuzy
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) =>
              "mega" in link && link.mega ? (
                <div
                  key={link.label}
                  className="relative flex h-16 items-center"
                  onMouseEnter={handleOpenTools}
                  onMouseLeave={handleCloseTools}
                >
                  <button
                    type="button"
                    aria-expanded={toolsOpen}
                    onClick={() => setToolsOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {link.label}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${toolsOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Horizontal Mega-Menu: Zero-Scroll Curated Showcase */}
                  {toolsOpen && (
                    <div
                      className="fixed left-1/2 top-16 z-50 w-[min(94vw,56rem)] -translate-x-1/2 pt-1"
                      onMouseEnter={handleOpenTools}
                      onMouseLeave={handleCloseTools}
                    >
                      {/* Invisible hover bridge connecting navbar to popover */}
                      <div className="absolute -top-3 inset-x-0 h-4 pointer-events-auto" />
                      <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-[0_20px_50px_rgba(24,24,27,0.14)]">
                        {/* 3 Thematic Columns */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {curatedColumns.map((col) => (
                            <div key={col.title} className="space-y-2">
                              <h3 className="px-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                {col.title}
                              </h3>
                              <div className="space-y-1">
                                {col.tools.map((tool) => (
                                  <Link
                                    key={tool.href}
                                    href={tool.href}
                                    onClick={() => setToolsOpen(false)}
                                    className="group flex items-center gap-3 rounded-xl p-2 transition-all hover:bg-indigo-50/60"
                                  >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                                      <tool.icon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-xs font-semibold text-zinc-800 group-hover:text-indigo-700">
                                        {tool.name}
                                      </div>
                                      <div className="truncate text-[11px] text-zinc-400">
                                        {tool.description}
                                      </div>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Footer Bar */}
                        <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 text-xs">
                          <span className="flex items-center gap-1.5 text-zinc-400">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                            <span>100% In-Browser • Zero file uploads</span>
                          </span>
                          <Link
                            href="/tools"
                            onClick={() => setToolsOpen(false)}
                            className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            <span>Explore all 38+ tools in directory</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Desktop actions */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </div>

      {/* Mobile panel */}
      {menuOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-zinc-200 bg-white px-6 pb-6 pt-3 shadow-lg md:hidden">
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Mobile Curated Groups */}
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <div className="space-y-4">
              {curatedColumns.map((col) => (
                <div key={col.title}>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    {col.title}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {col.tools.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="group flex items-center gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50/60 p-2 text-xs font-medium text-zinc-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-500 shadow-xs group-hover:bg-indigo-600 group-hover:text-white">
                          <item.icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate">{item.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-2 text-center">
                <Link
                  href="/tools"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  <span>Browse full 38+ tools directory</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-center text-sm font-bold text-zinc-900 hover:bg-zinc-50"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-zinc-800"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
