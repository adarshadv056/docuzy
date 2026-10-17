'use client'

import React, { useState, useRef } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import { Loader2, Upload, Download, AlertTriangle } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type TierKey = 'high' | 'medium' | 'low'

/**
 * Compression tiers. `dpi` is the raster target (scale = dpi / 72, since PDF
 * user units default to 72 DPI) and `quality` is the JPEG encoding quality.
 * Tuning these is the only knob needed to change aggressiveness.
 */
const TIERS: Record<TierKey, { label: string; dpi: number; quality: number; note: string }> = {
  high: { label: 'High', dpi: 150, quality: 0.85, note: 'Best quality' },
  medium: { label: 'Medium', dpi: 110, quality: 0.7, note: 'Balanced' },
  low: { label: 'Low', dpi: 80, quality: 0.5, note: 'Smallest file' },
}

/**
 * A rasterized version only replaces the lossless one when it is at least this
 * much smaller. Text/vector PDFs grow when rasterized, so we keep them as-is.
 */
const RASTER_WIN_RATIO = 0.9

// Operator codes that paint an embedded/bitmap image onto a page.
const IMAGE_OPS = new Set<number>(
  [
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintInlineImageXObject,
    pdfjs.OPS.paintImageMaskXObject,
    pdfjs.OPS.paintImageXObjectRepeat,
  ].filter((op): op is number => typeof op === 'number')
)

type Mode = 'raster' | 'vector' | 'original'

interface CompressionResult {
  originalSize: number
  newSize: number
  savingsPercent: string
  mode: Mode
  bytes: Uint8Array | null
}

export default function CompressPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [tier, setTier] = useState<TierKey>('medium')
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<CompressionResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatSize = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2) + ' MB'

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected && selected.type === 'application/pdf') {
      setFile(selected)
      setResult(null)
      setPhase('idle')
    }
  }

  // Copy into a plain ArrayBuffer so the Blob accepts it regardless of the
  // Uint8Array's underlying buffer type.
  const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
    const copy = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(copy).set(bytes)
    return copy
  }

  const download = (buffer: ArrayBuffer, name: string) => {
    const blob = new Blob([buffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const startCompression = async () => {
    if (!file) return
    setPhase('working')
    setResult(null)
    setProgress({ done: 0, total: 0 })

    try {
      const originalSize = file.size
      const sourceBytes = new Uint8Array(await file.arrayBuffer())

      // 1. Lossless structural pass — preserves selectable text. pdf-lib only
      //    rewrites the object streams, so this never bloats JPEG-free files.
      let vectorBytes: Uint8Array | null = null
      try {
        const doc = await PDFDocument.load(sourceBytes.slice(), {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
        })
        vectorBytes = await doc.save({ useObjectStreams: true })
      } catch (err) {
        console.warn('Structural pass skipped', err)
      }

      // 2. Track the best result by SIZE as a number — never by re-reading a
      //    buffer's byteLength later, because pdfjs detaches the source buffer
      //    passed to getDocument(), which zeroes out its views.
      let mode: Mode = 'original'
      let chosenBytes: Uint8Array | null = null
      let newSize = originalSize
      if (vectorBytes && vectorBytes.byteLength < originalSize) {
        mode = 'vector'
        chosenBytes = vectorBytes
        newSize = vectorBytes.byteLength
      }

      // 3. Rasterization only helps when the PDF actually contains images.
      //    Text/vector pages grow when re-rendered, so we detect first.
      const pdf = await pdfjs.getDocument({ data: sourceBytes }).promise
      let hasImages = false
      for (let i = 1; i <= pdf.numPages && !hasImages; i++) {
        const ops = await (await pdf.getPage(i)).getOperatorList()
        hasImages = ops.fnArray.some((fn) => IMAGE_OPS.has(fn))
      }

      // 4. Rasterize (pdfjs -> white canvas -> JPEG -> pdf-lib) only when there
      //    are images, and only keep it if it clearly beats the lossless pass.
      if (hasImages) {
        const { dpi, quality } = TIERS[tier]
        const scale = dpi / 72
        const total = pdf.numPages
        setProgress({ done: 0, total })

        const out = await PDFDocument.create()
        for (let i = 1; i <= total; i++) {
          const page = await pdf.getPage(i)
          // getViewport respects the page's /Rotate, so orientation is preserved.
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.floor(viewport.width))
          canvas.height = Math.max(1, Math.floor(viewport.height))
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Canvas unavailable')

          // JPEG has no alpha channel — without a white backdrop, pages with a
          // transparent background export as solid black.
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, canvas.width, canvas.height)

          await page.render({ canvasContext: context, viewport, canvas }).promise

          const jpgBytes = await new Promise<Uint8Array>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) return reject(new Error('Could not encode page'))
                blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject)
              },
              'image/jpeg',
              quality
            )
          })

          const image = await out.embedJpg(jpgBytes)
          const pdfPage = out.addPage([canvas.width, canvas.height])
          pdfPage.drawImage(image, { x: 0, y: 0, width: canvas.width, height: canvas.height })

          // Free the raster buffer and yield so the UI stays responsive.
          canvas.width = 0
          canvas.height = 0
          setProgress({ done: i, total })
          await new Promise((r) => setTimeout(r, 0))
        }

        const rasterBytes = await out.save({ useObjectStreams: true })
        if (rasterBytes.byteLength < newSize * RASTER_WIN_RATIO) {
          mode = 'raster'
          chosenBytes = rasterBytes
          newSize = rasterBytes.byteLength
        }
      }

      setResult({
        originalSize,
        newSize,
        savingsPercent: (((originalSize - newSize) / originalSize) * 100).toFixed(1),
        mode,
        bytes: chosenBytes,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      alert('Compression failed. Try a different file.')
      setPhase('idle')
    }
  }

  return (
    <div>
      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-200 rounded-2xl p-16 text-center hover:border-zinc-400 bg-white transition-all cursor-pointer group"
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
            <p className="text-sm font-semibold text-zinc-900">Select file to compress</p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm font-bold text-zinc-900 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-zinc-400">{formatSize(file.size)}</p>
            </div>
            <button
              onClick={() => {
                setFile(null)
                setResult(null)
                setPhase('idle')
              }}
              className="text-xs font-medium text-zinc-400 hover:text-red-500 transition-colors"
            >
              Change File
            </button>
          </div>

          {/* Quality tier picker */}
          <div className="mb-6">
            <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2">Quality</div>
            <div className="flex gap-2 bg-zinc-50 p-1 rounded-xl">
              {(Object.keys(TIERS) as TierKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setTier(key)
                    setResult(null)
                    setPhase('idle')
                  }}
                  disabled={phase === 'working'}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                    tier === key ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {TIERS[key].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              {TIERS[tier].note} · {TIERS[tier].dpi} DPI
            </p>
          </div>

          <p className="mb-6 text-[11px] leading-relaxed text-zinc-400">
            Text-heavy PDFs are optimized losslessly, so their text stays selectable. Image-heavy PDFs are
            re-rendered as images at the chosen quality.
          </p>

          {phase === 'idle' && (
            <button
              onClick={startCompression}
              className="w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-200"
            >
              Compress Document
            </button>
          )}

          {phase === 'working' && (
            <div className="py-6 text-center">
              <Loader2 className="animate-spin mx-auto text-zinc-900" size={28} />
              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-zinc-400">
                {progress.total > 0 ? `Rendering page ${progress.done} of ${progress.total}` : 'Optimizing…'}
              </p>
              {progress.total > 0 && (
                <div className="mt-3 h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {phase === 'done' && result && (
            <>
              {result.mode === 'original' ? (
                <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-amber-800">
                      This file is already well optimized ({formatSize(result.originalSize)}), so nothing smaller
                      could be produced. Download your original — it is the smallest version.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">New Size</p>
                      <p className="text-lg font-bold text-zinc-900">{formatSize(result.newSize)}</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
                      -{result.savingsPercent}% Saved
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
                    {result.mode === 'raster'
                      ? 'Pages were re-rendered as images, so text is no longer selectable or searchable.'
                      : 'Optimized without re-rendering — text stays selectable and searchable.'}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() =>
                    result.mode === 'original' || !result.bytes
                      ? file.arrayBuffer().then((b) => download(b, file.name))
                      : download(toArrayBuffer(result.bytes), `docuzy-compressed-${file.name}`)
                  }
                  className="w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-200 flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  {result.mode === 'original' ? 'Download original PDF' : 'Download compressed PDF'}
                </button>
                {result.mode !== 'original' && (
                  <button
                    onClick={() => file.arrayBuffer().then((b) => download(b, file.name))}
                    className="w-full py-3 text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    Download original instead
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
