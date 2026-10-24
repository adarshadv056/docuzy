'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Combine,
  Download,
  FileText,
  Layers,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type FlattenMode = 'forms' | 'raster'
type Scope = 'all' | 'range'

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

export default function FlattenPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Document details
  const [detectedFormFieldsCount, setDetectedFormFieldsCount] = useState<number | null>(null)

  // Flatten options
  const [mode, setMode] = useState<FlattenMode>('forms')
  const [scope, setScope] = useState<Scope>('all')
  const [fromPage, setFromPage] = useState(1)
  const [toPage, setToPage] = useState(1)

  // Status & Progress
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [progressMsg, setProgressMsg] = useState('')
  const [result, setResult] = useState<{
    bytes: Uint8Array
    originalSize: number
    newSize: number
    modeUsed: FlattenMode
    fieldsFlattened: number
    pagesCount: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageCount = pdfDoc?.numPages ?? 0

  const affectedFrom = scope === 'all' ? 1 : Math.min(fromPage, toPage)
  const affectedTo = scope === 'all' ? pageCount : Math.max(fromPage, toPage)
  const affectedPagesCount = Math.max(0, Math.min(affectedTo, pageCount) - Math.max(1, affectedFrom) + 1)
  const hasValidRange = affectedPagesCount > 0

  // Load PDF file
  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')
    setPdfDoc(null)
    setSourceBuffer(null)
    setFile(null)
    setPreviewUrl(null)
    setPageNumber(1)
    setDetectedFormFieldsCount(null)

    try {
      const buffer = await selectedFile.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise
      setSourceBuffer(buffer)
      setPdfDoc(doc)
      setFromPage(1)
      setToPage(doc.numPages)
      setFile(selectedFile)

      // Detect AcroForm interactive form fields using pdf-lib
      try {
        const testPdf = await PDFDocument.load(buffer.slice(0), {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
        })
        const form = testPdf.getForm()
        const fields = form.getFields()
        setDetectedFormFieldsCount(fields.length)
        // If no form fields detected, default to raster mode for full flattening
        if (fields.length === 0) {
          setMode('raster')
        } else {
          setMode('forms')
        }
      } catch {
        setDetectedFormFieldsCount(0)
      }
    } catch (err) {
      console.error(err)
      setError('This PDF could not be opened. It may be password protected or corrupted.')
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
    setPhase('idle')
    setResult(null)
    setError(null)
    setScope('all')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Render preview page using pdfjs
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false
    setIsLoadingPreview(true)

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (cancelled) return

        const unscaled = page.getViewport({ scale: 1.0 })
        const targetWidth = Math.min(560, window.innerWidth - 80)
        const scale = targetWidth / unscaled.width
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport, canvas }).promise

        if (!cancelled) {
          setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9))
        }
      } catch (err) {
        console.error('Failed to render preview page:', err)
      } finally {
        if (!cancelled) setIsLoadingPreview(false)
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, pageNumber])

  // Execute Flattening
  const applyFlatten = async () => {
    if (!file || !sourceBuffer) return
    setPhase('working')
    setError(null)

    try {
      if (mode === 'forms') {
        setProgressMsg('Merging form fields into document canvas…')
        const pdf = await PDFDocument.load(sourceBuffer.slice(0), {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
        })

        const form = pdf.getForm()
        const initialFieldCount = form.getFields().length
        form.flatten()

        const bytes = await pdf.save()
        setResult({
          bytes,
          originalSize: file.size,
          newSize: bytes.byteLength,
          modeUsed: 'forms',
          fieldsFlattened: initialFieldCount,
          pagesCount: pdf.getPageCount(),
        })
      } else {
        // Full Document Raster Flattening
        setProgressMsg('Preparing high-resolution page rasterization…')
        const newPdf = await PDFDocument.create()
        const total = pageCount

        for (let i = 1; i <= total; i++) {
          setProgressMsg(`Rasterizing and locking page ${i} of ${total}…`)

          if (scope === 'range' && (i < affectedFrom || i > affectedTo)) {
            // Copy original page untouched for unselected range
            const tempDoc = await PDFDocument.load(sourceBuffer.slice(0), {
              ignoreEncryption: true,
              throwOnInvalidObject: false,
            })
            const [copiedPage] = await newPdf.copyPages(tempDoc, [i - 1])
            newPdf.addPage(copiedPage)
            continue
          }

          const page = await pdfDoc!.getPage(i)
          const scale = 2.0 // 2x high-resolution print sharpness
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          await page.render({ canvasContext: ctx, viewport, canvas }).promise

          const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92)
          const jpgBytes = await fetch(jpgDataUrl).then((r) => r.arrayBuffer())
          const embeddedJpg = await newPdf.embedJpg(jpgBytes)

          // Add clean page with matching point dimensions
          const newPage = newPdf.addPage([viewport.width / scale, viewport.height / scale])
          newPage.drawImage(embeddedJpg, {
            x: 0,
            y: 0,
            width: viewport.width / scale,
            height: viewport.height / scale,
          })
        }

        setProgressMsg('Optimizing and finalizing flattened PDF…')
        const bytes = await newPdf.save({ useObjectStreams: true })

        setResult({
          bytes,
          originalSize: file.size,
          newSize: bytes.byteLength,
          modeUsed: 'raster',
          fieldsFlattened: detectedFormFieldsCount || 0,
          pagesCount: affectedPagesCount,
        })
      }

      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not flatten this PDF. Please check the document and try again.')
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flattened-${file.name}`
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
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">PDF Successfully Flattened!</h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            {result.modeUsed === 'forms'
              ? `All ${result.fieldsFlattened} interactive form fields and layers were merged into permanent page content.`
              : `All ${result.pagesCount} pages were rasterized into clean, non-editable sheets.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Original Size</p>
            <p className="text-base font-semibold text-zinc-600 tabular-nums">{formatSize(result.originalSize)}</p>
          </div>
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Flattened PDF</p>
            <p className="text-base font-bold text-zinc-900 tabular-nums">{formatSize(result.newSize)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={downloadResult}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download Flattened PDF
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
              <Combine size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">Select a PDF to flatten</p>
              <p className="text-xs text-zinc-400 mt-1">
                Merge fillable form fields, checkboxes, and layers into permanent content
              </p>
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
        <div className="lg:col-span-7 bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-6">
          {/* Document Form Detection Card */}
          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  (detectedFormFieldsCount ?? 0) > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-zinc-200 text-zinc-600'
                }`}
              >
                {(detectedFormFieldsCount ?? 0) > 0 ? <CheckCircle2 size={18} /> : <Layers size={18} />}
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-900">
                  {(detectedFormFieldsCount ?? 0) > 0
                    ? `${detectedFormFieldsCount} Interactive Form Field${detectedFormFieldsCount === 1 ? '' : 's'} Detected`
                    : 'Standard PDF (No Interactive Forms)'}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {(detectedFormFieldsCount ?? 0) > 0
                    ? 'Text boxes, checkboxes, or signature fields found.'
                    : 'Use Full Raster Flattening to lock layers and guarantee universal printing.'}
                </p>
              </div>
            </div>
          </div>

          {/* Flattening Mode Options */}
          <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Flattening Method</h3>

            <div className="space-y-3">
              <label
                onClick={() => setMode('forms')}
                className={`p-4 rounded-2xl border flex items-start gap-3.5 cursor-pointer transition-all ${
                  mode === 'forms' ? 'border-zinc-900 bg-zinc-50 shadow-2xs' : 'border-zinc-100 hover:border-zinc-200'
                }`}
              >
                <div className="mt-0.5">
                  <ShieldCheck size={20} className={mode === 'forms' ? 'text-zinc-900' : 'text-zinc-400'} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-zinc-900">Flatten Form Fields &amp; Layers</p>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                      Lossless Vector
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Merges form fields, checkboxes, and entries directly into page content. Text stays 100% crisp,
                    selectable, and lightweight, but can no longer be edited in form readers.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setMode('raster')}
                className={`p-4 rounded-2xl border flex items-start gap-3.5 cursor-pointer transition-all ${
                  mode === 'raster' ? 'border-zinc-900 bg-zinc-50 shadow-2xs' : 'border-zinc-100 hover:border-zinc-200'
                }`}
              >
                <div className="mt-0.5">
                  <Lock size={20} className={mode === 'raster' ? 'text-zinc-900' : 'text-zinc-400'} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-zinc-900">Complete Document Rasterization</p>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md">
                      Maximum Security
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Converts every page into a high-resolution flat image (2x retina). Permanently locks the document
                    against all tampering and ensures 100% identical appearance across every printer and viewer.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Page Scope Selection (applicable for raster mode) */}
          {mode === 'raster' && (
            <div className="space-y-3 pt-3 border-t border-zinc-100">
              <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Page Scope</h3>

              <div className="flex gap-2 bg-zinc-50 p-1 rounded-2xl border border-zinc-100">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    scope === 'all' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  All Pages ({pageCount})
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
                    <label htmlFor="flat-from" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                      From Page
                    </label>
                    <input
                      id="flat-from"
                      type="number"
                      min={1}
                      max={pageCount}
                      value={fromPage}
                      onChange={(e) => setFromPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))}
                      className="w-full p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl font-mono text-xs font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="flat-to" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                      To Page
                    </label>
                    <input
                      id="flat-to"
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

              <p className="text-[11px] text-zinc-400">
                {hasValidRange
                  ? `${affectedPagesCount} of ${pageCount} pages will be flattened.`
                  : 'Selected range has no applicable pages in this document.'}
              </p>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="button"
            onClick={applyFlatten}
            disabled={phase === 'working' || (mode === 'raster' && !hasValidRange)}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {phase === 'working' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {progressMsg || 'Flattening PDF…'}
              </>
            ) : (
              <>
                <Combine size={16} />
                Flatten PDF Now
              </>
            )}
          </button>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 bg-zinc-50/70 border border-zinc-100 rounded-3xl p-6 lg:sticky lg:top-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Document Preview</h3>

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

          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs flex items-center justify-center p-3 min-h-[380px] overflow-hidden">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`Page ${pageNumber} preview`}
                className="max-h-[500px] max-w-full object-contain rounded shadow-2xs"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <Loader2 size={24} className="animate-spin text-zinc-400" />
                <span className="text-xs">Rendering preview…</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
            Flattening merges all interactive form entries, signatures, and annotations into the page so they cannot be
            altered.
          </p>
        </div>
      </div>
    </div>
  )
}
