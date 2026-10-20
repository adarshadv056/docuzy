'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument, type PDFPage } from 'pdf-lib'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  Upload,
  X,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type Axis = 'horizontal' | 'vertical'

/**
 * A mirror cannot be expressed with /Rotate — it needs a transformation
 * matrix. The page content is wrapped in `q … cm … Q` so the whole page is
 * reflected without touching text or vector quality.
 */
const AXES: Record<Axis, { label: string; hint: string; icon: React.ReactNode }> = {
  horizontal: {
    label: 'Flip horizontally',
    hint: 'Mirror left ↔ right',
    icon: <FlipHorizontal2 size={16} />,
  },
  vertical: {
    label: 'Flip vertically',
    hint: 'Mirror top ↕ bottom',
    icon: <FlipVertical2 size={16} />,
  },
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

/** Round to 3 decimals so the matrix stays readable in the content stream. */
const fmt = (value: number) => Number(value.toFixed(3)).toString()

/**
 * Mirror a single page by wrapping its content stream in a transformation
 * matrix. The matrix reflects the page across the centre of its crop box.
 */
function mirrorPage(page: PDFPage, axis: Axis): void {
  const context = page.doc.context
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  // When the page carries a 90°/270° rotation the reader's axes are
  // swapped, so a left-right mirror becomes a top-bottom mirror in page
  // space (and the other way round).
  const quarterTurn = rotation === 90 || rotation === 270
  const mirrorAcrossVerticalAxis = (axis === 'horizontal') !== quarterTurn

  const box = page.getCropBox()
  const left = box.x
  const right = box.x + box.width
  const bottom = box.y
  const top = box.y + box.height

  // Reflect across the vertical centre line (x' = left + right - x) or the
  // horizontal centre line (y' = bottom + top - y).
  const matrix = mirrorAcrossVerticalAxis
    ? `-1 0 0 1 ${fmt(left + right)} 0`
    : `1 0 0 -1 0 ${fmt(bottom + top)}`

  const start = context.register(context.flateStream(`q\n${matrix} cm\n`))
  const end = context.register(context.flateStream('Q\n'))
  page.node.wrapContentStreams(start, end)
}

/**
 * Build the mirrored document: every page is kept, only the pages inside the
 * range are mirrored.
 */
async function buildMirrored(
  sourceBytes: ArrayBuffer,
  axis: Axis,
  fromPage: number,
  toPage: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(sourceBytes.slice(0), {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  })

  doc.getPages().forEach((page, index) => {
    const pageNumber = index + 1
    if (pageNumber < fromPage || pageNumber > toPage) return
    mirrorPage(page, axis)
  })

  return doc.save()
}

export default function FlipPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [axis, setAxis] = useState<Axis>('horizontal')
  const [scope, setScope] = useState<'all' | 'range'>('all')
  const [fromPage, setFromPage] = useState(1)
  const [toPage, setToPage] = useState(1)
  const [previewPage, setPreviewPage] = useState(1)
  const [mirrored, setMirrored] = useState<{ bytes: Uint8Array; key: string } | null>(null)
  const [thumb, setThumb] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{ bytes: Uint8Array; originalSize: number; newSize: number; flipped: number } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')
    setThumb(null)
    setMirrored(null)
    setPageCount(0)
    setFile(null)

    try {
      const buffer = await selectedFile.arrayBuffer()
      // pdfjs detaches the buffer it is given, so it always gets a copy and
      // the original bytes stay intact for pdf-lib.
      const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise
      setSourceBuffer(buffer)
      setPageCount(doc.numPages)
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
    setMirrored(null)
    setThumb(null)
    setResult(null)
    setPhase('idle')
    setError(null)
    setPageCount(0)
  }

  const affectedFrom = scope === 'all' ? 1 : Math.min(fromPage, toPage)
  const affectedTo = scope === 'all' ? pageCount : Math.max(fromPage, toPage)
  const affectedCount = Math.max(0, Math.min(affectedTo, pageCount) - Math.max(1, affectedFrom) + 1)
  const hasValidRange = affectedCount > 0

  // The mirrored document is rebuilt whenever the direction or range changes.
  // `settingsKey` identifies the build, so a stale document can be detected
  // without extra state.
  const settingsKey = `${axis}|${affectedFrom}|${affectedTo}`
  const isBuilding = Boolean(file) && mirrored?.key !== settingsKey
  const currentBytes = mirrored?.key === settingsKey ? mirrored.bytes : null

  useEffect(() => {
    if (!sourceBuffer || !file) return
    let cancelled = false

    buildMirrored(sourceBuffer, axis, affectedFrom, affectedTo)
      .then((bytes) => {
        if (cancelled) return
        setMirrored({ bytes, key: settingsKey })
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setError('Could not mirror the pages of this PDF. Try a different file.')
      })

    return () => {
      cancelled = true
    }
  }, [sourceBuffer, file, axis, affectedFrom, affectedTo, settingsKey])

  // Preview is rendered from the mirrored document, so it always matches the
  // file the user downloads.
  useEffect(() => {
    if (!currentBytes) return
    let cancelled = false

    const draw = async () => {
      try {
        const doc = await pdfjs.getDocument({ data: currentBytes.slice(0) }).promise
        const page = await doc.getPage(previewPage)
        if (cancelled) return

        const unscaled = page.getViewport({ scale: 1 })
        const scale = PREVIEW_WIDTH / Math.max(1, unscaled.width)
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

        setThumb(canvas.toDataURL('image/jpeg', 0.86))
      } catch (err) {
        console.warn('Preview failed', err)
      }
    }

    draw()
    return () => {
      cancelled = true
    }
  }, [currentBytes, previewPage])

  const applyFlip = async () => {
    if (!file || !currentBytes || !hasValidRange) return
    setPhase('working')
    setError(null)

    try {
      setResult({
        bytes: currentBytes,
        originalSize: file.size,
        newSize: currentBytes.byteLength,
        flipped: affectedCount,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not build the flipped PDF. Try a different file.')
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flipped-${file.name}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const axisLabel = useMemo(() => AXES[axis].hint, [axis])

  if (phase === 'done' && result) {
    return (
      <div className="bg-white border border-zinc-100 rounded-2xl p-8 shadow-sm">
        <div className="mb-6">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            {AXES[axis].icon}
          </div>
          <h3 className="text-lg font-bold text-zinc-900">Your PDF is flipped</h3>
          <p className="text-xs text-zinc-400 mt-1">
            {result.flipped} page{result.flipped === 1 ? '' : 's'} flipped · {axisLabel.toLowerCase()}
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
            Download flipped PDF
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
          onClick={() => document.getElementById('flip-pdf-input')?.click()}
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
            id="flip-pdf-input"
            type="file"
            onChange={handleFileSelection}
            accept="application/pdf"
            className="hidden"
          />
          <div className="space-y-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-500 group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <p className="text-sm font-semibold text-zinc-900">Select a PDF to flip</p>
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
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Direction</h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(AXES) as Axis[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setAxis(key)}
                  className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border transition-all ${
                    axis === key
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-white'
                  }`}
                >
                  {AXES[key].icon}
                  <span className="text-xs font-bold">{AXES[key].label}</span>
                  <span className="text-[10px] font-bold text-zinc-400">{AXES[key].hint}</span>
                </button>
              ))}
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
                ? `${affectedCount} of ${pageCount} page${pageCount === 1 ? '' : 's'} will be flipped.`
                : 'That range has no pages in this document.'}
            </p>
          </div>

          <button
            onClick={applyFlip}
            disabled={phase === 'working' || !hasValidRange || isBuilding || !currentBytes}
            className="w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {phase === 'working' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Flipping…
              </>
            ) : (
              <>
                {AXES[axis].icon}
                Flip PDF
              </>
            )}
          </button>

          <p className="text-[11px] leading-relaxed text-zinc-400">
            Page content is mirrored, so text and vectors stay sharp and selectable. Annotations and form
            fields are left unchanged.
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
            {thumb && !isBuilding ? (
              <img src={thumb} alt={`Page ${previewPage} preview`} className="max-h-[420px] max-w-full object-contain" />
            ) : (
              <Loader2 size={20} className="animate-spin text-zinc-300" />
            )}
          </div>

          {scope === 'range' && (
            <p className="mt-3 text-[11px] text-zinc-400 text-center">
              {previewPage >= affectedFrom && previewPage <= affectedTo
                ? 'This page is flipped in the output.'
                : 'This page stays as it is.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
