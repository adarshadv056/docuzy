'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage } from 'pdf-lib'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface RedactionBox {
  id: string
  x: number // Normalized 0..1 relative to page display width
  y: number // Normalized 0..1 relative to page display height
  width: number // Normalized 0..1
  height: number // Normalized 0..1
}

type RedactionColor = 'black' | 'white'
type SecurityMode = 'flatten' | 'overlay'

const REDACTION_LABELS = [
  { label: 'None (Solid)', value: '' },
  { label: '[REDACTED]', value: '[REDACTED]' },
  { label: 'CONFIDENTIAL', value: 'CONFIDENTIAL' },
  { label: 'EXEMPT', value: 'EXEMPT' },
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

export default function RedactPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [isLoadingPage, setIsLoadingPage] = useState(false)

  // Redaction box styling
  const [boxColor, setBoxColor] = useState<RedactionColor>('black')
  const [labelText, setLabelText] = useState('')
  const [securityMode, setSecurityMode] = useState<SecurityMode>('flatten')

  // Redactions mapped per page (1-based page index)
  const [redactions, setRedactions] = useState<Record<number, RedactionBox[]>>({})
  const [history, setHistory] = useState<Record<number, RedactionBox[][]>>({})

  // Interactive dragging
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)

  // Status & Export phase
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{
    bytes: Uint8Array
    originalSize: number
    newSize: number
    totalBoxes: number
    pagesRedacted: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pageSizeRef = useRef<{ width: number; height: number; unscaledWidth: number; unscaledHeight: number }>({
    width: 600,
    height: 800,
    unscaledWidth: 600,
    unscaledHeight: 800,
  })

  const pageCount = pdfDoc?.numPages ?? 0
  const currentPageRedactions = redactions[pageNumber] || []

  // Count total redactions across all pages
  const totalRedactionCount = Object.values(redactions).reduce((acc, boxes) => acc + boxes.length, 0)
  const pagesWithRedactions = Object.entries(redactions).filter(([, boxes]) => boxes.length > 0).length

  // Load PDF file
  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')
    setPdfDoc(null)
    setSourceBuffer(null)
    setFile(null)
    setRedactions({})
    setHistory({})
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
    setRedactions({})
    setHistory({})
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
        const targetWidth = Math.min(680, window.innerWidth - 80)
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
        console.error('Failed to render base PDF page:', err)
      } finally {
        if (!cancelled) setIsLoadingPage(false)
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, pageNumber])

  // Draw redaction boxes on overlay canvas
  useEffect(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    // Render committed redactions on this page
    currentPageRedactions.forEach((box, index) => {
      const bx = box.x * width
      const by = box.y * height
      const bw = box.width * width
      const bh = box.height * height

      ctx.save()
      if (boxColor === 'black') {
        // Redaction preview: dark translucent box with red dashed border
        ctx.fillStyle = 'rgba(24, 24, 27, 0.88)'
        ctx.fillRect(bx, by, bw, bh)
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 1.5
        ctx.strokeRect(bx, by, bw, bh)
      } else {
        // Whiteout
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
        ctx.fillRect(bx, by, bw, bh)
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 1.5
        ctx.strokeRect(bx, by, bw, bh)
      }

      // Draw label if specified
      if (labelText.trim() && bw > 30 && bh > 14) {
        ctx.fillStyle = boxColor === 'black' ? '#ffffff' : '#475569'
        const fontSize = Math.max(9, Math.min(13, Math.floor(bh * 0.45)))
        ctx.font = `700 ${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(labelText, bx + bw / 2, by + bh / 2, bw - 6)
      }

      // Box index chip indicator
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(bx + 8, by + 8, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = '700 8px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(index + 1), bx + 8, by + 8)

      ctx.restore()
    })

    // Render in-progress dragged selection
    if (isDragging && dragStart && dragCurrent) {
      const x = Math.min(dragStart.x, dragCurrent.x) * width
      const y = Math.min(dragStart.y, dragCurrent.y) * height
      const w = Math.abs(dragCurrent.x - dragStart.x) * width
      const h = Math.abs(dragCurrent.y - dragStart.y) * height

      ctx.save()
      ctx.fillStyle = 'rgba(239, 68, 68, 0.22)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.strokeRect(x, y, w, h)

      // Center tag
      if (w > 50 && h > 18) {
        ctx.fillStyle = '#ef4444'
        ctx.font = '700 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('REDACT', x + w / 2, y + h / 2)
      }
      ctx.restore()
    }
  }, [currentPageRedactions, isDragging, dragStart, dragCurrent, boxColor, labelText])

  // Drag event coordinates
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getPos(e)
    setIsDragging(true)
    setDragStart(pos)
    setDragCurrent(pos)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    setDragCurrent(getPos(e))
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    setIsDragging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (dragStart && dragCurrent) {
      const w = Math.abs(dragCurrent.x - dragStart.x)
      const h = Math.abs(dragCurrent.y - dragStart.y)

      // Minimum size threshold to prevent accidental clicks
      if (w > 0.015 && h > 0.01) {
        const newBox: RedactionBox = {
          id: `redact_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          x: Math.min(dragStart.x, dragCurrent.x),
          y: Math.min(dragStart.y, dragCurrent.y),
          width: w,
          height: h,
        }

        // Push to history for undo
        setHistory((prev) => ({
          ...prev,
          [pageNumber]: [...(prev[pageNumber] || []), currentPageRedactions],
        }))

        setRedactions((prev) => ({
          ...prev,
          [pageNumber]: [...(prev[pageNumber] || []), newBox],
        }))
      }
    }

    setDragStart(null)
    setDragCurrent(null)
  }

  const removeBox = (id: string) => {
    setHistory((prev) => ({
      ...prev,
      [pageNumber]: [...(prev[pageNumber] || []), currentPageRedactions],
    }))

    setRedactions((prev) => ({
      ...prev,
      [pageNumber]: (prev[pageNumber] || []).filter((b) => b.id !== id),
    }))
  }

  const handleUndo = () => {
    const pageHistory = history[pageNumber]
    if (!pageHistory || pageHistory.length === 0) return

    const previous = pageHistory[pageHistory.length - 1]
    const updatedHistory = pageHistory.slice(0, -1)

    setHistory((prev) => ({
      ...prev,
      [pageNumber]: updatedHistory,
    }))

    setRedactions((prev) => ({
      ...prev,
      [pageNumber]: previous,
    }))
  }

  const clearCurrentPage = () => {
    if (currentPageRedactions.length === 0) return
    setHistory((prev) => ({
      ...prev,
      [pageNumber]: [...(prev[pageNumber] || []), currentPageRedactions],
    }))
    setRedactions((prev) => ({
      ...prev,
      [pageNumber]: [],
    }))
  }

  // Execute Redaction on PDF
  const applyRedactions = async () => {
    if (!file || !sourceBuffer || totalRedactionCount === 0) return
    setPhase('working')
    setError(null)

    try {
      const pdf = await PDFDocument.load(sourceBuffer.slice(0), {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      })
      const pageCount = pdf.getPageCount()
      let pagesModified = 0

      if (securityMode === 'flatten') {
        // PERMANENT FLATTEN REDACTION:
        // Render pages with redactions burned directly into high-res canvas pixels,
        // then replace the page content so underlying text stream is completely eliminated.
        for (let i = 0; i < pageCount; i++) {
          const pageIdx = i + 1
          const boxes = redactions[pageIdx]
          if (!boxes || boxes.length === 0) continue

          const page = pdf.getPage(i)
          const box = visibleBox(page)
          const rotation = rotationOf(page)
          const size = displaySize(box, rotation)

          // Offscreen high-res render using pdfjs
          const pdfjsPage = await pdfDoc!.getPage(pageIdx)
          const scale = 2.0 // Crisp 2x retina print resolution
          const viewport = pdfjsPage.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          await pdfjsPage.render({ canvasContext: ctx, viewport, canvas }).promise

          // Burn solid redaction boxes onto the pixels
          boxes.forEach((b) => {
            const bx = b.x * canvas.width
            const by = b.y * canvas.height
            const bw = b.width * canvas.width
            const bh = b.height * canvas.height

            ctx.fillStyle = boxColor === 'black' ? '#000000' : '#ffffff'
            ctx.fillRect(bx, by, bw, bh)

            if (labelText.trim() && bw > 20 && bh > 10) {
              ctx.fillStyle = boxColor === 'black' ? '#ffffff' : '#000000'
              const fSize = Math.max(10, Math.min(24, Math.floor(bh * 0.45)))
              ctx.font = `700 ${fSize}px sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(labelText, bx + bw / 2, by + bh / 2, bw - 8)
            }
          })

          const pngDataUrl = canvas.toDataURL('image/png')
          const embeddedImage = await pdf.embedPng(pngDataUrl)

          // Create a new replacement page with no existing content streams
          const newPage = pdf.insertPage(i, [box.width, box.height])
          if (rotation !== 0) {
            newPage.setRotation(degrees(rotation))
          }

          const [originX, originY] = displayToUser(box, rotation, 0, 0)
          newPage.drawImage(embeddedImage, {
            x: originX,
            y: originY,
            width: size.width,
            height: size.height,
            rotate: degrees(rotation),
          })

          // Delete the original page holding the vulnerable text stream
          pdf.removePage(i + 1)
          pagesModified++
        }
      } else {
        // VECTOR OVERLAY REDACTION:
        // Draw solid opaque rectangles over existing content
        const font = labelText.trim() ? await pdf.embedFont(StandardFonts.HelveticaBold) : null
        const fillColor = boxColor === 'black' ? rgb(0, 0, 0) : rgb(1, 1, 1)
        const textColor = boxColor === 'black' ? rgb(1, 1, 1) : rgb(0, 0, 0)

        for (let i = 0; i < pageCount; i++) {
          const pageIdx = i + 1
          const boxes = redactions[pageIdx]
          if (!boxes || boxes.length === 0) continue

          const page = pdf.getPage(i)
          const box = visibleBox(page)
          const rotation = rotationOf(page)
          const size = displaySize(box, rotation)

          boxes.forEach((b) => {
            const xd = b.x * size.width
            const ydTop = b.y * size.height
            const bw = b.width * size.width
            const bh = b.height * size.height
            const ydBottom = size.height - (ydTop + bh)

            const [x, y] = displayToUser(box, rotation, xd, ydBottom)

            page.drawRectangle({
              x,
              y,
              width: bw,
              height: bh,
              color: fillColor,
              rotate: degrees(rotation),
            })

            if (labelText.trim() && font && bw > 25 && bh > 10) {
              const fSize = Math.max(8, Math.min(18, Math.floor(bh * 0.45)))
              const textWidth = font.widthOfTextAtSize(labelText, fSize)
              const textXd = xd + (bw - textWidth) / 2
              const textYd = ydBottom + (bh - fSize) / 2
              const [tx, ty] = displayToUser(box, rotation, textXd, textYd)

              page.drawText(labelText, {
                x: tx,
                y: ty,
                size: fSize,
                font,
                color: textColor,
                rotate: degrees(rotation),
              })
            }
          })
          pagesModified++
        }
      }

      const bytes = await pdf.save()
      setResult({
        bytes,
        originalSize: file.size,
        newSize: bytes.byteLength,
        totalBoxes: totalRedactionCount,
        pagesRedacted: pagesModified,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not apply redactions to this PDF. Please check your selections and try again.')
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `redacted-${file.name}`
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
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Redaction Complete!</h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            {result.totalBoxes} sensitive area{result.totalBoxes === 1 ? '' : 's'} permanently redacted across{' '}
            {result.pagesRedacted} page{result.pagesRedacted === 1 ? '' : 's'}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Original Size</p>
            <p className="text-base font-semibold text-zinc-600 tabular-nums">{formatSize(result.originalSize)}</p>
          </div>
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Redacted PDF</p>
            <p className="text-base font-bold text-zinc-900 tabular-nums">{formatSize(result.newSize)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={downloadResult}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download Redacted PDF
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('idle')}
              className="flex-1 py-3 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl transition-colors"
            >
              Adjust Redactions
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
              <Eraser size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">Select a PDF to redact</p>
              <p className="text-xs text-zinc-400 mt-1">Permanently hide sensitive text, numbers, and personal data</p>
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
    <div className="space-y-6">
      {/* File summary banner */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0 text-red-600">
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
        <div className="lg:col-span-5 bg-white border border-zinc-100 rounded-3xl p-6 shadow-sm space-y-6">
          {/* Status Counter */}
          <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-900">
                {totalRedactionCount} Area{totalRedactionCount === 1 ? '' : 's'} Marked
              </p>
              <p className="text-[11px] text-zinc-400">
                Across {pagesWithRedactions} page{pagesWithRedactions === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={(history[pageNumber]?.length ?? 0) === 0}
                className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Undo last redaction on this page"
              >
                <Undo2 size={16} />
              </button>
              <button
                type="button"
                onClick={clearCurrentPage}
                disabled={currentPageRedactions.length === 0}
                className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Clear all redactions on this page"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Redaction Style */}
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Redaction Style</h3>

            {/* Color */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Cover Style</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBoxColor('black')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    boxColor === 'black'
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                      : 'border-zinc-100 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  <div className="w-3.5 h-3.5 rounded bg-black border border-white/20" />
                  Blackout Box
                </button>
                <button
                  type="button"
                  onClick={() => setBoxColor('white')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    boxColor === 'white'
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                      : 'border-zinc-100 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  <div className="w-3.5 h-3.5 rounded bg-white border border-zinc-400" />
                  Whiteout Box
                </button>
              </div>
            </div>

            {/* Label */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Overlay Label</span>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {REDACTION_LABELS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setLabelText(item.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      labelText === item.value
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
                placeholder="Custom label e.g. [EXEMPT]"
                className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>

          {/* Security Mode */}
          <div className="space-y-3 pt-3 border-t border-zinc-100">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Security Guarantee</h3>

            <div className="space-y-2">
              <label
                onClick={() => setSecurityMode('flatten')}
                className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                  securityMode === 'flatten'
                    ? 'border-zinc-900 bg-zinc-50 shadow-2xs'
                    : 'border-zinc-100 hover:border-zinc-200'
                }`}
              >
                <div className="mt-0.5">
                  <ShieldCheck size={18} className="text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-zinc-900">Permanent Raster Redaction</p>
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                    Physically burns boxes into image pixels and purges the underlying text stream. Content cannot be
                    recovered by any text extractor or scraper.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setSecurityMode('overlay')}
                className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                  securityMode === 'overlay'
                    ? 'border-zinc-900 bg-zinc-50 shadow-2xs'
                    : 'border-zinc-100 hover:border-zinc-200'
                }`}
              >
                <div className="mt-0.5">
                  <EyeOff size={18} className="text-zinc-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-900">Vector Cover Boxes</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                    Draws opaque blackout rectangles in the document layer while keeping the rest of the page as
                    vector text.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Redactions list for current page */}
          {currentPageRedactions.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-zinc-100">
              <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
                Redactions on Page {pageNumber} ({currentPageRedactions.length})
              </h3>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {currentPageRedactions.map((box, idx) => (
                  <div
                    key={box.id}
                    className="flex items-center justify-between p-2 bg-zinc-50 rounded-xl border border-zinc-100 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-zinc-600 font-medium">
                        Area {Math.round(box.width * 100)}% × {Math.round(box.height * 100)}%
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBox(box.id)}
                      className="text-zinc-400 hover:text-red-600 p-1 transition-colors"
                      title="Remove this redaction"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="button"
            onClick={applyRedactions}
            disabled={phase === 'working' || totalRedactionCount === 0}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {phase === 'working' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sanitizing &amp; Redacting…
              </>
            ) : (
              <>
                <Lock size={16} />
                Permanently Apply Redactions
              </>
            )}
          </button>
        </div>

        {/* Right Column: Interactive Redaction Canvas */}
        <div className="lg:col-span-7 bg-zinc-50/70 border border-zinc-100 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eraser size={16} className="text-red-500" />
              <h3 className="text-xs font-bold text-zinc-900">Drag over sensitive text to redact</h3>
            </div>

            {/* Page pagination */}
            <div className="flex items-center gap-1.5 bg-white border border-zinc-200/80 rounded-xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ArrowLeft size={14} />
              </button>
              <span className="text-[11px] font-bold text-zinc-700 tabular-nums px-2">
                Page {pageNumber} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}
                disabled={pageNumber >= pageCount}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Interactive Document Page Container */}
          <div className="relative bg-white rounded-2xl border border-zinc-200/80 shadow-xs flex items-center justify-center p-3 min-h-[480px] overflow-auto">
            {isLoadingPage && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-30 rounded-2xl">
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-zinc-100 text-xs font-semibold text-zinc-700">
                  <Loader2 size={16} className="animate-spin text-zinc-500" />
                  Loading page {pageNumber}…
                </div>
              </div>
            )}

            <div
              className="relative select-none rounded border border-zinc-300 shadow-sm"
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

              {/* Redaction Overlay Canvas */}
              <canvas
                ref={overlayCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="absolute top-0 left-0 block rounded cursor-crosshair touch-none"
                style={{
                  width: pageSizeRef.current.width,
                  height: pageSizeRef.current.height,
                }}
              />
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
            Click and drag over names, account numbers, or clauses. The red boxes show exactly what will be permanently
            obscured.
          </p>
        </div>
      </div>
    </div>
  )
}
