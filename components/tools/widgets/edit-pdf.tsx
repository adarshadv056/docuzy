'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage } from 'pdf-lib'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bold,
  Check,
  Copy,
  Download,
  Eraser,
  FileText,
  Image as ImageIcon,
  Italic,
  Loader2,
  Move,
  PenTool,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Type,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type ElementType = 'text' | 'replace' | 'image' | 'rect'
type FontFamily = 'helvetica' | 'times' | 'courier'
type TextAlign = 'left' | 'center' | 'right'

interface BaseElement {
  id: string
  type: ElementType
  page: number
  x: number // Normalized 0..1
  y: number // Normalized 0..1
  width: number // Normalized 0..1
  height: number // Normalized 0..1
}

interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontSize: number
  fontFamily: FontFamily
  bold: boolean
  italic: boolean
  color: string
  align: TextAlign
  bgColor?: string
}

interface ReplaceElement extends BaseElement {
  type: 'replace'
  newText: string
  fontSize: number
  fontFamily: FontFamily
  bold: boolean
  italic: boolean
  color: string
  align: TextAlign
}

interface ImageElement extends BaseElement {
  type: 'image'
  dataUrl: string
  format: 'png' | 'jpeg'
}

interface RectElement extends BaseElement {
  type: 'rect'
  strokeColor: string
  strokeWidth: number
  fillColor?: string
}

type PdfElement = TextElement | ReplaceElement | ImageElement | RectElement

const FONT_MAP: Record<FontFamily, { regular: StandardFonts; bold: StandardFonts; italic: StandardFonts; boldItalic: StandardFonts; css: string }> = {
  helvetica: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique,
    css: 'Helvetica, Arial, sans-serif',
  },
  times: {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic,
    css: '"Times New Roman", Times, serif',
  },
  courier: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique,
    css: '"Courier New", Courier, monospace',
  },
}

const COLOR_PRESETS = [
  { label: 'Black', value: '#18181b' },
  { label: 'Slate', value: '#475569' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Emerald', value: '#16a34a' },
  { label: 'White', value: '#ffffff' },
]

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

export default function EditPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoomScale, setZoomScale] = useState(1.0)
  const [isLoadingPage, setIsLoadingPage] = useState(false)

  // Elements across document: keyed by pageNumber
  const [elements, setElements] = useState<Record<number, PdfElement[]>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Dragging / Resizing interaction
  const [isInteracting, setIsInteracting] = useState(false)
  const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null)
  const [interactionStart, setInteractionStart] = useState<{ x: number; y: number } | null>(null)
  const [initialElementState, setInitialElementState] = useState<PdfElement | null>(null)

  // Export & Status
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{
    bytes: Uint8Array
    originalSize: number
    newSize: number
    elementsAdded: number
    pagesModified: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pageSizeRef = useRef<{ width: number; height: number; unscaledWidth: number; unscaledHeight: number }>({
    width: 600,
    height: 800,
    unscaledWidth: 600,
    unscaledHeight: 800,
  })

  const pageCount = pdfDoc?.numPages ?? 0
  const currentPageElements = elements[pageNumber] || []
  const selectedElement = currentPageElements.find((e) => e.id === selectedId) || null

  const totalElementsCount = Object.values(elements).reduce((acc, list) => acc + list.length, 0)

  // Load PDF file
  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')
    setPdfDoc(null)
    setSourceBuffer(null)
    setFile(null)
    setElements({})
    setSelectedId(null)
    setPageNumber(1)

    try {
      const buffer = await selectedFile.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise
      setSourceBuffer(buffer)
      setPdfDoc(doc)
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
    setElements({})
    setSelectedId(null)
    setPhase('idle')
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Render base PDF page
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false
    setIsLoadingPage(true)

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (cancelled) return

        const unscaled = page.getViewport({ scale: 1.0 })
        const targetWidth = Math.min(800, window.innerWidth - 80) * zoomScale
        const scale = targetWidth / unscaled.width
        const viewport = page.getViewport({ scale })

        pageSizeRef.current = {
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
          unscaledWidth: unscaled.width,
          unscaledHeight: unscaled.height,
        }

        const baseCanvas = baseCanvasRef.current
        if (baseCanvas) {
          baseCanvas.width = pageSizeRef.current.width
          baseCanvas.height = pageSizeRef.current.height

          const ctx = baseCanvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, baseCanvas.width, baseCanvas.height)
            await page.render({ canvasContext: ctx, viewport, canvas: baseCanvas }).promise
          }
        }
      } catch (err) {
        console.error('Failed to render PDF page:', err)
      } finally {
        if (!cancelled) setIsLoadingPage(false)
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, pageNumber, zoomScale])

  // Element operations
  const addTextElement = () => {
    const newEl: TextElement = {
      id: `text_${Date.now()}`,
      type: 'text',
      page: pageNumber,
      x: 0.15,
      y: 0.15,
      width: 0.35,
      height: 0.08,
      text: 'Click to edit text',
      fontSize: 16,
      fontFamily: 'helvetica',
      bold: false,
      italic: false,
      color: '#18181b',
      align: 'left',
    }
    setElements((prev) => ({
      ...prev,
      [pageNumber]: [...(prev[pageNumber] || []), newEl],
    }))
    setSelectedId(newEl.id)
  }

  const addReplaceElement = () => {
    const newEl: ReplaceElement = {
      id: `replace_${Date.now()}`,
      type: 'replace',
      page: pageNumber,
      x: 0.2,
      y: 0.25,
      width: 0.35,
      height: 0.06,
      newText: 'Replacement text',
      fontSize: 15,
      fontFamily: 'helvetica',
      bold: false,
      italic: false,
      color: '#18181b',
      align: 'left',
    }
    setElements((prev) => ({
      ...prev,
      [pageNumber]: [...(prev[pageNumber] || []), newEl],
    }))
    setSelectedId(newEl.id)
  }

  const addBoxElement = () => {
    const newEl: RectElement = {
      id: `rect_${Date.now()}`,
      type: 'rect',
      page: pageNumber,
      x: 0.2,
      y: 0.2,
      width: 0.3,
      height: 0.15,
      strokeColor: '#4f46e5',
      strokeWidth: 2,
    }
    setElements((prev) => ({
      ...prev,
      [pageNumber]: [...(prev[pageNumber] || []), newEl],
    }))
    setSelectedId(newEl.id)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0]
    if (!imgFile) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      if (!dataUrl) return

      const img = new Image()
      img.onload = () => {
        const aspect = img.width / img.height
        const w = 0.28
        const h = w / aspect

        const newEl: ImageElement = {
          id: `img_${Date.now()}`,
          type: 'image',
          page: pageNumber,
          x: 0.35,
          y: 0.35,
          width: w,
          height: h,
          dataUrl,
          format: imgFile.type === 'image/jpeg' ? 'jpeg' : 'png',
        }

        setElements((prev) => ({
          ...prev,
          [pageNumber]: [...(prev[pageNumber] || []), newEl],
        }))
        setSelectedId(newEl.id)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(imgFile)
    e.target.value = ''
  }

  const updateSelected = (updater: (el: PdfElement) => PdfElement) => {
    if (!selectedId) return
    setElements((prev) => ({
      ...prev,
      [pageNumber]: (prev[pageNumber] || []).map((el) => (el.id === selectedId ? updater(el) : el)),
    }))
  }

  const removeSelected = () => {
    if (!selectedId) return
    setElements((prev) => ({
      ...prev,
      [pageNumber]: (prev[pageNumber] || []).filter((el) => el.id !== selectedId),
    }))
    setSelectedId(null)
  }

  const duplicateSelected = () => {
    if (!selectedElement) return
    const duplicated: PdfElement = {
      ...selectedElement,
      id: `${selectedElement.type}_${Date.now()}`,
      x: Math.min(0.8, selectedElement.x + 0.04),
      y: Math.min(0.8, selectedElement.y + 0.04),
    }
    setElements((prev) => ({
      ...prev,
      [pageNumber]: [...(prev[pageNumber] || []), duplicated],
    }))
    setSelectedId(duplicated.id)
  }

  // Pointer interactions for dragging and resizing elements
  const handlePointerDownElement = (e: React.PointerEvent, el: PdfElement, mode: 'move' | 'resize') => {
    e.stopPropagation()
    setSelectedId(el.id)
    setIsInteracting(true)
    setDragMode(mode)
    setInteractionStart({ x: e.clientX, y: e.clientY })
    setInitialElementState({ ...el })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (!isInteracting || !dragMode || !interactionStart || !initialElementState) return

    const dx = (e.clientX - interactionStart.x) / pageSizeRef.current.width
    const dy = (e.clientY - interactionStart.y) / pageSizeRef.current.height

    if (dragMode === 'move') {
      const newX = Math.max(0, Math.min(1 - initialElementState.width, initialElementState.x + dx))
      const newY = Math.max(0, Math.min(1 - initialElementState.height, initialElementState.y + dy))

      updateSelected((el) => ({
        ...el,
        x: Number(newX.toFixed(4)),
        y: Number(newY.toFixed(4)),
      }))
    } else if (dragMode === 'resize') {
      const newW = Math.max(0.04, Math.min(1 - initialElementState.x, initialElementState.width + dx))
      const newH = Math.max(0.02, Math.min(1 - initialElementState.y, initialElementState.height + dy))

      updateSelected((el) => ({
        ...el,
        width: Number(newW.toFixed(4)),
        height: Number(newH.toFixed(4)),
      }))
    }
  }

  const handlePointerUpCanvas = (e: React.PointerEvent) => {
    if (isInteracting) {
      setIsInteracting(false)
      setDragMode(null)
      setInteractionStart(null)
      setInitialElementState(null)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
  }

  // Export edited PDF
  const applyEdits = async () => {
    if (!file || !sourceBuffer || totalElementsCount === 0) return
    setPhase('working')
    setError(null)

    try {
      const pdf = await PDFDocument.load(sourceBuffer.slice(0), {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      })
      const pageCount = pdf.getPageCount()
      let pagesModified = 0

      // Cache embedded fonts
      const fontCache: Record<string, any> = {}
      const getFont = async (family: FontFamily, bold: boolean, italic: boolean) => {
        const key = `${family}_${bold}_${italic}`
        if (!fontCache[key]) {
          const config = FONT_MAP[family]
          const standardFont = bold && italic
            ? config.boldItalic
            : bold
            ? config.bold
            : italic
            ? config.italic
            : config.regular
          fontCache[key] = await pdf.embedFont(standardFont)
        }
        return fontCache[key]
      }

      for (let i = 0; i < pageCount; i++) {
        const pageIdx = i + 1
        const items = elements[pageIdx]
        if (!items || items.length === 0) continue

        const page = pdf.getPage(i)
        const box = visibleBox(page)
        const rotation = rotationOf(page)
        const size = displaySize(box, rotation)

        for (const item of items) {
          const xd = item.x * size.width
          const ydTop = item.y * size.height
          const elW = item.width * size.width
          const elH = item.height * size.height
          const ydBottom = size.height - (ydTop + elH)

          if (item.type === 'text') {
            const font = await getFont(item.fontFamily, item.bold, item.italic)
            const textColor = hexToRgb(item.color)

            // Optional background fill
            if (item.bgColor) {
              const [rx, ry] = displayToUser(box, rotation, xd, ydBottom)
              page.drawRectangle({
                x: rx,
                y: ry,
                width: elW,
                height: elH,
                color: hexToRgb(item.bgColor),
                rotate: degrees(rotation),
              })
            }

            // Draw text lines
            const lines = item.text.split('\n')
            const lineHeight = item.fontSize * 1.2
            lines.forEach((line, idx) => {
              if (!line.trim()) return
              const textWidth = font.widthOfTextAtSize(line, item.fontSize)
              let textXd = xd
              if (item.align === 'center') textXd = xd + (elW - textWidth) / 2
              if (item.align === 'right') textXd = xd + (elW - textWidth)

              const textYd = size.height - (ydTop + (idx + 1) * lineHeight - 2)
              const [tx, ty] = displayToUser(box, rotation, textXd, textYd)

              page.drawText(line, {
                x: tx,
                y: ty,
                size: item.fontSize,
                font,
                color: textColor,
                rotate: degrees(rotation),
              })
            })
          } else if (item.type === 'replace') {
            // Whiteout patch over original text
            const [rx, ry] = displayToUser(box, rotation, xd, ydBottom)
            page.drawRectangle({
              x: rx,
              y: ry,
              width: elW,
              height: elH,
              color: rgb(1, 1, 1),
              rotate: degrees(rotation),
            })

            // Draw new replacement text
            const font = await getFont(item.fontFamily, item.bold, item.italic)
            const textColor = hexToRgb(item.color)
            const textWidth = font.widthOfTextAtSize(item.newText, item.fontSize)

            let textXd = xd
            if (item.align === 'center') textXd = xd + (elW - textWidth) / 2
            if (item.align === 'right') textXd = xd + (elW - textWidth)

            const textYd = ydBottom + (elH - item.fontSize) / 2
            const [tx, ty] = displayToUser(box, rotation, textXd, textYd)

            page.drawText(item.newText, {
              x: tx,
              y: ty,
              size: item.fontSize,
              font,
              color: textColor,
              rotate: degrees(rotation),
            })
          } else if (item.type === 'image') {
            const imgBytes = await fetch(item.dataUrl).then((r) => r.arrayBuffer())
            const embedded = item.format === 'jpeg' ? await pdf.embedJpg(imgBytes) : await pdf.embedPng(imgBytes)

            const [ix, iy] = displayToUser(box, rotation, xd, ydBottom)
            page.drawImage(embedded, {
              x: ix,
              y: iy,
              width: elW,
              height: elH,
              rotate: degrees(rotation),
            })
          } else if (item.type === 'rect') {
            const [rx, ry] = displayToUser(box, rotation, xd, ydBottom)
            page.drawRectangle({
              x: rx,
              y: ry,
              width: elW,
              height: elH,
              borderColor: hexToRgb(item.strokeColor),
              borderWidth: item.strokeWidth,
              color: item.fillColor ? hexToRgb(item.fillColor) : undefined,
              rotate: degrees(rotation),
            })
          }
        }
        pagesModified++
      }

      const bytes = await pdf.save()
      setResult({
        bytes,
        originalSize: file.size,
        newSize: bytes.byteLength,
        elementsAdded: totalElementsCount,
        pagesModified,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not save edited PDF. Please check your text and images and try again.')
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `edited-${file.name}`
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
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Your PDF is edited!</h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            {result.elementsAdded} element{result.elementsAdded === 1 ? '' : 's'} embedded cleanly across{' '}
            {result.pagesModified} page{result.pagesModified === 1 ? '' : 's'}.
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
            Download Edited PDF
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('idle')}
              className="flex-1 py-3 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl transition-colors"
            >
              Continue Editing
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
              <PenTool size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">Select a PDF to edit online</p>
              <p className="text-xs text-zinc-400 mt-1">Add new text, replace existing words, and insert images</p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 rounded-full text-[11px] font-medium text-zinc-500">
              <Sparkles size={12} className="text-indigo-600" />
              100% private &amp; rendered entirely in your browser
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

  return (
    <div className="space-y-4">
      {/* Hidden file input for image uploads */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageUpload}
        accept="image/png,image/jpeg"
        className="hidden"
      />

      {/* Top Header & Navigation Bar */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Document summary */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
            <p className="text-xs text-zinc-400">
              Page {pageNumber} of {pageCount} · {totalElementsCount} element{totalElementsCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Page Switcher */}
        <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200/80 rounded-xl p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setPageNumber((p) => Math.max(1, p - 1))
              setSelectedId(null)
            }}
            disabled={pageNumber <= 1}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-bold text-zinc-700 tabular-nums px-2">
            Page {pageNumber} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => {
              setPageNumber((p) => Math.min(pageCount, p + 1))
              setSelectedId(null)
            }}
            disabled={pageNumber >= pageCount}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
          >
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Zoom & Save Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-100">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
              className="p-1 text-zinc-500 hover:text-zinc-900"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] font-bold text-zinc-600 px-1">{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
              className="p-1 text-zinc-500 hover:text-zinc-900"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200 mx-1" />

          <button
            type="button"
            onClick={applyEdits}
            disabled={phase === 'working' || totalElementsCount === 0}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {phase === 'working' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Download size={14} />
                Save &amp; Download
              </>
            )}
          </button>

          <button
            type="button"
            onClick={startOver}
            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors ml-1"
            title="Close file"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Editing Toolbar */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Primary Add Elements */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={addTextElement}
            className="px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
          >
            <Type size={14} className="text-indigo-600" />
            + Add Text
          </button>
          <button
            type="button"
            onClick={addReplaceElement}
            className="px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
            title="Whiteout old text and replace with new words"
          >
            <Eraser size={14} className="text-amber-600" />
            + Replace Text
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
          >
            <ImageIcon size={14} className="text-emerald-600" />
            + Add Image
          </button>
          <button
            type="button"
            onClick={addBoxElement}
            className="px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
          >
            <Square size={14} className="text-slate-600" />
            + Add Box
          </button>
        </div>

        {/* Contextual Properties for Selected Element */}
        {selectedElement ? (
          <div className="flex items-center gap-2">
            {(selectedElement.type === 'text' || selectedElement.type === 'replace') && (
              <>
                {/* Font family */}
                <select
                  value={selectedElement.fontFamily}
                  onChange={(e) => updateSelected((el) => ({ ...el, fontFamily: e.target.value as FontFamily }))}
                  className="p-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium outline-none"
                >
                  <option value="helvetica">Helvetica</option>
                  <option value="times">Times</option>
                  <option value="courier">Courier</option>
                </select>

                {/* Font size */}
                <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => updateSelected((el) => ('fontSize' in el ? { ...el, fontSize: Math.max(8, el.fontSize - 2) } : el))}
                    className="px-1.5 py-0.5 text-xs font-bold text-zinc-600 hover:text-zinc-900"
                  >
                    -
                  </button>
                  <span className="text-xs font-bold tabular-nums px-1 text-zinc-800">{selectedElement.fontSize} pt</span>
                  <button
                    type="button"
                    onClick={() => updateSelected((el) => ('fontSize' in el ? { ...el, fontSize: Math.min(64, el.fontSize + 2) } : el))}
                    className="px-1.5 py-0.5 text-xs font-bold text-zinc-600 hover:text-zinc-900"
                  >
                    +
                  </button>
                </div>

                {/* Bold & Italic */}
                <button
                  type="button"
                  onClick={() => updateSelected((el) => ('bold' in el ? { ...el, bold: !el.bold } : el))}
                  className={`p-1.5 rounded-lg border text-xs ${
                    selectedElement.bold ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                  }`}
                  title="Bold"
                >
                  <Bold size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelected((el) => ('italic' in el ? { ...el, italic: !el.italic } : el))}
                  className={`p-1.5 rounded-lg border text-xs ${
                    selectedElement.italic ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                  }`}
                  title="Italic"
                >
                  <Italic size={13} />
                </button>

                {/* Alignment */}
                <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-lg p-0.5">
                  {(['left', 'center', 'right'] as TextAlign[]).map((align) => {
                    const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight
                    return (
                      <button
                        key={align}
                        type="button"
                        onClick={() => updateSelected((el) => ('align' in el ? { ...el, align } : el))}
                        className={`p-1 rounded ${selectedElement.align === align ? 'bg-zinc-900 text-white' : 'text-zinc-600'}`}
                      >
                        <Icon size={13} />
                      </button>
                    )
                  })}
                </div>

                {/* Color swatches */}
                <div className="flex items-center gap-1">
                  {COLOR_PRESETS.slice(0, 4).map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => updateSelected((el) => ('color' in el ? { ...el, color: c.value } : el))}
                      className={`w-5 h-5 rounded-full border transition-transform ${
                        selectedElement.color === c.value ? 'border-zinc-900 scale-110 shadow-xs' : 'border-zinc-200'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={selectedElement.color}
                    onChange={(e) => updateSelected((el) => ('color' in el ? { ...el, color: e.target.value } : el))}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                    title="Custom color"
                  />
                </div>
              </>
            )}

            <div className="h-5 w-px bg-zinc-200 mx-1" />

            {/* Duplicate & Delete */}
            <button
              type="button"
              onClick={duplicateSelected}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              title="Duplicate element"
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={removeSelected}
              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete element"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-zinc-400">Click any element on the page to customize it</span>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {/* Main Interactive Workspace */}
      <div
        onPointerMove={handlePointerMoveCanvas}
        onPointerUp={handlePointerUpCanvas}
        onClick={() => setSelectedId(null)}
        className="relative bg-zinc-100 border border-zinc-200/80 rounded-3xl p-6 flex items-center justify-center min-h-[580px] overflow-auto shadow-inner select-none"
      >
        {isLoadingPage && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-30 rounded-3xl">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-zinc-100 text-xs font-semibold text-zinc-700">
              <Loader2 size={16} className="animate-spin text-zinc-500" />
              Loading page {pageNumber}…
            </div>
          </div>
        )}

        <div
          className="relative rounded border border-zinc-300 shadow-md bg-white overflow-hidden"
          style={{
            width: pageSizeRef.current.width,
            height: pageSizeRef.current.height,
          }}
        >
          {/* Base PDF Rendered Page */}
          <canvas
            ref={baseCanvasRef}
            className="absolute top-0 left-0 block rounded pointer-events-none"
            style={{
              width: pageSizeRef.current.width,
              height: pageSizeRef.current.height,
            }}
          />

          {/* Interactive Document Elements Layer */}
          {currentPageElements.map((el) => {
            const isSelected = el.id === selectedId
            const left = el.x * pageSizeRef.current.width
            const top = el.y * pageSizeRef.current.height
            const width = el.width * pageSizeRef.current.width
            const height = el.height * pageSizeRef.current.height

            return (
              <div
                key={el.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedId(el.id)
                }}
                className={`absolute group cursor-move transition-shadow ${
                  isSelected
                    ? 'ring-2 ring-indigo-600 shadow-lg z-20'
                    : 'hover:ring-1 hover:ring-zinc-400 z-10'
                }`}
                style={{
                  left,
                  top,
                  width,
                  height,
                }}
              >
                {/* Drag handle header when selected */}
                {isSelected && (
                  <div
                    onPointerDown={(e) => handlePointerDownElement(e, el, 'move')}
                    className="absolute -top-6 left-0 bg-indigo-600 text-white rounded-t-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1 cursor-move"
                  >
                    <Move size={10} />
                    <span>Drag</span>
                  </div>
                )}

                {/* Render element content */}
                {el.type === 'text' && (
                  <textarea
                    value={el.text}
                    onChange={(e) => updateSelected((item) => (item.type === 'text' ? { ...item, text: e.target.value } : item))}
                    className="w-full h-full bg-transparent resize-none border-none outline-none p-1 font-medium leading-tight"
                    style={{
                      fontSize: `${el.fontSize * zoomScale}px`,
                      fontFamily: FONT_MAP[el.fontFamily].css,
                      fontWeight: el.bold ? 700 : 400,
                      fontStyle: el.italic ? 'italic' : 'normal',
                      color: el.color,
                      textAlign: el.align,
                      backgroundColor: el.bgColor || 'transparent',
                    }}
                  />
                )}

                {el.type === 'replace' && (
                  <div className="w-full h-full bg-white border border-dashed border-amber-400 p-1 flex items-center">
                    <input
                      type="text"
                      value={el.newText}
                      onChange={(e) =>
                        updateSelected((item) => (item.type === 'replace' ? { ...item, newText: e.target.value } : item))
                      }
                      className="w-full bg-transparent border-none outline-none font-medium leading-tight"
                      style={{
                        fontSize: `${el.fontSize * zoomScale}px`,
                        fontFamily: FONT_MAP[el.fontFamily].css,
                        fontWeight: el.bold ? 700 : 400,
                        fontStyle: el.italic ? 'italic' : 'normal',
                        color: el.color,
                        textAlign: el.align,
                      }}
                    />
                  </div>
                )}

                {el.type === 'image' && (
                  <img src={el.dataUrl} alt="Inserted logo" className="w-full h-full object-contain pointer-events-none" />
                )}

                {el.type === 'rect' && (
                  <div
                    className="w-full h-full pointer-events-none"
                    style={{
                      border: `${el.strokeWidth}px solid ${el.strokeColor}`,
                      backgroundColor: el.fillColor || 'transparent',
                    }}
                  />
                )}

                {/* Resize Handle at Bottom-Right */}
                {isSelected && (
                  <div
                    onPointerDown={(e) => handlePointerDownElement(e, el, 'resize')}
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border border-white rounded-full cursor-nwse-resize shadow-xs"
                    title="Resize element"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
