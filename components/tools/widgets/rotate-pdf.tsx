'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument, degrees } from 'pdf-lib'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  RotateCw,
  Upload,
  X,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type Direction = 'right' | 'left' | 'flip'

/**
 * Rotation applied to the affected pages. `delta` is added to whatever
 * rotation a page already has, so an already-rotated page keeps its
 * orientation instead of being flattened.
 */
const DIRECTIONS: Record<Direction, { label: string; hint: string; phrase: string; delta: number }> = {
  right: { label: 'Rotate right', hint: '90°', phrase: 'right', delta: 90 },
  left: { label: 'Rotate left', hint: '90°', phrase: 'left', delta: 270 },
  flip: { label: 'Flip', hint: '180°', phrase: '180°', delta: 180 },
}

/** Rendered preview width in device pixels. */
const PREVIEW_WIDTH = 520

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

export default function RotatePdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [direction, setDirection] = useState<Direction>('right')
  const [scope, setScope] = useState<'all' | 'range'>('all')
  const [fromPage, setFromPage] = useState(1)
  const [toPage, setToPage] = useState(1)
  const [previewPage, setPreviewPage] = useState(1)
  const [thumb, setThumb] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{ bytes: Uint8Array; originalSize: number; newSize: number; rotated: number } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pageCount = pdfDoc?.numPages ?? 0

  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')
    setThumb(null)
    setPdfDoc(null)
    setSourceBuffer(null)
    setFile(null)

    try {
      // The original bytes are kept for pdf-lib; pdfjs detaches whatever
      // buffer it is given, so it always receives a copy.
      const buffer = await selectedFile.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise
      setSourceBuffer(buffer)
      setPdfDoc(doc)
      setFromPage(1)
      setToPage(doc.numPages)
      setPreviewPage(1)
      setFile(selectedFile)
    } catch (err) {
      console.error(err)
      setError(
        'This PDF could not be opened. It may be password protected or damaged — try unlocking it first.'
      )
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
    setFile(null)
    setSourceBuffer(null)
    setPdfDoc(null)
    setThumb(null)
    setResult(null)
    setPhase('idle')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Pages that will be rotated with the current scope.
  const affectedFrom = scope === 'all' ? 1 : Math.min(fromPage, toPage)
  const affectedTo = scope === 'all' ? pageCount : Math.max(fromPage, toPage)
  const affectedCount = Math.max(0, Math.min(affectedTo, pageCount) - Math.max(1, affectedFrom) + 1)
  const hasValidRange = affectedCount > 0

  // Preview: draw the selected page with the rotation it will end up with.
  useEffect(() => {
    if (!pdfDoc || !file) return
    let cancelled = false

    const draw = async () => {
      try {
        const page = await pdfDoc.getPage(previewPage)
        if (cancelled) return

        const inScope = previewPage >= affectedFrom && previewPage <= affectedTo
        const delta = inScope ? DIRECTIONS[direction].delta : 0
        // pdfjs replaces the page rotation instead of adding to it, so the
        // chosen rotation is applied on top of the page's own /Rotate.
        const targetRotation = ((((page.rotate || 0) + delta) % 360) + 360) % 360

        const unscaled = page.getViewport({ scale: 1, rotation: targetRotation })
        const scale = PREVIEW_WIDTH / Math.max(1, unscaled.width)
        const viewport = page.getViewport({ scale, rotation: targetRotation })

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const context = canvas.getContext('2d')
        if (!context) return

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({ canvasContext: context, viewport, canvas }).promise
        if (cancelled) return

        setThumb(canvas.toDataURL('image/jpeg', 0.86))
      } catch (err) {
        console.warn('Preview failed', err)
      }
    }

    draw()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, file, previewPage, direction, affectedFrom, affectedTo])

  const applyRotation = async () => {
    if (!file || !sourceBuffer || !hasValidRange) return
    setPhase('working')
    setError(null)

    try {
      const source = await PDFDocument.load(sourceBuffer.slice(0), {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      })
      const output = await PDFDocument.create()

      // Every page is kept — only the pages inside the range are turned.
      const allIndices = Array.from({ length: source.getPageCount() }, (_, index) => index)
      const copied = await output.copyPages(source, allIndices)

      let rotated = 0
      copied.forEach((page, index) => {
        const pageNumber = index + 1
        const affected = pageNumber >= affectedFrom && pageNumber <= affectedTo
        const base = source.getPage(index).getRotation().angle

        if (affected) {
          // Rotation is added to the page's existing /Rotate, never overwrites it.
          page.setRotation(degrees((base + DIRECTIONS[direction].delta) % 360))
          rotated += 1
        } else if (base !== 0) {
          // Preserve the original orientation of untouched pages.
          page.setRotation(degrees(base))
        }

        output.addPage(page)
      })

      const bytes = await output.save()
      setResult({
        bytes,
        originalSize: file.size,
        newSize: bytes.byteLength,
        rotated,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not rotate the PDF. Try a different file.')
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rotated-${file.name}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (phase === 'done' && result) {
    return (
      <div className="bg-white border border-zinc-100 rounded-2xl p-8 shadow-sm">
        <div className="mb-6">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <RotateCw size={22} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">Your PDF is rotated</h3>
          <p className="text-xs text-zinc-400 mt-1">
            {result.rotated} page{result.rotated === 1 ? '' : 's'} rotated {DIRECTIONS[direction].phrase}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Original</p>
            <p className="text-lg font-bold text-zinc-500">{formatSize(result.originalSize)}</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">New file</p>
            <p className="text-lg font-bold text-zinc-900">{formatSize(result.newSize)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={downloadResult}
            className="w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download rotated PDF
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setPhase('idle')}
              className="flex-1 py-3 text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Back to editing
            </button>
            <button
              onClick={startOver}
              className="flex-1 py-3 text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    )
  }

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
          className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer group ${
            isDraggingFile ? 'border-indigo-400 bg-indigo-50/40' : 'border-zinc-200 hover:border-zinc-400 bg-white'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelection}
            accept="application/pdf"
            className="hidden"
          />
          <div className="space-y-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-500 group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <p className="text-sm font-semibold text-zinc-900">Select a PDF to rotate</p>
            <p className="text-xs text-zinc-400">Drag and drop it here, or click to browse</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* File header */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0 text-zinc-400">
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
          className="shrink-0 p-2 text-zinc-300 hover:text-red-500 transition-colors"
          aria-label="Remove file"
        >
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm space-y-7 h-fit">
          <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Rotation</h3>
            <div className="grid grid-cols-3 gap-2">
              <DirectionButton
                active={direction === 'right'}
                onClick={() => setDirection('right')}
                icon={<RotateCw size={16} />}
                label={DIRECTIONS.right.label}
                hint={DIRECTIONS.right.hint}
              />
              <DirectionButton
                active={direction === 'left'}
                onClick={() => setDirection('left')}
                icon={<RotateCcw size={16} />}
                label={DIRECTIONS.left.label}
                hint={DIRECTIONS.left.hint}
              />
              <DirectionButton
                active={direction === 'flip'}
                onClick={() => setDirection('flip')}
                icon={<ArrowLeft size={16} />}
                label={DIRECTIONS.flip.label}
                hint={DIRECTIONS.flip.hint}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Pages</h3>
            <div className="flex gap-2 bg-zinc-50 p-1 rounded-xl">
              <button
                onClick={() => setScope('all')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                  scope === 'all' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                All pages
              </button>
              <button
                onClick={() => setScope('range')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                  scope === 'range' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Page range
              </button>
            </div>

            {scope === 'range' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">From</label>
                  <input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={fromPage}
                    onChange={(e) =>
                      setFromPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))
                    }
                    className="w-full p-3 bg-zinc-50 border-none rounded-xl font-mono font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">To</label>
                  <input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={toPage}
                    onChange={(e) =>
                      setToPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))
                    }
                    className="w-full p-3 bg-zinc-50 border-none rounded-xl font-mono font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                  />
                </div>
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-zinc-400">
              {hasValidRange
                ? `${affectedCount} of ${pageCount} page${pageCount === 1 ? '' : 's'} will be rotated.`
                : 'That range has no pages in this document.'}
            </p>
          </div>

          <button
            onClick={applyRotation}
            disabled={phase === 'working' || !hasValidRange}
            className="w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {phase === 'working' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Rotating…
              </>
            ) : (
              <>
                <RotateCw size={16} />
                Rotate PDF
              </>
            )}
          </button>

          <p className="text-[11px] leading-relaxed text-zinc-400">
            Pages are turned without re-rendering, so text stays sharp and selectable.
          </p>
        </div>

        {/* Preview */}
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Preview</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                disabled={previewPage <= 1}
                className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ArrowLeft size={14} />
              </button>
              <span className="text-[10px] font-bold text-zinc-500 tabular-nums">
                {previewPage} / {pageCount}
              </span>
              <button
                onClick={() => setPreviewPage((p) => Math.min(pageCount, p + 1))}
                disabled={previewPage >= pageCount}
                className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm flex items-center justify-center p-4 min-h-[320px]">
            {thumb ? (
              <img src={thumb} alt={`Page ${previewPage} preview`} className="max-h-[420px] max-w-full object-contain" />
            ) : (
              <Loader2 size={20} className="animate-spin text-zinc-300" />
            )}
          </div>

          {scope === 'range' && (
            <p className="mt-3 text-[11px] text-zinc-400 text-center">
              {previewPage >= affectedFrom && previewPage <= affectedTo
                ? 'This page is rotated in the output.'
                : 'This page stays as it is.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function DirectionButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  hint: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border transition-all ${
        active
          ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg'
          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-white'
      }`}
    >
      {icon}
      <span className="text-xs font-bold">{label}</span>
      <span className={`text-[10px] font-bold ${active ? 'text-zinc-400' : 'text-zinc-400'}`}>{hint}</span>
    </button>
  )
}
