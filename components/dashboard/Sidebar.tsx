"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, Clock, FolderOpen, LayoutGrid, LogOut, Menu, Wrench, X } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

interface SidebarUser {
  name?: string | null
  email?: string | null
  image?: string | null
}

const navItems = [
  { label: "Recent", href: "/dashboard", icon: Clock },
  { label: "All Files", href: "/dashboard/files", icon: FolderOpen },
  { label: "All Tools", href: "/dashboard/tools", icon: Wrench },
]

const STORAGE_KEY = "docuzy:dashboard-sidebar-collapsed"

export default function Sidebar({
  user,
  signOutAction,
}: {
  user: SidebarUser
  signOutAction: () => Promise<void>
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "true"
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false")
    } catch {
      // ignore
    }
  }, [collapsed])

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(href + "/")

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-hidden">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${active ? "bg-indigo-50 text-indigo-700" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        )
      })}
    </nav>
  )

  const account = (
    <div className="border-t border-zinc-200 pt-4">
      <div className={`mb-3 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-9 w-9 rounded-full border border-zinc-200 shrink-0" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600 shrink-0">
            {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900">
              {user.name ?? "Account"}
            </p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
        )}
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          title={collapsed ? "Sign out" : undefined}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </form>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 text-sm font-bold text-zinc-900"
        >
          <LayoutGrid className="h-4 w-4 text-indigo-600" />
          Docuzy
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop sidebar (collapsible, fixed/non-scrollable) */}
      <aside className={`hidden md:flex sticky top-0 h-screen shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-in-out overflow-hidden ${collapsed ? "w-16" : "w-60"}`}>
        <div className={`flex items-center gap-2 px-2 py-4 ${collapsed ? "justify-center" : "justify-between"}`}>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2 text-sm font-bold text-zinc-900 ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? "Docuzy" : undefined}
          >
            <LayoutGrid className="h-4 w-4 text-indigo-600 shrink-0" />
            {!collapsed && <span>Docuzy</span>}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <div className="mb-2 flex justify-center px-2">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex flex-1 flex-col overflow-hidden px-2">
          {nav}
        </div>
        <div className="px-2 pb-4">
          {account}
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-zinc-900/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white p-4 shadow-2xl md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 text-sm font-bold text-zinc-900"
                >
                  <LayoutGrid className="h-4 w-4 text-indigo-600" />
                  Docuzy
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              {account}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
