'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument, degrees, type PDFPage } from 'pdf-lib'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Circle,
  Download,
  FileText,
  Highlighter,
  Loader2,
  Pen,
  Redo2,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type ToolMode = 'pen' | 'highlighter' | 'text' | 'rect' | 'circle' | 'arrow'

interface Point {
  x: number // Normalized 0..1 relative to page width
  y: number // Normalized 0..1 relative to page height
}

interface BaseAnnotation {
  id: string
  type: ToolMode
  color: string
  strokeWidth: number
  opacity: number
}

interface StrokeAnnotation extends BaseAnnotation {
  type: 'pen' | 'highlighter'
  points: Point[]
}

interface ShapeAnnotation extends BaseAnnotation {
  type: 'rect' | 'circle' | 'arrow'
  start: Point
  end: Point
  filled?: boolean
}

interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  position: Point
  text: string
  fontSize: number
  bgColor?: string
}

type Annotation = StrokeAnnotation | ShapeAnnotation | TextAnnotation

const PEN_COLORS = [
  { label: 'Black', value: '#18181b' },
  { label: 'Slate', value: '#475569' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Emerald', value: '#16a34a' },
  { label: 'Amber', value: '#d97706' },
]

const HIGHLIGHTER_COLORS = [
  { label: 'Yellow', value: '#facc15' },
  { label: 'Green', value: '#4ade80' },
  { label: 'Pink', value: '#f472b6' },
  { label: 'Cyan', value: '#38bdf8' },
  { label: 'Orange', value: '#fb923c' },
]

const PEN_WIDTHS = [
  { label: 'Thin', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick', value: 8 },
]

const HIGHLIGHTER_WIDTHS = [
  { label: 'Small', value: 16 },
  { label: 'Medium', value: 26 },
  { label: 'Large', value: 38 },
]

const TEXT_SIZES = [
  { label: '14 pt', value: 14 },
  { label: '18 pt', value: 18 },
  { label: '24 pt', value: 24 },
  { label: '32 pt', value: 32 },
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

/* ------------------------------------------------------------------ */
/* Page Geometry helpers for PDF export                               */
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

export default function AnnotatePdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoomScale, setZoomScale] = useState(1.0)
  const [isLoadingPage, setIsLoadingPage] = useState(false)

  // Active Tool state
  const [tool, setTool] = useState<ToolMode>('pen')
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value)
  const [highlighterColor, setHighlighterColor] = useState(HIGHLIGHTER_COLORS[0].value)
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [highlighterWidth, setHighlighterWidth] = useState(24)
  const [textSize, setTextSize] = useState(18)
  const [shapeFilled, setShapeFilled] = useState(false)

  // Annotations mapped per page index (1-based)
  const [annotations, setAnnotations] = useState<Record<number, Annotation[]>>({})
  const [history, setHistory] = useState<Record<number, { past: Annotation[][]; future: Annotation[][] }>>({})

  // Active drawing interaction
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [shapeStart, setShapeStart] = useState<Point | null>(null)
  const [shapeCurrent, setShapeCurrent] = useState<Point | null>(null)

  // Text editing overlay
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingTextValue, setEditingTextValue] = useState('')

  // Export & Status
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{
    bytes: Uint8Array
    originalSize: number
    newSize: number
    pagesAnnotated: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageSizeRef = useRef<{ width: number; height: number; unscaledWidth: number; unscaledHeight: number }>({
    width: 600,
    height: 800,
    unscaledWidth: 600,
    unscaledHeight: 800,
  })

  const pageCount = pdfDoc?.numPages ?? 0
  const currentPageAnnotations = annotations[pageNumber] || []
  const canUndo = (history[pageNumber]?.past?.length ?? 0) > 0
  const canRedo = (history[pageNumber]?.future?.length ?? 0) > 0

  // File loading
  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')
    setPdfDoc(null)
    setSourceBuffer(null)
    setFile(null)
    setAnnotations({})
    setHistory({})
    setPageNumber(1)
    setEditingTextId(null)

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
    setAnnotations({})
    setHistory({})
    setPhase('idle')
    setResult(null)
    setError(null)
    setEditingTextId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Render the base PDF page onto background canvas
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false
    setIsLoadingPage(true)

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (cancelled) return

        const unscaled = page.getViewport({ scale: 1.0 })
        // Base display width targeting ~750px standard preview scaled with zoomScale
        const targetWidth = Math.min(840, window.innerWidth - 80) * zoomScale
        const scale = targetWidth / unscaled.width
        const viewport = page.getViewport({ scale })

        pageSizeRef.current = {
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
          unscaledWidth: unscaled.width,
          unscaledHeight: unscaled.height,
        }

        const baseCanvas = baseCanvasRef.current
        const overlayCanvas = overlayCanvasRef.current

        if (baseCanvas && overlayCanvas) {
          baseCanvas.width = pageSizeRef.current.width
          baseCanvas.height = pageSizeRef.current.height
          overlayCanvas.width = pageSizeRef.current.width
          overlayCanvas.height = pageSizeRef.current.height

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

  // Draw annotations on the interactive overlay canvas
  const drawAnnotationsOnCanvas = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      items: Annotation[],
      width: number,
      height: number,
      activeStroke?: { points: Point[]; tool: ToolMode; color: string; width: number },
      activeShape?: { start: Point; end: Point; tool: ToolMode; color: string; width: number; filled?: boolean }
    ) => {
      ctx.clearRect(0, 0, width, height)

      // Helper to render an individual annotation
      const renderItem = (item: Annotation) => {
        ctx.save()
        if (item.type === 'pen' || item.type === 'highlighter') {
          if (item.points.length < 2) {
            ctx.restore()
            return
          }
          ctx.beginPath()
          ctx.strokeStyle = item.color
          ctx.lineWidth = item.strokeWidth * (width / 600)
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'

          if (item.type === 'highlighter') {
            ctx.globalAlpha = 0.38
            ctx.lineWidth = item.strokeWidth * (width / 600)
          } else {
            ctx.globalAlpha = item.opacity
          }

          const pts = item.points
          ctx.moveTo(pts[0].x * width, pts[0].y * height)
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x * width, pts[i].y * height)
          }
          ctx.stroke()
        } else if (item.type === 'rect') {
          const x = Math.min(item.start.x, item.end.x) * width
          const y = Math.min(item.start.y, item.end.y) * height
          const w = Math.abs(item.end.x - item.start.x) * width
          const h = Math.abs(item.end.y - item.start.y) * height

          ctx.strokeStyle = item.color
          ctx.lineWidth = item.strokeWidth * (width / 600)
          ctx.strokeRect(x, y, w, h)

          if (item.filled) {
            ctx.fillStyle = item.color
            ctx.globalAlpha = 0.2
            ctx.fillRect(x, y, w, h)
          }
        } else if (item.type === 'circle') {
          const rx = (Math.abs(item.end.x - item.start.x) * width) / 2
          const ry = (Math.abs(item.end.y - item.start.y) * height) / 2
          const cx = Math.min(item.start.x, item.end.x) * width + rx
          const cy = Math.min(item.start.y, item.end.y) * height + ry

          ctx.beginPath()
          ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2)
          ctx.strokeStyle = item.color
          ctx.lineWidth = item.strokeWidth * (width / 600)
          ctx.stroke()

          if (item.filled) {
            ctx.fillStyle = item.color
            ctx.globalAlpha = 0.2
            ctx.fill()
          }
        } else if (item.type === 'arrow') {
          const x1 = item.start.x * width
          const y1 = item.start.y * height
          const x2 = item.end.x * width
          const y2 = item.end.y * height

          ctx.strokeStyle = item.color
          ctx.lineWidth = item.strokeWidth * (width / 600)
          ctx.lineCap = 'round'

          // Line
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()

          // Arrowhead
          const angle = Math.atan2(y2 - y1, x2 - x1)
          const headLength = Math.max(12, item.strokeWidth * 3.5 * (width / 600))
          ctx.beginPath()
          ctx.moveTo(x2, y2)
          ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6))
          ctx.moveTo(x2, y2)
          ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6))
          ctx.stroke()
        } else if (item.type === 'text') {
          if (!item.text.trim()) {
            ctx.restore()
            return
          }
          const px = item.position.x * width
          const py = item.position.y * height
          const scaledFont = item.fontSize * (width / 600)

          ctx.font = `600 ${scaledFont}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
          ctx.textBaseline = 'top'

          const lines = item.text.split('\n')
          const lineHeight = scaledFont * 1.25

          lines.forEach((line, idx) => {
            // Optional subtle white backing for readability
            ctx.save()
            const metrics = ctx.measureText(line)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
            ctx.fillRect(px - 2, py + idx * lineHeight - 1, metrics.width + 4, lineHeight)
            ctx.restore()

            ctx.fillStyle = item.color
            ctx.fillText(line, px, py + idx * lineHeight)
          })
        }
        ctx.restore()
      }

      // Render committed items
      items.forEach(renderItem)

      // Render live in-progress stroke
      if (activeStroke && activeStroke.points.length > 1) {
        ctx.save()
        ctx.beginPath()
        ctx.strokeStyle = activeStroke.color
        ctx.lineWidth = activeStroke.width * (width / 600)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        if (activeStroke.tool === 'highlighter') {
          ctx.globalAlpha = 0.38
        }

        const pts = activeStroke.points
        ctx.moveTo(pts[0].x * width, pts[0].y * height)
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * width, pts[i].y * height)
        }
        ctx.stroke()
        ctx.restore()
      }

      // Render live in-progress shape
      if (activeShape) {
        const dummy: ShapeAnnotation = {
          id: 'temp',
          type: activeShape.tool as 'rect' | 'circle' | 'arrow',
          color: activeShape.color,
          strokeWidth: activeShape.width,
          opacity: 1,
          start: activeShape.start,
          end: activeShape.end,
          filled: activeShape.filled,
        }
        renderItem(dummy)
      }
    },
    []
  )

  // Re-draw overlay whenever annotations or in-progress drawings change
  useEffect(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const activeStroke =
      isDrawing && (tool === 'pen' || tool === 'highlighter')
        ? {
            points: currentStroke,
            tool,
            color: tool === 'highlighter' ? highlighterColor : penColor,
            width: tool === 'highlighter' ? highlighterWidth : strokeWidth,
          }
        : undefined

    const activeShape =
      isDrawing && shapeStart && shapeCurrent && (tool === 'rect' || tool === 'circle' || tool === 'arrow')
        ? {
            start: shapeStart,
            end: shapeCurrent,
            tool,
            color: penColor,
            width: strokeWidth,
            filled: shapeFilled,
          }
        : undefined

    drawAnnotationsOnCanvas(ctx, currentPageAnnotations, canvas.width, canvas.height, activeStroke, activeShape)
  }, [
    currentPageAnnotations,
    isDrawing,
    currentStroke,
    shapeStart,
    shapeCurrent,
    tool,
    penColor,
    highlighterColor,
    strokeWidth,
    highlighterWidth,
    shapeFilled,
    drawAnnotationsOnCanvas,
  ])

  // History & Undo / Redo
  const commitAnnotations = (newAnnotations: Annotation[]) => {
    setHistory((prev) => {
      const pageHistory = prev[pageNumber] || { past: [], future: [] }
      return {
        ...prev,
        [pageNumber]: {
          past: [...pageHistory.past, currentPageAnnotations],
          future: [],
        },
      }
    })

    setAnnotations((prev) => ({
      ...prev,
      [pageNumber]: newAnnotations,
    }))
  }

  const handleUndo = () => {
    const pageHistory = history[pageNumber]
    if (!pageHistory || pageHistory.past.length === 0) return

    const previousState = pageHistory.past[pageHistory.past.length - 1]
    const newPast = pageHistory.past.slice(0, -1)

    setHistory((prev) => ({
      ...prev,
      [pageNumber]: {
        past: newPast,
        future: [currentPageAnnotations, ...pageHistory.future],
      },
    }))

    setAnnotations((prev) => ({
      ...prev,
      [pageNumber]: previousState,
    }))
  }

  const handleRedo = () => {
    const pageHistory = history[pageNumber]
    if (!pageHistory || pageHistory.future.length === 0) return

    const nextState = pageHistory.future[0]
    const newFuture = pageHistory.future.slice(1)

    setHistory((prev) => ({
      ...prev,
      [pageNumber]: {
        past: [...pageHistory.past, currentPageAnnotations],
        future: newFuture,
      },
    }))

    setAnnotations((prev) => ({
      ...prev,
      [pageNumber]: nextState,
    }))
  }

  const clearPage = () => {
    if (currentPageAnnotations.length === 0) return
    commitAnnotations([])
  }

  // Pointer event coordinate helpers
  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingTextId) {
      // Close text editing if open
      setEditingTextId(null)
      return
    }

    const pos = getPointerPos(e)
    setIsDrawing(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    if (tool === 'pen' || tool === 'highlighter') {
      setCurrentStroke([pos])
    } else if (tool === 'rect' || tool === 'circle' || tool === 'arrow') {
      setShapeStart(pos)
      setShapeCurrent(pos)
    } else if (tool === 'text') {
      // Create a new text box at click position
      const newId = `text_${Date.now()}`
      const newTextAnnotation: TextAnnotation = {
        id: newId,
        type: 'text',
        position: pos,
        text: 'Click to type note',
        fontSize: textSize,
        color: penColor,
        strokeWidth: 1,
        opacity: 1,
      }
      commitAnnotations([...currentPageAnnotations, newTextAnnotation])
      setEditingTextId(newId)
      setEditingTextValue('Click to type note')
      setIsDrawing(false)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const pos = getPointerPos(e)

    if (tool === 'pen' || tool === 'highlighter') {
      setCurrentStroke((prev) => [...prev, pos])
    } else if (tool === 'rect' || tool === 'circle' || tool === 'arrow') {
      setShapeCurrent(pos)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    setIsDrawing(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (tool === 'pen' || tool === 'highlighter') {
      if (currentStroke.length > 1) {
        const strokeAnno: StrokeAnnotation = {
          id: `stroke_${Date.now()}`,
          type: tool,
          points: currentStroke,
          color: tool === 'highlighter' ? highlighterColor : penColor,
          strokeWidth: tool === 'highlighter' ? highlighterWidth : strokeWidth,
          opacity: 1,
        }
        commitAnnotations([...currentPageAnnotations, strokeAnno])
      }
      setCurrentStroke([])
    } else if (shapeStart && shapeCurrent) {
      // Minimum drag threshold
      const dist = Math.hypot(shapeCurrent.x - shapeStart.x, shapeCurrent.y - shapeStart.y)
      if (dist > 0.01) {
        const shapeAnno: ShapeAnnotation = {
          id: `shape_${Date.now()}`,
          type: tool as 'rect' | 'circle' | 'arrow',
          start: shapeStart,
          end: shapeCurrent,
          color: penColor,
          strokeWidth,
          opacity: 1,
          filled: shapeFilled,
        }
        commitAnnotations([...currentPageAnnotations, shapeAnno])
      }
      setShapeStart(null)
      setShapeCurrent(null)
    }
  }

  // Update text annotation value
  const handleTextCommit = (id: string, newText: string) => {
    if (!newText.trim()) {
      // Delete if empty
      commitAnnotations(currentPageAnnotations.filter((a) => a.id !== id))
    } else {
      commitAnnotations(
        currentPageAnnotations.map((a) => (a.id === id && a.type === 'text' ? { ...a, text: newText } : a))
      )
    }
    setEditingTextId(null)
  }

  // PDF Export
  const exportAnnotatedPdf = async () => {
    if (!file || !sourceBuffer) return
    setPhase('working')
    setError(null)

    try {
      const pdf = await PDFDocument.load(sourceBuffer.slice(0), {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      })
      const pages = pdf.getPages()
      let pagesAnnotated = 0

      for (let i = 0; i < pages.length; i++) {
        const pageIdx = i + 1
        const pageItems = annotations[pageIdx]
        if (!pageItems || pageItems.length === 0) continue

        const page = pages[i]
        const box = visibleBox(page)
        const rotation = rotationOf(page)
        const size = displaySize(box, rotation)

        // Offscreen high-resolution canvas (2x resolution for retina sharpness)
        const exportCanvas = document.createElement('canvas')
        const scaleFactor = 2
        exportCanvas.width = Math.floor(size.width * scaleFactor)
        exportCanvas.height = Math.floor(size.height * scaleFactor)

        const ctx = exportCanvas.getContext('2d')
        if (!ctx) continue

        drawAnnotationsOnCanvas(ctx, pageItems, exportCanvas.width, exportCanvas.height)

        const pngDataUrl = exportCanvas.toDataURL('image/png')
        const pngImage = await pdf.embedPng(pngDataUrl)

        const [originX, originY] = displayToUser(box, rotation, 0, 0)

        page.drawImage(pngImage, {
          x: originX,
          y: originY,
          width: size.width,
          height: size.height,
          rotate: degrees(rotation),
        })

        pagesAnnotated++
      }

      const bytes = await pdf.save()
      setResult({
        bytes,
        originalSize: file.size,
        newSize: bytes.byteLength,
        pagesAnnotated,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not export annotated PDF. Please check your annotations and try again.')
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `annotated-${file.name}`
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
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Annotations Saved!</h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            Your notes, highlights, and drawings were embedded across {result.pagesAnnotated} page
            {result.pagesAnnotated === 1 ? '' : 's'}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Original Size</p>
            <p className="text-base font-semibold text-zinc-600 tabular-nums">{formatSize(result.originalSize)}</p>
          </div>
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Annotated PDF</p>
            <p className="text-base font-bold text-zinc-900 tabular-nums">{formatSize(result.newSize)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={downloadResult}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download Annotated PDF
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('idle')}
              className="flex-1 py-3 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl transition-colors"
            >
              Back to Annotating
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
              <p className="text-base font-semibold text-zinc-900">Select a PDF to annotate</p>
              <p className="text-xs text-zinc-400 mt-1">Highlight text, draw freehand, add comments, and shapes</p>
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

  // Active editing workspace
  return (
    <div className="space-y-4">
      {/* Top Main Bar */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Document Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
            <p className="text-xs text-zinc-400">
              Page {pageNumber} of {pageCount} · {formatSize(file.size)}
            </p>
          </div>
        </div>

        {/* Page Switcher */}
        <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200/80 rounded-xl p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-bold text-zinc-700 tabular-nums px-2">
            {pageNumber} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}
            disabled={pageNumber >= pageCount}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
          >
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Undo, Redo, Clear & Zoom */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Redo"
          >
            <Redo2 size={16} />
          </button>
          <button
            type="button"
            onClick={clearPage}
            disabled={currentPageAnnotations.length === 0}
            className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Clear annotations on this page"
          >
            <Trash2 size={16} />
          </button>

          <div className="h-5 w-px bg-zinc-200 mx-1" />

          {/* Zoom controls */}
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

          {/* Export Action */}
          <button
            type="button"
            onClick={exportAnnotatedPdf}
            disabled={phase === 'working'}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
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

      {/* Annotation Tool Shelf */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Tool Modes */}
        <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-zinc-100">
          {[
            { id: 'pen', label: 'Pen', icon: Pen },
            { id: 'highlighter', label: 'Highlight', icon: Highlighter },
            { id: 'text', label: 'Text Note', icon: Type },
            { id: 'rect', label: 'Rectangle', icon: Square },
            { id: 'circle', label: 'Circle', icon: Circle },
            { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id as ToolMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tool === id ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Dynamic Tool Options Bar */}
        <div className="flex items-center gap-3">
          {/* Colors */}
          {tool === 'highlighter' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">Tint</span>
              {HIGHLIGHTER_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setHighlighterColor(c.value)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    highlighterColor === c.value ? 'border-zinc-900 scale-110 shadow-xs' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">Color</span>
              {PEN_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setPenColor(c.value)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    penColor === c.value ? 'border-zinc-900 scale-110 shadow-xs' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
              <input
                type="color"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
                className="w-6 h-6 rounded-md cursor-pointer border-0 bg-transparent p-0"
                title="Custom color"
              />
            </div>
          )}

          <div className="h-5 w-px bg-zinc-200" />

          {/* Width / Size selection */}
          {tool === 'pen' || tool === 'rect' || tool === 'circle' || tool === 'arrow' ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">Thickness</span>
              {PEN_WIDTHS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => setStrokeWidth(w.value)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    strokeWidth === w.value ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {w.label}
                </button>
              ))}

              {(tool === 'rect' || tool === 'circle') && (
                <label className="flex items-center gap-1.5 ml-2 cursor-pointer text-xs font-semibold text-zinc-600 select-none">
                  <input
                    type="checkbox"
                    checked={shapeFilled}
                    onChange={(e) => setShapeFilled(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900"
                  />
                  Fill
                </label>
              )}
            </div>
          ) : tool === 'highlighter' ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">Brush</span>
              {HIGHLIGHTER_WIDTHS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => setHighlighterWidth(w.value)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    highlighterWidth === w.value
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">Size</span>
              {TEXT_SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setTextSize(s.value)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    textSize === s.value ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {/* Main Canvas Workspace Container */}
      <div
        ref={containerRef}
        className="relative bg-zinc-100 border border-zinc-200/80 rounded-3xl p-6 flex items-center justify-center min-h-[580px] overflow-auto shadow-inner"
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
          className="relative select-none shadow-md rounded border border-zinc-300/80 bg-white"
          style={{
            width: pageSizeRef.current.width,
            height: pageSizeRef.current.height,
          }}
        >
          {/* Base PDF Canvas */}
          <canvas
            ref={baseCanvasRef}
            className="absolute top-0 left-0 block rounded pointer-events-none"
            style={{
              width: pageSizeRef.current.width,
              height: pageSizeRef.current.height,
            }}
          />

          {/* Interactive Annotation Overlay Canvas */}
          <canvas
            ref={overlayCanvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`absolute top-0 left-0 block rounded touch-none ${
              tool === 'text' ? 'cursor-text' : tool === 'highlighter' ? 'cursor-cell' : 'cursor-crosshair'
            }`}
            style={{
              width: pageSizeRef.current.width,
              height: pageSizeRef.current.height,
            }}
          />

          {/* Inline Text Box Editor (appears when clicking on a text note) */}
          {editingTextId && (
            (() => {
              const currentAnno = currentPageAnnotations.find((a) => a.id === editingTextId)
              if (!currentAnno || currentAnno.type !== 'text') return null
              const left = currentAnno.position.x * pageSizeRef.current.width
              const top = currentAnno.position.y * pageSizeRef.current.height
              return (
                <div
                  className="absolute z-40 bg-white border-2 border-indigo-500 rounded-xl p-2 shadow-xl"
                  style={{
                    left: Math.min(left, pageSizeRef.current.width - 240),
                    top: Math.min(top, pageSizeRef.current.height - 120),
                    minWidth: '220px',
                  }}
                >
                  <textarea
                    autoFocus
                    value={editingTextValue}
                    onChange={(e) => setEditingTextValue(e.target.value)}
                    rows={3}
                    className="w-full text-xs font-semibold text-zinc-900 outline-none resize-none bg-zinc-50 p-2 rounded-lg"
                    placeholder="Type note…"
                  />
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => handleTextCommit(editingTextId, '')}
                      className="text-[10px] text-red-500 font-bold hover:underline"
                    >
                      Delete
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingTextId(null)}
                        className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-bold rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTextCommit(editingTextId, editingTextValue)}
                        className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold rounded-md"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()
          )}
        </div>
      </div>
    </div>
  )
}
