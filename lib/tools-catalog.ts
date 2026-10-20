import type { Metadata } from "next"
import {
  AlignLeft,
  Baseline,
  BookMarked,
  BookOpen,
  Code2,
  Combine,
  Crop,
  Earth,
  Eraser,
  FileArchive,
  FileCode,
  FileDigit,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType2,
  FlipHorizontal2,
  Grid2x2,
  Highlighter,
  ImageDown,
  Images,
  Layers,
  ListOrdered,
  Lock,
  Minimize2,
  MonitorSmartphone,
  PenLine,
  PenTool,
  Pipette,
  Presentation,
  RefreshCw,
  RotateCw,
  ScanLine,
  ScanText,
  Scaling,
  Scissors,
  Sheet,
  Signature,
  SlidersHorizontal,
  Stamp,
  Table2,
  Tags,
  Unlock,
  Wrench,
  type LucideIcon,
} from "lucide-react"

/**
 * Single source of truth for the tool catalog.
 *
 * Everything tool-related is derived from this file: the landing tools shelf,
 * navbar, footer, the public /tools directory, the dynamic /tools/[slug] route,
 * per-page metadata, the sitemap, breadcrumbs, and related-tool links. Add a
 * tool by adding one entry here plus a widget in components/tools/widgets/ and a
 * line in components/tools/registry.tsx — nothing else.
 *
 * A tool is `available` only when a real widget is registered for its `slug`
 * (routes are no longer hand-written folders; the /tools/[slug] route serves
 * every catalog entry).
 */
export type ToolStatus = "available" | "coming-soon"

/** Page shell width for a tool page (see TOOL_WIDTH_CLASS). */
export type ToolWidth = "narrow" | "medium" | "large" | "wide" | "full"

export interface CatalogSeo {
  /** SEO title without the brand — the root title template appends "— Docuzy". */
  title: string
  /** Meta description (also used for openGraph/twitter). */
  description: string
}

export interface CatalogTool {
  name: string
  description: string
  icon: LucideIcon
  status: ToolStatus
  /** Route slug for available tools. URL is /tools/<slug>. */
  slug?: string
  /** SEO title + meta description. Present for available tools. */
  seo?: CatalogSeo
  /** Width of the tool page shell. */
  width?: ToolWidth
  /** Slugs of closely related tools, rendered as internal links. */
  related?: string[]
}

export interface ToolGroup {
  label: string
  tools: CatalogTool[]
}

export interface ToolCategory {
  id: "pdf" | "image" | "other"
  label: string
  description: string
  icon: LucideIcon
  groups: ToolGroup[]
}

export const TOOL_BASE_PATH = "/tools"

/** Tailwind max-width class for each tool page width. */
export const TOOL_WIDTH_CLASS: Record<ToolWidth, string> = {
  narrow: "max-w-xl",
  medium: "max-w-2xl",
  large: "max-w-4xl",
  wide: "max-w-5xl",
  full: "max-w-6xl",
}

export const toolsCatalog: ToolCategory[] = [
  {
    id: "pdf",
    label: "PDF Tools",
    description: "Merge, organize, secure, and convert PDF documents.",
    icon: FileText,
    groups: [
      {
        label: "Organize & Edit",
        tools: [
          {
            name: "Merge PDF",
            description: "Combine several PDFs into one document.",
            icon: Layers,
            status: "available",
            slug: "merge-pdf",
            width: "medium",
            seo: { title: "Merge PDF Files Online", description: "Combine multiple PDF files into one document." },
            related: ["split-pdf", "compress-pdf"],
          },
          {
            name: "Split PDF",
            description: "Extract a page range or specific pages into a new PDF.",
            icon: Scissors,
            status: "available",
            slug: "split-pdf",
            width: "medium",
            seo: {
              title: "Split a PDF Online",
              description: "Extract a page range or specific pages from a PDF into a new file.",
            },
            related: ["merge-pdf", "compress-pdf"],
          },
          {
            name: "Compress PDF",
            description: "Reduce PDF file size while keeping it usable.",
            icon: Minimize2,
            status: "available",
            slug: "compress-pdf",
            width: "narrow",
            seo: {
              title: "Compress a PDF Online",
              description: "Compress PDF files with three quality levels — from sharp and balanced to the smallest possible file.",
            },
            related: ["merge-pdf", "add-page-numbers"],
          },
          {
            name: "Add Page Numbers",
            description: "Number PDF pages before sharing or submitting.",
            icon: ListOrdered,
            status: "available",
            slug: "add-page-numbers",
            width: "full",
            seo: {
              title: "Add Page Numbers to a PDF",
              description: "Number PDF pages before sharing or submitting.",
            },
            related: ["merge-pdf", "watermark-pdf"],
          },
          {
            name: "Watermark PDF",
            description: "Stamp text or an image across your pages.",
            icon: Stamp,
            status: "available",
            slug: "watermark-pdf",
            width: "full",
            seo: { title: "Add a Watermark to a PDF", description: "Stamp text or an image across your PDF pages." },
            related: ["add-page-numbers", "sign-pdf"],
          },
          {
            name: "Add Signature to PDF",
            description: "Draw or place a signature on a PDF.",
            icon: PenLine,
            status: "available",
            slug: "sign-pdf",
            width: "full",
            seo: { title: "Sign a PDF Online", description: "Draw or place a signature on a PDF in your browser." },
            related: ["watermark-pdf", "compress-pdf"],
          },
          {
            name: "Organize PDF Pages",
            description: "Reorder, rotate, or remove pages visually.",
            icon: Grid2x2,
            status: "available",
            slug: "organize-pdf",
            width: "full",
            seo: {
              title: "Organize PDF Pages Online",
              description: "Reorder, rotate, and delete PDF pages visually, then download the organized file.",
            },
            related: ["merge-pdf", "split-pdf", "compress-pdf"],
          },
          {
            name: "Rotate PDF",
            description: "Turn individual pages or the whole file.",
            icon: RotateCw,
            status: "available",
            slug: "rotate-pdf",
            width: "large",
            seo: {
              title: "Rotate PDF Pages Online",
              description: "Rotate every page of a PDF or just a page range, then download the turned document.",
            },
            related: ["organize-pdf", "merge-pdf", "split-pdf"],
          },
          { name: "Flip PDF", description: "Mirror pages horizontally or vertically.", icon: FlipHorizontal2, status: "coming-soon" },
          { name: "Crop / Resize PDF Pages", description: "Crop or resize several pages at once.", icon: Crop, status: "coming-soon" },
          { name: "Header and Footer", description: "Add repeated text to the top or bottom of pages.", icon: Baseline, status: "coming-soon" },
          { name: "Annotate PDF", description: "Highlight, comment, and draw shapes.", icon: Highlighter, status: "coming-soon" },
          { name: "Redact PDF", description: "Permanently hide sensitive information.", icon: Eraser, status: "coming-soon" },
          { name: "Edit PDF Online", description: "Add or change text directly inside a PDF.", icon: PenTool, status: "coming-soon" },
          { name: "Flatten PDF", description: "Merge form fields and layers into the page.", icon: Combine, status: "coming-soon" },
          { name: "Improve PDF Colours", description: "Boost contrast and colour for scanned files.", icon: Pipette, status: "coming-soon" },
          { name: "Repair Corrupted PDF", description: "Rebuild a damaged PDF so it opens again.", icon: Wrench, status: "coming-soon" },
          { name: "Encrypt PDF", description: "Require a password to open the file.", icon: Lock, status: "coming-soon" },
          { name: "Unlock PDF", description: "Remove a password from a PDF you own.", icon: Unlock, status: "coming-soon" },
          { name: "Remove & Edit Metadata", description: "Clear or change the title, author, and more.", icon: Tags, status: "coming-soon" },
          { name: "PDF to ZIP", description: "Package one or more PDFs into a ZIP file.", icon: FileArchive, status: "coming-soon" },
          { name: "Extract Images from PDF", description: "Pull embedded images out of a PDF.", icon: ImageDown, status: "coming-soon" },
          { name: "Extract Text", description: "Copy the words out of a PDF as plain text.", icon: AlignLeft, status: "coming-soon" },
        ],
      },
      {
        label: "Convert & OCR",
        tools: [
          {
            name: "Image to PDF",
            description: "Turn photos and scans into a PDF.",
            icon: FileImage,
            status: "available",
            slug: "image-to-pdf",
            width: "wide",
            seo: { title: "Convert Images to PDF", description: "Combine or convert supported images into a PDF." },
            related: ["pdf-to-image", "merge-pdf"],
          },
          {
            name: "Convert PDF to Image",
            description: "Export PDF pages as JPG or PNG images.",
            icon: Images,
            status: "available",
            slug: "pdf-to-image",
            width: "large",
            seo: { title: "Convert PDF Pages to Images", description: "Export pages from a PDF as JPG image files." },
            related: ["image-to-pdf", "compress-image"],
          },
          { name: "Word to PDF", description: "Convert a Word document into a PDF.", icon: FileText, status: "coming-soon" },
          { name: "PDF to Word", description: "Convert a PDF into an editable Word file.", icon: FileType2, status: "coming-soon" },
          { name: "Excel to PDF", description: "Convert a spreadsheet into a PDF.", icon: FileSpreadsheet, status: "coming-soon" },
          { name: "PDF to Excel", description: "Turn PDF tables into an editable spreadsheet.", icon: Table2, status: "coming-soon" },
          { name: "PPT to PDF", description: "Convert slides into a PDF.", icon: Presentation, status: "coming-soon" },
          { name: "PDF to PowerPoint", description: "Turn PDF pages into editable slides.", icon: MonitorSmartphone, status: "coming-soon" },
          { name: "HTML to PDF", description: "Convert an HTML file into a PDF.", icon: Code2, status: "coming-soon" },
          { name: "PDF to HTML", description: "Convert a PDF into an HTML page.", icon: FileCode, status: "coming-soon" },
          { name: "Markdown to PDF", description: "Convert Markdown into a formatted PDF.", icon: BookOpen, status: "coming-soon" },
          { name: "PDF to Markdown", description: "Convert a PDF into editable Markdown.", icon: BookMarked, status: "coming-soon" },
          { name: "CSV to PDF", description: "Convert a CSV file into a readable PDF.", icon: Sheet, status: "coming-soon" },
          { name: "PDF to CSV", description: "Extract PDF data into a CSV file.", icon: FileSpreadsheet, status: "coming-soon" },
          { name: "E-book to PDF", description: "Convert an EPUB e-book into a PDF.", icon: BookOpen, status: "coming-soon" },
          { name: "PDF to E-book", description: "Convert a PDF into an EPUB e-book.", icon: BookMarked, status: "coming-soon" },
          { name: "Webpage to PDF", description: "Save a live web page as a PDF.", icon: Earth, status: "coming-soon" },
          { name: "Scan Document", description: "Capture pages with your camera into a PDF.", icon: ScanLine, status: "coming-soon" },
          { name: "OCR PDF", description: "Make a scanned PDF searchable and selectable.", icon: ScanText, status: "coming-soon" },
          { name: "Handwriting to PDF", description: "Turn handwritten notes into a clean PDF.", icon: Signature, status: "coming-soon" },
          { name: "Image to Text", description: "Read text out of an image with OCR.", icon: FileDigit, status: "coming-soon" },
        ],
      },
    ],
  },
  {
    id: "image",
    label: "Image Tools",
    description: "Edit, optimize, and convert images for documents.",
    icon: Images,
    groups: [
      {
        label: "Edit & Optimize",
        tools: [
          {
            name: "Compress Image",
            description: "Reduce image file size.",
            icon: Minimize2,
            status: "available",
            slug: "compress-image",
            width: "narrow",
            seo: { title: "Compress an Image Online", description: "Reduce an image's file size while keeping it clear." },
            related: ["resize-image", "crop-image"],
          },
          {
            name: "Resize Image",
            description: "Change image dimensions to a chosen size.",
            icon: Scaling,
            status: "available",
            slug: "resize-image",
            width: "medium",
            seo: { title: "Resize an Image Online", description: "Change image dimensions to a chosen size." },
            related: ["compress-image", "crop-image"],
          },
          {
            name: "Crop Image",
            description: "Crop an image to the frame you need.",
            icon: Crop,
            status: "available",
            slug: "crop-image",
            width: "large",
            seo: { title: "Crop an Image Online", description: "Crop an image to the required frame or dimensions." },
            related: ["resize-image", "compress-image"],
          },
          {
            name: "Watermark an Image",
            description: "Add a text or image watermark.",
            icon: Stamp,
            status: "available",
            slug: "watermark-image",
            width: "wide",
            seo: { title: "Add a Watermark to an Image", description: "Add a text or image watermark to a photo." },
            related: ["compress-image", "resize-image"],
          },
          { name: "Rotate Image", description: "Turn an image to the right orientation.", icon: RotateCw, status: "coming-soon" },
          { name: "Flip Image", description: "Mirror an image horizontally or vertically.", icon: FlipHorizontal2, status: "coming-soon" },
          { name: "Edit an Image", description: "Adjust brightness, contrast, and more.", icon: SlidersHorizontal, status: "coming-soon" },
          { name: "Remove Image Metadata", description: "Strip EXIF and location data from a photo.", icon: Tags, status: "coming-soon" },
          { name: "Image to Excel", description: "Read a table image into a spreadsheet with OCR.", icon: Table2, status: "coming-soon" },
        ],
      },
      {
        label: "Convert",
        tools: [
          {
            name: "Convert to JPG",
            description: "Convert an image to JPG.",
            icon: FileImage,
            status: "available",
            slug: "image-to-jpg",
            width: "narrow",
            seo: { title: "Convert an Image to JPG", description: "Convert supported image formats to JPG." },
            related: ["jpg-to-png", "image-to-webp"],
          },
          {
            name: "Convert to PNG",
            description: "Convert an image to PNG.",
            icon: FileImage,
            status: "available",
            slug: "jpg-to-png",
            width: "narrow",
            seo: { title: "Convert an Image to PNG", description: "Convert JPG images to lossless PNG files." },
            related: ["image-to-jpg", "image-to-webp"],
          },
          {
            name: "Convert to WebP",
            description: "Convert an image to WebP.",
            icon: FileImage,
            status: "available",
            slug: "image-to-webp",
            width: "narrow",
            seo: { title: "Convert an Image to WebP", description: "Convert images to the modern WebP format." },
            related: ["image-to-jpg", "jpg-to-png"],
          },
          { name: "Image Converter", description: "Convert between any supported image format.", icon: RefreshCw, status: "coming-soon" },
          { name: "HEIC to JPG", description: "Convert iPhone HEIC photos to JPG.", icon: FileImage, status: "coming-soon" },
          { name: "AVIF to JPG / PNG", description: "Convert AVIF images to a common format.", icon: FileImage, status: "coming-soon" },
          { name: "JPG / PNG to AVIF", description: "Convert images to the AVIF format.", icon: FileImage, status: "coming-soon" },
        ],
      },
    ],
  },
  {
    id: "other",
    label: "Other Tools",
    description: "Everyday utilities that round out document work.",
    icon: Wrench,
    groups: [
      {
        label: "Utilities",
        tools: [
          {
            name: "JSON to CSV",
            description: "Turn JSON data into a CSV file.",
            icon: FileJson,
            status: "available",
            slug: "json-to-csv",
            width: "narrow",
            seo: { title: "Convert JSON to CSV", description: "Turn a JSON file into a CSV spreadsheet." },
            related: ["html-to-image", "compress-image"],
          },
          {
            name: "HTML to Image",
            description: "Render an HTML snippet into an image.",
            icon: FileCode,
            status: "available",
            slug: "html-to-image",
            width: "large",
            seo: { title: "Convert HTML to an Image", description: "Render an HTML snippet into a PNG or JPG image." },
            related: ["pdf-to-image", "image-to-jpg"],
          },
          { name: "CSV to Excel", description: "Convert a CSV file into an Excel workbook.", icon: FileSpreadsheet, status: "coming-soon" },
          { name: "Excel to CSV", description: "Convert an Excel workbook into CSV.", icon: Table2, status: "coming-soon" },
        ],
      },
    ],
  },
]

/** Every tool in the catalog, flattened (available + coming-soon). */
export function allTools(): CatalogTool[] {
  return toolsCatalog.flatMap((category) => category.groups.flatMap((group) => group.tools))
}

/** Flat list of tools in a category, including coming-soon entries. */
export function toolsInCategory(id: ToolCategory["id"]): CatalogTool[] {
  const category = toolsCatalog.find((c) => c.id === id)
  return category ? category.groups.flatMap((group) => group.tools) : []
}

/** Flat list of only the tools that are built today (with a real widget). */
export function availableToolsInCategory(id: ToolCategory["id"]): (CatalogTool & { href: string })[] {
  return toolsInCategory(id)
    .filter((tool): tool is CatalogTool & { slug: string } => tool.status === "available" && !!tool.slug)
    .map((tool) => ({ ...tool, href: toolHref(tool) }))
}

export const availableToolCount = allTools().filter((tool) => tool.status === "available").length

/** Resolve a tool to its public route. */
export function toolHref(tool: CatalogTool): string {
  return `${TOOL_BASE_PATH}/${tool.slug}`
}

/** Look up an available tool by slug (used by /tools/[slug]). */
export function findTool(slug: string): CatalogTool | undefined {
  return allTools().find((tool) => tool.status === "available" && tool.slug === slug)
}

/** Slugs of every available tool, for static params + the sitemap. */
export function availableSlugs(): string[] {
  return allTools()
    .filter((tool): tool is CatalogTool & { slug: string } => tool.status === "available" && !!tool.slug)
    .map((tool) => tool.slug)
}

/** Resolve related-tool slugs to catalog entries. */
export function relatedTools(tool: CatalogTool): CatalogTool[] {
  return (tool.related ?? [])
    .map((slug) => findTool(slug))
    .filter((t): t is CatalogTool => Boolean(t))
}

/**
 * Build per-page metadata for a tool from its catalog entry. Canonical URLs and
 * openGraph are derived so every tool page is unique without hand-written meta.
 */
export function toolMetadata(tool: CatalogTool): Metadata {
  if (!tool.slug || !tool.seo) return {}
  const url = toolHref(tool)
  const ogTitle = `${tool.seo.title} — Docuzy`
  return {
    title: tool.seo.title,
    description: tool.seo.description,
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description: tool.seo.description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: tool.seo.description,
    },
  }
}
