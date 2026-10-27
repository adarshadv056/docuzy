import Link from "next/link"
import { availableToolsInCategory, findTool, toolHref } from "@/lib/tools-catalog"

// CONTENT.md §4.9. Only link to routes/pages that actually exist — no empty
// placeholder links, no invented social profiles, no pricing until finalized.
// Section anchors are absolute so they resolve from /tools too.
const productLinks = [
  { name: "AI Document Chat", href: "/#ai" },
  { name: "PDF & Image Tools", href: "/tools" },
  { name: "Document Workspace", href: "/#organization" },
  { name: "How It Works", href: "/#how-it-works" },
]

// Curated top tools shown in the footer so it stays compact. The full catalog
// (55 tools) lives on /tools; these resolve through findTool so a tool that
// later becomes "coming-soon" silently drops out instead of a dead link.
const footerPdfToolSlugs = [
  "merge-pdf",
  "compress-pdf",
  "pdf-to-word",
  "image-to-pdf",
  "sign-pdf",
  "encrypt-pdf",
]

const footerImageToolSlugs = [
  "compress-image",
  "resize-image",
  "crop-image",
  "rotate-image",
  "flip-image",
  "remove-image-metadata",
]

const footerPdfTools = footerPdfToolSlugs
  .map((slug) => findTool(slug))
  .filter((t): t is NonNullable<typeof t> => Boolean(t))
  .map((t) => ({ name: t.name, href: toolHref(t) }))

const footerImageTools = footerImageToolSlugs
  .map((slug) => findTool(slug))
  .filter((t): t is NonNullable<typeof t> => Boolean(t))
  .map((t) => ({ name: t.name, href: toolHref(t) }))

const pdfToolCount = availableToolsInCategory("pdf").length
const imageToolCount = availableToolsInCategory("image").length

export default function Footer() {
  return (
    <footer className="bg-white border-t border-zinc-200 pt-16 pb-10 px-6">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 mb-14 text-sm">
        <div className="col-span-2 md:col-span-1">
          <div className="font-bold text-lg text-zinc-900 mb-4">Docuzy</div>
          <p className="max-w-xs leading-relaxed text-zinc-500">
            The AI-powered document workspace for students.
          </p>
        </div>

        <div>
          <div className="font-semibold text-zinc-900 mb-4">Product</div>
          <ul className="space-y-3 text-zinc-500">
            {productLinks.map((link) => (
              <li key={link.name}>
                <Link href={link.href} className="transition-colors hover:text-zinc-900">
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="font-semibold text-zinc-900 mb-4">PDF tools</div>
          <ul className="space-y-3 text-zinc-500">
            {footerPdfTools.map((link) => (
              <li key={link.name}>
                <Link href={link.href} className="transition-colors hover:text-zinc-900">
                  {link.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/tools#pdf"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
              >
                All {pdfToolCount} PDF tools →
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="font-semibold text-zinc-900 mb-4">Image tools</div>
          <ul className="space-y-3 text-zinc-500">
            {footerImageTools.map((link) => (
              <li key={link.name}>
                <Link href={link.href} className="transition-colors hover:text-zinc-900">
                  {link.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/tools#image"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
              >
                All {imageToolCount} image tools →
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto pt-8 border-t border-zinc-200 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
        <div>&copy; {new Date().getFullYear()} Docuzy. All rights reserved.</div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="transition-colors hover:text-zinc-900">
            Sign In
          </Link>
          <Link href="/login" className="transition-colors hover:text-zinc-900">
            Get Started Free
          </Link>
        </div>
      </div>
    </footer>
  )
}
