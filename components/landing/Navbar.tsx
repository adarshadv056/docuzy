"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useReducedMotion } from "framer-motion"
import { ChevronDown, Menu, X } from "lucide-react"
import { availableToolsInCategory } from "@/lib/tools-catalog"

// Public nav — CONTENT.md §4.1. Section links use absolute anchors so they also
// resolve from /tools; the tools entry opens a details-box sub-nav of the real
// tool routes (CONTENT.md §4.5), sourced from the shared catalog.
const navLinks = [
  { label: "AI Workspace", href: "/#ai" },
  { label: "PDF & Image Tools", href: "/#tools", mega: true },
  { label: "Organization", href: "/#organization" },
  { label: "How It Works", href: "/#how-it-works" },
] as const

// Only tools that actually exist today (catalog `available`), per CONTENT.md §4.5.
const toolsMenu = [
  {
    label: "PDF tools",
    items: availableToolsInCategory("pdf").map((tool) => ({ name: tool.name, href: tool.href })),
  },
  {
    label: "Image tools",
    items: availableToolsInCategory("image").map((tool) => ({ name: tool.name, href: tool.href })),
  },
]

export default function Navbar() {
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const prefersReduced = useReducedMotion()

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
                  className="relative"
                  onMouseEnter={() => setToolsOpen(true)}
                  onMouseLeave={() => setToolsOpen(false)}
                >
                  <button
                    type="button"
                    aria-expanded={toolsOpen}
                    onClick={() => setToolsOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {link.label}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${toolsOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {toolsOpen && (
                    <div className="absolute left-1/2 top-full z-50 w-[36rem] -translate-x-1/2 pt-2">
                      <div className="grid grid-cols-2 gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_12px_36px_rgba(24,24,27,0.12)]">
                        {toolsMenu.map((group) => (
                          <div key={group.label}>
                            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                              {group.label}
                            </div>
                            <ul className="space-y-1">
                              {group.items.map((item) => (
                                <li key={item.href}>
                                  <Link
                                    href={item.href}
                                    className="block rounded-md px-2 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                  >
                                    {item.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        <div className="col-span-2 border-t border-zinc-100 pt-3">
                          <Link
                            href="/tools"
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            Browse all tools →
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

          <div className="mt-4 border-t border-zinc-100 pt-4">
            {toolsMenu.map((group) => (
              <div key={group.label} className="mb-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  {group.label}
                </div>
                <ul className="grid grid-cols-2 gap-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-col gap-2 border-t border-zinc-100 pt-4">
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
