'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Contrast,
  Download,
  FileText,
  Loader2,
  Pipette,
  RotateCcw,
  Sparkles,
  Sun,
  Upload,
  X,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type PresetMode = 'custom' | 'clean_scan' | 'high_contrast' | 'grayscale' | 'invert'

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

export default function ImprovePdfContrast() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Filter settings
  const [preset, setPreset] = useState<PresetMode>('clean_scan')
  const [contrast, setContrast] = useState(40) // -100 to 100
  const [brightness, setBrightness] = useState(15) // -100 to 100
  const [grayscale, setGrayscale] = useState(true)
  const [binarize, setBinarize] = useState(false)
  const [invert, setInvert] = useState(false)

  // Status & Export
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [progressMsg, setProgressMsg] = useState('')
  const [result, setResult] = useState<{
    bytes: Uint8Array
    originalSize: number
    newSize: number
    pagesCount: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageCount = pdfDoc?.numPages ?? 0

  const applyPreset = (mode: PresetMode) => {
    setPreset(mode)
    switch (mode) {
      case 'clean_scan':
        setContrast(45)
        setBrightness(20)
        setGrayscale(true)
        setBinarize(false)
        setInvert(false)
        break
      case 'high_contrast':
        setContrast(80)
        setBrightness(10)
        setGrayscale(true)
        setBinarize(false)
        setInvert(false)
        break
      case 'grayscale':
        setContrast(0)
        setBrightness(0)
        setGrayscale(true)
        setBinarize(false)
        setInvert(false)
        break
      case 'invert':
        setContrast(30)
        setBrightness(0)
        setGrayscale(true)
        setBinarize(false)
        setInvert(true)
        break
      case 'custom':
        break
    }
  }

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

    try {
      const buffer = await selectedFile.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise
      setSourceBuffer(buffer)
      setPdfDoc(doc)
      setFile(selectedFile)
    } catch (err) {
      console.error(err)
      setError('Could not open this PDF. It may be password-protected or corrupted.')
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
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Filter processing algorithm on raw pixel data
  const processCanvasPixels = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imgData.data

      // Contrast factor
      const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast))
      const bFactor = brightness * 2.55

      for (let i = 0; i < d.length; i += 4) {
        let r = d[i]
        let g = d[i + 1]
        let b = d[i + 2]

        // Grayscale conversion
        if (grayscale || binarize) {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b
          r = gray
          g = gray
          b = gray
        }

        // Apply brightness
        r += bFactor
        g += bFactor
        b += bFactor

        // Apply contrast
        r = cFactor * (r - 128) + 128
        g = cFactor * (g - 128) + 128
        b = cFactor * (b - 128) + 128

        // Binarize (pure black and white thresholding)
        if (binarize) {
          const avg = (r + g + b) / 3
          const threshold = 160
          const val = avg < threshold ? 0 : 255
          r = val
          g = val
          b = val
        }

        // Invert
        if (invert) {
          r = 255 - r
          g = 255 - g
          b = 255 - b
        }

        d[i] = Math.max(0, Math.min(255, r))
        d[i + 1] = Math.max(0, Math.min(255, g))
        d[i + 2] = Math.max(0, Math.min(255, b))
      }

      ctx.putImageData(imgData, 0, 0)
    },
    [contrast, brightness, grayscale, binarize, invert]
  )

  // Render live preview page
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false
    setIsLoadingPreview(true)

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (cancelled) return

        const unscaled = page.getViewport({ scale: 1.0 })
        const targetWidth = Math.min(620, window.innerWidth - 80)
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

        if (cancelled) return

        // Apply contrast/brightness/grayscale filters
        processCanvasPixels(canvas)

        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9))
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
  }, [pdfDoc, pageNumber, processCanvasPixels])

  // Apply Enhancements to Full Document
  const applyEnhancements = async () => {
    if (!file || !sourceBuffer || !pdfDoc) return
    setPhase('working')
    setError(null)

    try {
      const newPdf = await PDFDocument.create()
      const total = pageCount

      for (let i = 1; i <= total; i++) {
        setProgressMsg(`Enhancing page ${i} of ${total}…`)

        const page = await pdfDoc.getPage(i)
        const scale = 2.0 // 2x high-resolution crisp print quality
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport, canvas }).promise

        processCanvasPixels(canvas)

        const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92)
        const jpgBytes = await fetch(jpgDataUrl).then((r) => r.arrayBuffer())
        const embeddedJpg = await newPdf.embedJpg(jpgBytes)

        const newPage = newPdf.addPage([viewport.width / scale, viewport.height / scale])
        newPage.drawImage(embeddedJpg, {
          x: 0,
          y: 0,
          width: viewport.width / scale,
          height: viewport.height / scale,
        })
      }

      setProgressMsg('Finalizing enhanced PDF…')
      const bytes = await newPdf.save({ useObjectStreams: true })

      setResult({
        bytes,
        originalSize: file.size,
        newSize: bytes.byteLength,
        pagesCount: total,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not enhance this PDF. Please check the file and try again.')
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `enhanced-${file.name}`
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
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">PDF Colors Enhanced!</h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            Contrast boosted and background cleaned across all {result.pagesCount} pages.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Original Size</p>
            <p className="text-base font-semibold text-zinc-600 tabular-nums">{formatSize(result.originalSize)}</p>
          </div>
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Enhanced PDF</p>
            <p className="text-base font-bold text-zinc-900 tabular-nums">{formatSize(result.newSize)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={downloadResult}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download Enhanced PDF
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('idle')}
              className="flex-1 py-3 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl transition-colors"
            >
              Adjust Sliders
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
              <Pipette size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">Select a PDF to enhance contrast &amp; colors</p>
              <p className="text-xs text-zinc-400 mt-1">Whiten dirty scan backgrounds, sharpen ink, and adjust brightness</p>
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
        <div className="lg:col-span-5 bg-white border border-zinc-100 rounded-3xl p-6 shadow-sm space-y-6">
          {/* Preset Buttons */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-zinc-400 ml-1">Quick Presets</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'clean_scan', label: 'Clean Scan', desc: 'Whitens gray paper' },
                { id: 'high_contrast', label: 'High Contrast', desc: 'Boosts faint ink' },
                { id: 'grayscale', label: 'Grayscale', desc: 'Removes tint' },
                { id: 'invert', label: 'Invert Colors', desc: 'Dark / Light mode' },
              ].map(({ id, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id as PresetMode)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    preset === id
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                      : 'border-zinc-100 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  <p className="text-xs font-bold">{label}</p>
                  <p className={`text-[10px] mt-0.5 ${preset === id ? 'text-zinc-300' : 'text-zinc-400'}`}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4 pt-3 border-t border-zinc-100">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Manual Adjustments</h3>

            {/* Contrast Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-zinc-700">
                <span className="flex items-center gap-1.5">
                  <Contrast size={14} className="text-zinc-500" />
                  Contrast
                </span>
                <span className="tabular-nums">{contrast > 0 ? `+${contrast}%` : `${contrast}%`}</span>
              </div>
              <input
                type="range"
                min="-60"
                max="100"
                value={contrast}
                onChange={(e) => {
                  setContrast(Number(e.target.value))
                  setPreset('custom')
                }}
                className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
              />
            </div>

            {/* Brightness Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-zinc-700">
                <span className="flex items-center gap-1.5">
                  <Sun size={14} className="text-zinc-500" />
                  Brightness
                </span>
                <span className="tabular-nums">{brightness > 0 ? `+${brightness}%` : `${brightness}%`}</span>
              </div>
              <input
                type="range"
                min="-60"
                max="80"
                value={brightness}
                onChange={(e) => {
                  setBrightness(Number(e.target.value))
                  setPreset('custom')
                }}
                className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2.5 pt-3 border-t border-zinc-100">
            <label className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between cursor-pointer">
              <span className="text-xs font-bold text-zinc-800">Convert to Grayscale</span>
              <input
                type="checkbox"
                checked={grayscale}
                onChange={(e) => {
                  setGrayscale(e.target.checked)
                  setPreset('custom')
                }}
                className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900 cursor-pointer"
              />
            </label>

            <label className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-bold text-zinc-800">Binarize Document (Pure B&amp;W)</span>
                <p className="text-[10px] text-zinc-400">Forces paper to pure white and ink to pure black</p>
              </div>
              <input
                type="checkbox"
                checked={binarize}
                onChange={(e) => {
                  setBinarize(e.target.checked)
                  setPreset('custom')
                }}
                className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900 cursor-pointer"
              />
            </label>

            <label className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between cursor-pointer">
              <span className="text-xs font-bold text-zinc-800">Invert Colors (Dark/Light)</span>
              <input
                type="checkbox"
                checked={invert}
                onChange={(e) => {
                  setInvert(e.target.checked)
                  setPreset('custom')
                }}
                className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900 cursor-pointer"
              />
            </label>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={applyEnhancements}
            disabled={phase === 'working'}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {phase === 'working' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {progressMsg || 'Processing…'}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Apply to All {pageCount} Pages
              </>
            )}
          </button>
        </div>

        {/* Right Column: Live Preview */}
        <div className="lg:col-span-7 bg-zinc-50/70 border border-zinc-100 rounded-3xl p-6 lg:sticky lg:top-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Live Enhanced Preview</h3>

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

          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs flex items-center justify-center p-3 min-h-[420px] overflow-hidden">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`Page ${pageNumber} enhanced preview`}
                className="max-h-[520px] max-w-full object-contain rounded shadow-2xs"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <Loader2 size={24} className="animate-spin text-zinc-400" />
                <span className="text-xs">Applying contrast enhancements…</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
            Live preview reflects real-time adjustments to contrast, brightness, and ink clarity.
          </p>
        </div>
      </div>
    </div>
  )
}
