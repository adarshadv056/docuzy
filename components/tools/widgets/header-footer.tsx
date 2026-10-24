'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage } from 'pdf-lib'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Baseline,
  Check,
  Download,
  FileText,
  Loader2,
  Minus,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type FontFamily = 'helvetica' | 'times' | 'courier'
type Scope = 'all' | 'range'
type FocusedSlot = 'hl' | 'hc' | 'hr' | 'fl' | 'fc' | 'fr' | null

interface FontConfig {
  label: string
  regular: StandardFonts
  bold: StandardFonts
  css: string
}

const FONT_FAMILIES: Record<FontFamily, FontConfig> = {
  helvetica: {
    label: 'Helvetica (Clean)',
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    css: 'Helvetica, Arial, sans-serif',
  },
  times: {
    label: 'Times (Formal)',
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    css: '"Times New Roman", Times, serif',
  },
  courier: {
    label: 'Courier (Mono)',
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    css: '"Courier New", Courier, monospace',
  },
}

const COLOR_PRESETS = [
  { label: 'Black', value: '#18181b' },
  { label: 'Slate', value: '#475569' },
  { label: 'Muted Gray', value: '#71717a' },
  { label: 'Docuzy Indigo', value: '#4f46e5' },
]

const MIN_FONT_SIZE = 6
const MAX_FONT_SIZE = 28
const MIN_MARGIN = 12
const MAX_MARGIN = 72

const PREVIEW_WIDTH = 580
const PREVIEW_MAX_HEIGHT = 800

/** Glyph metrics for baseline alignment */
const ASCENT_RATIO = 0.72
const DESCENT_RATIO = 0.22

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const int = parseInt(full || '000000', 16)
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255)
}

/** Resolves dynamic placeholders */
function resolveTokens(template: string, pageNum: number, total: number, title: string): string {
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return template
    .replace(/\{page\}|\{n\}/gi, String(pageNum))
    .replace(/\{total\}/gi, String(total))
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{title\}/gi, title)
}

/* ------------------------------------------------------------------ */
/* Page Geometry & Rotation Helpers                                   */
/* ------------------------------------------------------------------ */

interface UserRect {
  x: number
  y: number
  width: number
  height: number
}

function visibleBox(page: PDFPage): UserRect {
  const media = page.getMediaBox()
  const crop = page.getCropBox()
  const x0 = Math.max(media.x, crop.x)
  const y0 = Math.max(media.y, crop.y)
  const x1 = Math.min(media.x + media.width, crop.x + crop.width)
  const y1 = Math.min(media.y + media.height, crop.y + crop.height)
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) }
}

const rotationOf = (page: PDFPage) => ((page.getRotation().angle % 360) + 360) % 360

function displaySize(box: UserRect, rotation: number) {
  return rotation === 90 || rotation === 270
    ? { width: box.height, height: box.width }
    : { width: box.width, height: box.height }
}

function displayToUser(box: UserRect, rotation: number, xd: number, yd: number): [number, number] {
  switch (rotation) {
    case 90:
      return [box.x + box.width - yd, box.y + xd]
    case 180:
      return [box.x + box.width - xd, box.y + box.height - yd]
    case 270:
      return [box.x + yd, box.y + box.height - xd]
    default:
      return [box.x + xd, box.y + yd]
  }
}

interface PreviewMetrics {
  width: number
  height: number
  scale: number
}

export default function HeaderFooterPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [previewPage, setPreviewPage] = useState(1)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [baseVersion, setBaseVersion] = useState(0)

  // 6-zone text slots
  const [headerLeft, setHeaderLeft] = useState('')
  const [headerCenter, setHeaderCenter] = useState('')
  const [headerRight, setHeaderRight] = useState('')

  const [footerLeft, setFooterLeft] = useState('')
  const [footerCenter, setFooterCenter] = useState('{page} / {total}')
  const [footerRight, setFooterRight] = useState('')

  // Dividers
  const [headerDivider, setHeaderDivider] = useState(false)
  const [footerDivider, setFooterDivider] = useState(false)

  // Styling
  const [fontFamily, setFontFamily] = useState<FontFamily>('helvetica')
  const [bold, setBold] = useState(false)
  const [fontSize, setFontSize] = useState(10)
  const [margin, setMargin] = useState(36)
  const [color, setColor] = useState(COLOR_PRESETS[1].value)

  // Scope & Cover page
  const [scope, setScope] = useState<Scope>('all')
  const [fromPage, setFromPage] = useState(1)
  const [toPage, setToPage] = useState(1)
  const [skipFirstPage, setSkipFirstPage] = useState(false)

  // Track focused slot for token quick-insert
  const [lastFocusedSlot, setLastFocusedSlot] = useState<FocusedSlot>('fc')

  // Status
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{
    bytes: Uint8Array
    originalSize: number
    newSize: number
    pagesUpdated: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const metricsRef = useRef<PreviewMetrics | null>(null)

  const pageCount = pdfDoc?.numPages ?? 0
  const docTitle = file ? file.name.replace(/\.[^/.]+$/, '') : ''

  const hasAnyText = Boolean(
    headerLeft.trim() ||
      headerCenter.trim() ||
      headerRight.trim() ||
      footerLeft.trim() ||
      footerCenter.trim() ||
      footerRight.trim() ||
      headerDivider ||
      footerDivider
  )

  // Range calculation
  const affectedFrom = scope === 'all' ? 1 : Math.min(fromPage, toPage)
  const affectedTo = scope === 'all' ? pageCount : Math.max(fromPage, toPage)

  // Compute number of pages affected taking skipFirstPage into account
  let affectedCount = 0
  if (pageCount > 0) {
    for (let p = Math.max(1, affectedFrom); p <= Math.min(affectedTo, pageCount); p++) {
      if (skipFirstPage && p === 1) continue
      affectedCount++
    }
  }
  const hasValidRange = affectedCount > 0

  const isPageSkipped = (pageNumber: number) => {
    if (pageNumber < affectedFrom || pageNumber > affectedTo) return true
    if (skipFirstPage && pageNumber === 1) return true
    return false
  }

  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')
    setPreviewUrl(null)
    setPdfDoc(null)
    setSourceBuffer(null)
    setFile(null)
    setBaseVersion(0)
    baseCanvasRef.current = null
    metricsRef.current = null

    try {
      const buffer = await selectedFile.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise
      setSourceBuffer(buffer)
      setPdfDoc(doc)
      setPreviewPage(1)
      setFromPage(1)
      setToPage(doc.numPages)
      setFile(selectedFile)
    } catch (err) {
      console.error(err)
      setError('This PDF could not be opened. It may be password protected or damaged.')
    }
  }, [])

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      loadFile(selectedFile)
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped && dropped.type === 'application/pdf') {
      loadFile(dropped)
    }
  }

  const startOver = () => {
    pdfDoc?.destroy()
    setFile(null)
    setSourceBuffer(null)
    setPdfDoc(null)
    setPreviewUrl(null)
    setBaseVersion(0)
    setResult(null)
    setPhase('idle')
    setError(null)
    setScope('all')
    setSkipFirstPage(false)
    baseCanvasRef.current = null
    metricsRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Token inserter helper
  const insertToken = (token: string) => {
    const target = lastFocusedSlot || 'fc'
    switch (target) {
      case 'hl':
        setHeaderLeft((prev) => (prev ? `${prev} ${token}` : token))
        break
      case 'hc':
        setHeaderCenter((prev) => (prev ? `${prev} ${token}` : token))
        break
      case 'hr':
        setHeaderRight((prev) => (prev ? `${prev} ${token}` : token))
        break
      case 'fl':
        setFooterLeft((prev) => (prev ? `${prev} ${token}` : token))
        break
      case 'fc':
        setFooterCenter((prev) => (prev ? `${prev} ${token}` : token))
        break
      case 'fr':
        setFooterRight((prev) => (prev ? `${prev} ${token}` : token))
        break
    }
  }

  // Render base PDF page to canvas once per preview page
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false

    const render = async () => {
      baseCanvasRef.current = null
      metricsRef.current = null
      setPreviewUrl(null)

      try {
        const page = await pdfDoc.getPage(previewPage)
        if (cancelled) return

        const unscaled = page.getViewport({ scale: 1 })
        const scale = Math.min(
          PREVIEW_WIDTH / Math.max(1, unscaled.width),
          PREVIEW_MAX_HEIGHT / Math.max(1, unscaled.height)
        )
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const context = canvas.getContext('2d')
        if (!context) return

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: context, viewport, canvas }).promise
        if (cancelled) return

        baseCanvasRef.current = canvas
        metricsRef.current = { width: unscaled.width, height: unscaled.height, scale }
        setBaseVersion((v) => v + 1)
      } catch (err) {
        console.warn('Preview rendering failed', err)
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, previewPage])

  // Composite headers, footers, and divider lines onto cached canvas
  useEffect(() => {
    const base = baseCanvasRef.current
    const metrics = metricsRef.current
    if (!base || !metrics) return

    const canvas = document.createElement('canvas')
    canvas.width = base.width
    canvas.height = base.height
    const context = canvas.getContext('2d')
    if (!context) return

    // Draw base PDF page
    context.drawImage(base, 0, 0)

    // Check if this page is skipped
    const isSkipped = isPageSkipped(previewPage)

    if (isSkipped) {
      // Dim or leave untouched to indicate it's skipped
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.92))
      return
    }

    const family = FONT_FAMILIES[fontFamily]
    const scaledFontSize = fontSize * metrics.scale
    context.font = `${bold ? '700' : '400'} ${scaledFontSize}px ${family.css}`
    context.fillStyle = color
    context.textBaseline = 'alphabetic'

    const scaledMargin = margin * metrics.scale
    const headerBaseline = canvas.height - (metrics.height - margin - fontSize * ASCENT_RATIO) * metrics.scale
    const footerBaseline = canvas.height - (margin + fontSize * DESCENT_RATIO) * metrics.scale

    // Draw Headers
    const hl = resolveTokens(headerLeft, previewPage, pageCount, docTitle).trim()
    const hc = resolveTokens(headerCenter, previewPage, pageCount, docTitle).trim()
    const hr = resolveTokens(headerRight, previewPage, pageCount, docTitle).trim()

    if (hl) {
      context.textAlign = 'left'
      context.fillText(hl, scaledMargin, headerBaseline)
    }
    if (hc) {
      context.textAlign = 'center'
      context.fillText(hc, canvas.width / 2, headerBaseline)
    }
    if (hr) {
      context.textAlign = 'right'
      context.fillText(hr, canvas.width - scaledMargin, headerBaseline)
    }

    // Draw Header Divider Line
    if (headerDivider) {
      const lineY = headerBaseline + 6 * metrics.scale
      context.save()
      context.strokeStyle = color
      context.lineWidth = Math.max(1, 0.75 * metrics.scale)
      context.globalAlpha = 0.35
      context.beginPath()
      context.moveTo(scaledMargin, lineY)
      context.lineTo(canvas.width - scaledMargin, lineY)
      context.stroke()
      context.restore()
    }

    // Draw Footers
    const fl = resolveTokens(footerLeft, previewPage, pageCount, docTitle).trim()
    const fc = resolveTokens(footerCenter, previewPage, pageCount, docTitle).trim()
    const fr = resolveTokens(footerRight, previewPage, pageCount, docTitle).trim()

    if (fl) {
      context.textAlign = 'left'
      context.fillText(fl, scaledMargin, footerBaseline)
    }
    if (fc) {
      context.textAlign = 'center'
      context.fillText(fc, canvas.width / 2, footerBaseline)
    }
    if (fr) {
      context.textAlign = 'right'
      context.fillText(fr, canvas.width - scaledMargin, footerBaseline)
    }

    // Draw Footer Divider Line
    if (footerDivider) {
      const lineY = footerBaseline - (fontSize * ASCENT_RATIO + 4) * metrics.scale
      context.save()
      context.strokeStyle = color
      context.lineWidth = Math.max(1, 0.75 * metrics.scale)
      context.globalAlpha = 0.35
      context.beginPath()
      context.moveTo(scaledMargin, lineY)
      context.lineTo(canvas.width - scaledMargin, lineY)
      context.stroke()
      context.restore()
    }

    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.92))
  }, [
    baseVersion,
    headerLeft,
    headerCenter,
    headerRight,
    footerLeft,
    footerCenter,
    footerRight,
    headerDivider,
    footerDivider,
    fontFamily,
    bold,
    fontSize,
    margin,
    color,
    previewPage,
    pageCount,
    docTitle,
    scope,
    fromPage,
    toPage,
    skipFirstPage,
  ])

  // PDF Export execution with pdf-lib
  const applyHeaderFooter = async () => {
    if (!file || !sourceBuffer || !hasAnyText || !hasValidRange) return
    setPhase('working')
    setError(null)

    try {
      const pdf = await PDFDocument.load(sourceBuffer.slice(0), {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      })
      const pages = pdf.getPages()
      const totalPages = pages.length
      const font = await pdf.embedFont(FONT_FAMILIES[fontFamily][bold ? 'bold' : 'regular'])
      const textColor = hexToRgb(color)

      let pagesUpdated = 0

      pages.forEach((page, index) => {
        const pageNumber = index + 1
        if (isPageSkipped(pageNumber)) return

        const box = visibleBox(page)
        const rotation = rotationOf(page)
        const size = displaySize(box, rotation)

        let appliedOnPage = false

        // Resolved strings
        const hl = resolveTokens(headerLeft, pageNumber, totalPages, docTitle).trim()
        const hc = resolveTokens(headerCenter, pageNumber, totalPages, docTitle).trim()
        const hr = resolveTokens(headerRight, pageNumber, totalPages, docTitle).trim()
        const fl = resolveTokens(footerLeft, pageNumber, totalPages, docTitle).trim()
        const fc = resolveTokens(footerCenter, pageNumber, totalPages, docTitle).trim()
        const fr = resolveTokens(footerRight, pageNumber, totalPages, docTitle).trim()

        const headerYd = size.height - margin - fontSize * ASCENT_RATIO
        const footerYd = margin + fontSize * DESCENT_RATIO

        // Draw Headers
        if (hl) {
          const [x, y] = displayToUser(box, rotation, margin, headerYd)
          page.drawText(hl, { x, y, size: fontSize, font, color: textColor, rotate: degrees(rotation) })
          appliedOnPage = true
        }
        if (hc) {
          const w = font.widthOfTextAtSize(hc, fontSize)
          const [x, y] = displayToUser(box, rotation, (size.width - w) / 2, headerYd)
          page.drawText(hc, { x, y, size: fontSize, font, color: textColor, rotate: degrees(rotation) })
          appliedOnPage = true
        }
        if (hr) {
          const w = font.widthOfTextAtSize(hr, fontSize)
          const [x, y] = displayToUser(box, rotation, size.width - margin - w, headerYd)
          page.drawText(hr, { x, y, size: fontSize, font, color: textColor, rotate: degrees(rotation) })
          appliedOnPage = true
        }

        // Draw Header Divider
        if (headerDivider) {
          const lineYd = headerYd - 6
          const [x1, y1] = displayToUser(box, rotation, margin, lineYd)
          const [x2, y2] = displayToUser(box, rotation, size.width - margin, lineYd)
          page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            thickness: 0.5,
            color: textColor,
            opacity: 0.35,
          })
          appliedOnPage = true
        }

        // Draw Footers
        if (fl) {
          const [x, y] = displayToUser(box, rotation, margin, footerYd)
          page.drawText(fl, { x, y, size: fontSize, font, color: textColor, rotate: degrees(rotation) })
          appliedOnPage = true
        }
        if (fc) {
          const w = font.widthOfTextAtSize(fc, fontSize)
          const [x, y] = displayToUser(box, rotation, (size.width - w) / 2, footerYd)
          page.drawText(fc, { x, y, size: fontSize, font, color: textColor, rotate: degrees(rotation) })
          appliedOnPage = true
        }
        if (fr) {
          const w = font.widthOfTextAtSize(fr, fontSize)
          const [x, y] = displayToUser(box, rotation, size.width - margin - w, footerYd)
          page.drawText(fr, { x, y, size: fontSize, font, color: textColor, rotate: degrees(rotation) })
          appliedOnPage = true
        }

        // Draw Footer Divider
        if (footerDivider) {
          const lineYd = footerYd + fontSize * ASCENT_RATIO + 4
          const [x1, y1] = displayToUser(box, rotation, margin, lineYd)
          const [x2, y2] = displayToUser(box, rotation, size.width - margin, lineYd)
          page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            thickness: 0.5,
            color: textColor,
            opacity: 0.35,
          })
          appliedOnPage = true
        }

        if (appliedOnPage) pagesUpdated++
      })

      const bytes = await pdf.save()
      setResult({
        bytes,
        originalSize: file.size,
        newSize: bytes.byteLength,
        pagesUpdated,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError(
        'Could not add header and footer. Standard PDF fonts only support ASCII text; please avoid emojis or non-standard symbols.'
      )
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `header-footer-${file.name}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Done phase
  if (phase === 'done' && result) {
    return (
      <div className="bg-white border border-zinc-100 rounded-3xl p-8 shadow-sm max-w-xl mx-auto">
        <div className="mb-6 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100/60">
            <Check size={28} className="text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Your PDF is ready!</h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            Header and footer successfully added to {result.pagesUpdated} page{result.pagesUpdated === 1 ? '' : 's'}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Original Size</p>
            <p className="text-base font-semibold text-zinc-600 tabular-nums">{formatSize(result.originalSize)}</p>
          </div>
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">New Size</p>
            <p className="text-base font-bold text-zinc-900 tabular-nums">{formatSize(result.newSize)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={downloadResult}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download PDF
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('idle')}
              className="flex-1 py-3 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl transition-colors"
            >
              Adjust Settings
            </button>
            <button
              onClick={startOver}
              className="flex-1 py-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={14} />
              Start Over
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Initial file upload state
  if (!file) {
    return (
      <div>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDraggingFile(true)
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-3xl p-16 text-center transition-all cursor-pointer group ${
            isDraggingFile ? 'border-indigo-500 bg-indigo-50/40' : 'border-zinc-200 hover:border-zinc-400 bg-white'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelection}
            accept="application/pdf"
            className="hidden"
          />
          <div className="space-y-4 max-w-sm mx-auto">
            <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto text-zinc-500 group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">Select a PDF to add header &amp; footer</p>
              <p className="text-xs text-zinc-400 mt-1">Drag and drop file here, or click to browse</p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 rounded-full text-[11px] font-medium text-zinc-500">
              <Sparkles size={12} className="text-indigo-600" />
              100% private &amp; processed locally in your browser
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  const previewSkipped = isPageSkipped(previewPage)

  return (
    <div className="space-y-6">
      {/* File summary banner */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate">{file.name}</p>
            <p className="text-xs text-zinc-400">
              {pageCount} page{pageCount === 1 ? '' : 's'} · {formatSize(file.size)}
            </p>
          </div>
        </div>
        <button
          onClick={startOver}
          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Choose different PDF"
          aria-label="Remove file"
        >
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-7 bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-7">
          {/* Quick Token Pills */}
          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Dynamic Placeholders
              </span>
              <span className="text-[10px] text-zinc-400">Click to insert into focused field</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Page #', token: '{page}' },
                { label: 'Page of Total', token: 'Page {page} of {total}' },
                { label: 'Total Pages', token: '{total}' },
                { label: "Today's Date", token: '{date}' },
                { label: 'Document Title', token: '{title}' },
              ].map(({ label, token }) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertToken(token)}
                  className="px-2.5 py-1 bg-white border border-zinc-200 hover:border-zinc-400 rounded-lg text-xs font-medium text-zinc-700 transition-colors shadow-2xs hover:text-zinc-900 active:scale-95"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>

          {/* Header 3-Zone Inputs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Baseline size={16} className="text-zinc-500" />
                <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-900">Header Text</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-600 select-none">
                <input
                  type="checkbox"
                  checked={headerDivider}
                  onChange={(e) => setHeaderDivider(e.target.checked)}
                  className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900"
                />
                Divider line below
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Left Header</label>
                <input
                  type="text"
                  value={headerLeft}
                  onFocus={() => setLastFocusedSlot('hl')}
                  onChange={(e) => setHeaderLeft(e.target.value)}
                  placeholder="e.g. Confidential"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition-all placeholder:text-zinc-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Center Header</label>
                <input
                  type="text"
                  value={headerCenter}
                  onFocus={() => setLastFocusedSlot('hc')}
                  onChange={(e) => setHeaderCenter(e.target.value)}
                  placeholder="e.g. {title}"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium text-center focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition-all placeholder:text-zinc-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Right Header</label>
                <input
                  type="text"
                  value={headerRight}
                  onFocus={() => setLastFocusedSlot('hr')}
                  onChange={(e) => setHeaderRight(e.target.value)}
                  placeholder="e.g. {date}"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium text-right focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition-all placeholder:text-zinc-400"
                />
              </div>
            </div>
          </div>

          {/* Footer 3-Zone Inputs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Minus size={16} className="text-zinc-500" />
                <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-900">Footer Text</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-600 select-none">
                <input
                  type="checkbox"
                  checked={footerDivider}
                  onChange={(e) => setFooterDivider(e.target.checked)}
                  className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900"
                />
                Divider line above
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Left Footer</label>
                <input
                  type="text"
                  value={footerLeft}
                  onFocus={() => setLastFocusedSlot('fl')}
                  onChange={(e) => setFooterLeft(e.target.value)}
                  placeholder="e.g. Docuzy Workspace"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition-all placeholder:text-zinc-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Center Footer</label>
                <input
                  type="text"
                  value={footerCenter}
                  onFocus={() => setLastFocusedSlot('fc')}
                  onChange={(e) => setFooterCenter(e.target.value)}
                  placeholder="e.g. Page {page} of {total}"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium text-center focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition-all placeholder:text-zinc-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Right Footer</label>
                <input
                  type="text"
                  value={footerRight}
                  onFocus={() => setLastFocusedSlot('fr')}
                  onChange={(e) => setFooterRight(e.target.value)}
                  placeholder="e.g. {date}"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium text-right focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none transition-all placeholder:text-zinc-400"
                />
              </div>
            </div>
          </div>

          {/* Typography & Appearance */}
          <div className="space-y-5 pt-3 border-t border-zinc-100">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Typography &amp; Style</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label htmlFor="hf-font" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                  Font Family
                </label>
                <select
                  id="hf-font"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as FontFamily)}
                  className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl font-medium text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  {(Object.keys(FONT_FAMILIES) as FontFamily[]).map((key) => (
                    <option key={key} value={key}>
                      {FONT_FAMILIES[key].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Weight</span>
                <button
                  type="button"
                  onClick={() => setBold((v) => !v)}
                  aria-pressed={bold}
                  className={`w-full p-3 rounded-xl border text-xs font-bold transition-all ${
                    bold
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                      : 'border-zinc-100 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  Bold Weight
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <RangeControl
                label="Font size"
                value={fontSize}
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                step={1}
                onChange={setFontSize}
                suffix=" pt"
              />
              <RangeControl
                label="Page margin"
                value={margin}
                min={MIN_MARGIN}
                max={MAX_MARGIN}
                step={1}
                onChange={setMargin}
                suffix=" pt"
              />
            </div>

            {/* Colors */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Text &amp; Line Color</span>
              <div className="flex items-center gap-2.5">
                {COLOR_PRESETS.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    onClick={() => setColor(swatch.value)}
                    aria-label={swatch.label}
                    title={swatch.label}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                      color.toLowerCase() === swatch.value.toLowerCase()
                        ? 'border-zinc-900 scale-110 shadow-sm'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: swatch.value }}
                  >
                    {color.toLowerCase() === swatch.value.toLowerCase() && (
                      <Check size={13} className={swatch.value === '#71717a' ? 'text-zinc-900' : 'text-white'} />
                    )}
                  </button>
                ))}

                <div className="h-6 w-px bg-zinc-200 mx-1" />

                <label
                  title="Pick custom color"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl cursor-pointer hover:border-zinc-400 transition-colors"
                >
                  <input
                    type="color"
                    value={color.startsWith('#') ? color : '#18181b'}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-xs text-zinc-700 uppercase font-semibold">{color}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Page Scope & Cover Page */}
          <div className="space-y-4 pt-3 border-t border-zinc-100">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Page Scope</h3>

            <div className="flex gap-2 bg-zinc-50 p-1 rounded-2xl border border-zinc-100">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  scope === 'all' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                All Pages
              </button>
              <button
                type="button"
                onClick={() => setScope('range')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  scope === 'range' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Page Range
              </button>
            </div>

            {scope === 'range' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="hf-from" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                    From Page
                  </label>
                  <input
                    id="hf-from"
                    type="number"
                    min={1}
                    max={pageCount}
                    value={fromPage}
                    onChange={(e) => setFromPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))}
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl font-mono text-xs font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="hf-to" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                    To Page
                  </label>
                  <input
                    id="hf-to"
                    type="number"
                    min={1}
                    max={pageCount}
                    value={toPage}
                    onChange={(e) => setToPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))}
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl font-mono text-xs font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Skip cover page toggle */}
            <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-zinc-900">Skip first page</p>
                <p className="text-[11px] text-zinc-400">Keep cover page or title sheet clean without headers</p>
              </div>
              <input
                type="checkbox"
                checked={skipFirstPage}
                onChange={(e) => setSkipFirstPage(e.target.checked)}
                className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900 cursor-pointer"
              />
            </div>

            <p className="text-[11px] font-medium text-zinc-500">
              {hasValidRange
                ? `${affectedCount} of ${pageCount} page${pageCount === 1 ? '' : 's'} will be updated.`
                : 'Selected range has no applicable pages in this document.'}
            </p>
          </div>

          {/* Submit Action */}
          <button
            type="button"
            onClick={applyHeaderFooter}
            disabled={phase === 'working' || !hasAnyText || !hasValidRange}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {phase === 'working' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Applying Header &amp; Footer…
              </>
            ) : (
              <>
                <Baseline size={16} />
                Add Header &amp; Footer to PDF
              </>
            )}
          </button>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 bg-zinc-50/70 border border-zinc-100 rounded-3xl p-6 lg:sticky lg:top-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Live Preview</h3>
              {previewSkipped && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded-md">
                  Skipped
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-zinc-200/80 rounded-xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                disabled={previewPage <= 1}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous preview page"
              >
                <ArrowLeft size={14} />
              </button>
              <span className="text-[11px] font-bold text-zinc-700 tabular-nums px-2">
                {previewPage} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPreviewPage((p) => Math.min(pageCount, p + 1))}
                disabled={previewPage >= pageCount}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next preview page"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs flex items-center justify-center p-3 min-h-[380px] overflow-hidden">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`Page ${previewPage} preview`}
                className="max-h-[540px] max-w-full object-contain shadow-2xs rounded"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <Loader2 size={24} className="animate-spin text-zinc-400" />
                <span className="text-xs">Rendering preview…</span>
              </div>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-zinc-400 text-center">
            {previewSkipped
              ? 'This page is excluded (cover page or outside range) and will remain untouched.'
              : 'Live representation of header, footer, dividers, and typography on this page.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = '',
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  suffix?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-700">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
      />
    </div>
  )
}
