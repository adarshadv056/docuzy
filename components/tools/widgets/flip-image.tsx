'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  Image as ImageIcon,
  Loader2,
  X,
} from 'lucide-react'

interface LoadedImage {
  file: File
  width: number
  height: number
}

interface FlipResult {
  url: string
  filename: string
  width: number
  height: number
  size: number
  mime: string
  originalSize: number
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded.'))),
      type,
      0.95
    )
  })

export default function FlipImage() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)

  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<FlipResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageElRef = useRef<HTMLImageElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)

  const hasTransform = flipH || flipV

  const clearResult = useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
    setResult(null)
  }, [])

  const loadFile = useCallback(
    async (selectedFile: File) => {
      if (!selectedFile.type.startsWith('image/')) {
        setError('That file is not an image. Choose a JPG, PNG, WebP, or another image file.')
        return
      }
      setError(null)
      clearResult()
      setPhase('idle')

      const url = URL.createObjectURL(selectedFile)
      const element = new Image()
      try {
        await new Promise<void>((resolve, reject) => {
          element.onload = () => resolve()
          element.onerror = () => reject(new Error('decode failed'))
          element.src = url
        })
      } catch {
        URL.revokeObjectURL(url)
        setError('This image could not be opened. It may be damaged or in a format the browser cannot read.')
        return
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = url
      imageElRef.current = element
      setImage({ file: selectedFile, width: element.naturalWidth, height: element.naturalHeight })
      setFlipH(false)
      setFlipV(false)
    },
    [clearResult]
  )

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [])

  useEffect(() => {
    const element = imageElRef.current
    const canvas = previewCanvasRef.current
    if (phase === 'done' || !image || !element || !canvas) return

    const width = image.width
    const height = image.height
    const scale = Math.min(1, 600 / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    canvas.width = w
    canvas.height = h
    const context = canvas.getContext('2d')
    if (!context) return

    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, w, h)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.save()
    context.translate(w / 2, h / 2)
    context.scale(flipH ? -1 : 1, flipV ? -1 : 1)
    context.drawImage(element, (-width * scale) / 2, (-height * scale) / 2, width * scale, height * scale)
    context.restore()
  }, [image, flipH, flipV, phase])

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) loadFile(selectedFile)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) loadFile(dropped)
  }

  const startOver = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    clearResult()
    imageElRef.current = null
    setImage(null)
    setFlipH(false)
    setFlipV(false)
    setPhase('idle')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const applyFlip = async () => {
    const element = imageElRef.current
    if (!image || !element) return
    setPhase('working')
    setError(null)
    clearResult()

    try {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable.')

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.save()
      context.translate(image.width / 2, image.height / 2)
      context.scale(flipH ? -1 : 1, flipV ? -1 : 1)
      context.drawImage(element, -image.width / 2, -image.height / 2, image.width, image.height)
      context.restore()

      const isPng = image.file.type === 'image/png'
      const mime = isPng ? 'image/png' : 'image/jpeg'
      const blob = await canvasToBlob(canvas, mime)
      const sourceType = blob.type || mime
      const extension = sourceType === 'image/png' ? 'png' : 'jpg'
      const base = image.file.name.replace(/\.[^/.]+$/, '') || 'image'
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url

      setResult({
        url,
        filename: `flipped-${base}.${extension}`,
        width: image.width,
        height: image.height,
        size: blob.size,
        mime: sourceType,
        originalSize: image.file.size,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not flip this image. Try a smaller file or a different format.')
      setPhase('idle')
    }
  }

  if (phase === 'done' && result) {
    return (
      <div className="bg-white border border-zinc-100 rounded-2xl p-8 shadow-sm">
        <div className="mb-6">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <Check size={22} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">Your image is ready</h3>
          <p className="text-xs text-zinc-400 mt-1">
            {result.width} × {result.height} px · {result.mime === 'image/png' ? 'PNG' : 'JPG'}
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-zinc-200 overflow-hidden flex items-center justify-center p-4 min-h-[220px] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.url} alt="Flipped result" className="max-h-[320px] max-w-full object-contain" />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Original</p>
            <p className="text-lg font-bold text-zinc-500">{formatSize(result.originalSize)}</p>
            <p className="text-[11px] text-zinc-400">
              {result.width} × {result.height} px
            </p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">New image</p>
            <p className="text-lg font-bold text-zinc-900">{formatSize(result.size)}</p>
            <p className="text-[11px] text-zinc-400">
              {result.width} × {result.height} px
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <a
            href={result.url}
            download={result.filename}
            className="w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download flipped image
          </a>
          <div className="flex gap-2">
            <button onClick={() => setPhase('idle')} className="flex-1 py-3 text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors">
              Back to editing
            </button>
            <button onClick={startOver} className="flex-1 py-3 text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors">
              Start over
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!image) {
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
          className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer group ${isDraggingFile ? 'border-indigo-400 bg-indigo-50/40' : 'border-zinc-200 hover:border-zinc-400 bg-white'}`}
        >
          <input type="file" ref={fileInputRef} onChange={handleFileSelection} accept="image/*" className="hidden" />
          <div className="space-y-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-500 group-hover:scale-110 transition-transform">
              <FlipHorizontal2 size={24} />
            </div>
            <p className="text-sm font-semibold text-zinc-900">Select an image to flip</p>
            <p className="text-xs text-zinc-400">Drag and drop it here, or click to browse — JPG, PNG, WebP</p>
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
      <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0 text-zinc-400">
            <ImageIcon size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate">{image.file.name}</p>
            <p className="text-xs text-zinc-400">
              {image.width} × {image.height} px · {formatSize(image.file.size)}
            </p>
          </div>
        </div>
        <button onClick={startOver} className="shrink-0 p-2 text-zinc-300 hover:text-red-500 transition-colors" aria-label="Remove image">
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
        <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm space-y-7 h-fit">
          <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Mirror</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFlipH((v) => !v)}
                aria-pressed={flipH}
                className={`flex items-center justify-center gap-2 py-4 rounded-xl border text-sm font-bold transition-all active:scale-[0.98] ${flipH ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg' : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-white'}`}
              >
                <FlipHorizontal2 size={18} />
                Horizontal
              </button>
              <button
                onClick={() => setFlipV((v) => !v)}
                aria-pressed={flipV}
                className={`flex items-center justify-center gap-2 py-4 rounded-xl border text-sm font-bold transition-all active:scale-[0.98] ${flipV ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg' : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-white'}`}
              >
                <FlipVertical2 size={18} />
                Vertical
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Mirroring is baked into the pixels, so the downloaded image is a new file. Flipping does not change the image size.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={applyFlip}
              disabled={phase === 'working' || !hasTransform}
              className="w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {phase === 'working' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Flipping…
                </>
              ) : (
                <>
                  <FlipHorizontal2 size={16} />
                  Flip &amp; download
                </>
              )}
            </button>
            {hasTransform && (
              <button
                onClick={() => {
                  setFlipH(false)
                  setFlipV(false)
                }}
                className="w-full text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Preview</h3>
            <span className="text-[10px] font-bold text-zinc-500 tabular-nums">
              {image.width} × {image.height} px
            </span>
          </div>

          <div className="rounded-xl border border-zinc-200 shadow-sm flex items-center justify-center p-4 min-h-[320px] bg-white">
            <canvas ref={previewCanvasRef} className="max-h-[520px] max-w-full object-contain" aria-label="Flip preview" />
          </div>

          <p className="mt-3 text-[11px] text-zinc-400 text-center">
            {hasTransform ? [flipH ? 'Flipped horizontally' : null, flipV ? 'flipped vertically' : null].filter(Boolean).join(' · ') : 'Uploaded image at its original orientation.'}
          </p>
        </div>
      </div>
    </div>
  )
}
