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
  RotateCcw,
  RotateCw,
  Upload,
  X,
} from 'lucide-react'

type Background = 'white' | 'black' | 'transparent'

interface LoadedImage {
  file: File
  width: number
  height: number
}

interface RotateResult {
  url: string
  filename: string
  width: number
  height: number
  size: number
  mime: string
  transparent: boolean
  scaled: boolean
  originalWidth: number
  originalHeight: number
  originalSize: number
}

/** Largest side the browser canvas is asked to produce. */
const MAX_OUTPUT_SIDE = 8192

/** Preview is rendered at most this many device pixels per side. */
const PREVIEW_MAX_SIDE = 600

const CHECKERBOARD: React.CSSProperties = {
  backgroundImage: 'repeating-conic-gradient(#f4f4f5 0% 25%, #ffffff 0% 50%)',
  backgroundSize: '16px 16px',
}

const BACKGROUNDS: { value: Background; label: string; swatch: string }[] = [
  { value: 'white', label: 'White', swatch: '#ffffff' },
  { value: 'black', label: 'Black', swatch: '#18181b' },
  { value: 'transparent', label: 'Clear', swatch: 'transparent' },
]

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Keep an angle in (-180, 180] so quick steps never drift. */
const normalizeAngle = (angle: number) => {
  let value = angle % 360
  if (value <= -180) value += 360
  if (value > 180) value -= 360
  return value
}

/**
 * Size of the rotated image. The canvas has to grow for angles that are not
 * quarter turns, otherwise the corners of the image would be clipped.
 */
function outputSize(width: number, height: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  return {
    width: Math.max(1, Math.round(width * cos + height * sin)),
    height: Math.max(1, Math.round(width * sin + height * cos)),
  }
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded.'))),
      type,
      0.95
    )
  })

export default function RotateImage() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [background, setBackground] = useState<Background>('white')

  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<RotateResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageElRef = useRef<HTMLImageElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)

  const output = image ? outputSize(image.width, image.height, rotation) : null
  const hasTransform = rotation !== 0 || flipH || flipV

  const clearResult = useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
    setResult(null)
  }, [])

  const loadFile = useCallback(async (selectedFile: File) => {
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
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setBackground('white')
  }, [clearResult])

  // Release any object URLs when the widget unmounts.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [])

  // Live preview — same transform as the export, drawn at preview resolution.
  useEffect(() => {
    const element = imageElRef.current
    const canvas = previewCanvasRef.current
    if (phase === 'done' || !image || !element || !canvas) return

    const size = outputSize(image.width, image.height, rotation)
    const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(size.width, size.height))
    const width = Math.max(1, Math.round(size.width * scale))
    const height = Math.max(1, Math.round(size.height * scale))

    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return

    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, width, height)

    if (background !== 'transparent') {
      context.fillStyle = background === 'black' ? '#18181b' : '#ffffff'
      context.fillRect(0, 0, width, height)
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.save()
    context.translate(width / 2, height / 2)
    // Flips are applied in display space, so "horizontal" always mirrors what
    // the user sees, even after a quarter turn.
    context.scale(flipH ? -1 : 1, flipV ? -1 : 1)
    context.rotate((rotation * Math.PI) / 180)
    context.drawImage(
      element,
      (-image.width * scale) / 2,
      (-image.height * scale) / 2,
      image.width * scale,
      image.height * scale
    )
    context.restore()
  }, [image, rotation, flipH, flipV, background, phase])

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

  const rotateBy = (delta: number) => setRotation((value) => normalizeAngle(value + delta))

  const resetTransform = () => {
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
  }

  const startOver = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    clearResult()
    imageElRef.current = null
    setImage(null)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setBackground('white')
    setPhase('idle')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const applyRotation = async () => {
    const element = imageElRef.current
    if (!image || !element) return

    setPhase('working')
    setError(null)
    clearResult()

    try {
      const size = outputSize(image.width, image.height, rotation)
      const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(size.width, size.height))
      const width = Math.max(1, Math.round(size.width * scale))
      const height = Math.max(1, Math.round(size.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable.')

      if (background !== 'transparent') {
        context.fillStyle = background === 'black' ? '#18181b' : '#ffffff'
        context.fillRect(0, 0, width, height)
      }

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.save()
      context.translate(width / 2, height / 2)
      context.scale(flipH ? -1 : 1, flipV ? -1 : 1)
      context.rotate((rotation * Math.PI) / 180)
      context.drawImage(
        element,
        (-image.width * scale) / 2,
        (-image.height * scale) / 2,
        image.width * scale,
        image.height * scale
      )
      context.restore()

      // PNG is the only format that can keep a transparent background.
      const mime =
        background === 'transparent'
          ? 'image/png'
          : image.file.type === 'image/png'
            ? 'image/png'
            : 'image/jpeg'
      const blob = await canvasToBlob(canvas, mime)
      const sourceType = blob.type || mime
      const extension = sourceType === 'image/png' ? 'png' : 'jpg'
      const base = image.file.name.replace(/\.[^/.]+$/, '') || 'image'
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url

      setResult({
        url,
        filename: `rotated-${base}.${extension}`,
        width,
        height,
        size: blob.size,
        mime: sourceType,
        transparent: background === 'transparent',
        scaled: scale < 1,
        originalWidth: image.width,
        originalHeight: image.height,
        originalSize: image.file.size,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not rotate this image. Try a smaller file or a different format.')
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

        <div
          className="mb-6 rounded-xl border border-zinc-200 overflow-hidden flex items-center justify-center p-4 min-h-[220px]"
          style={result.transparent ? CHECKERBOARD : { backgroundColor: '#ffffff' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.url} alt="Rotated result" className="max-h-[320px] max-w-full object-contain" />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Original</p>
            <p className="text-lg font-bold text-zinc-500">{formatSize(result.originalSize)}</p>
            <p className="text-[11px] text-zinc-400">
              {result.originalWidth} × {result.originalHeight} px
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

        {result.scaled && (
          <p className="mb-4 text-[11px] leading-relaxed text-amber-600">
            This image was larger than the browser canvas limit, so the output was scaled to fit {MAX_OUTPUT_SIDE} px.
          </p>
        )}

        <div className="space-y-2">
          <a
            href={result.url}
            download={result.filename}
            className="w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download rotated image
          </a>
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
          className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer group ${
            isDraggingFile ? 'border-indigo-400 bg-indigo-50/40' : 'border-zinc-200 hover:border-zinc-400 bg-white'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelection}
            accept="image/*"
            className="hidden"
          />
          <div className="space-y-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-500 group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <p className="text-sm font-semibold text-zinc-900">Select an image to rotate</p>
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
      {/* File header */}
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
        <button
          onClick={startOver}
          className="shrink-0 p-2 text-zinc-300 hover:text-red-500 transition-colors"
          aria-label="Remove image"
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
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Rotation</h3>
              <span className="text-xs font-mono font-bold text-zinc-500 tabular-nums">{rotation}°</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StepButton onClick={() => rotateBy(-90)} icon={<RotateCcw size={16} />} label="90° left" />
              <StepButton onClick={() => rotateBy(90)} icon={<RotateCw size={16} />} label="90° right" />
              <StepButton onClick={() => rotateBy(180)} icon={<RotateCw size={16} />} label="180°" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                <span>Fine angle</span>
                <span className="tabular-nums">{rotation}°</span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                aria-label="Fine rotation angle"
                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Flip</h3>
            <div className="grid grid-cols-2 gap-2">
              <ToggleButton
                active={flipH}
                onClick={() => setFlipH((value) => !value)}
                icon={<FlipHorizontal2 size={16} />}
                label="Horizontal"
              />
              <ToggleButton
                active={flipV}
                onClick={() => setFlipV((value) => !value)}
                icon={<FlipVertical2 size={16} />}
                label="Vertical"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Background</h3>
            <div className="grid grid-cols-3 gap-2">
              {BACKGROUNDS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setBackground(option.value)}
                  aria-pressed={background === option.value}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                    background === option.value
                      ? 'border-zinc-900 bg-zinc-50 text-zinc-900'
                      : 'border-zinc-100 bg-white text-zinc-500 hover:border-zinc-300'
                  }`}
                >
                  <span
                    className="h-5 w-5 shrink-0 rounded-md border border-zinc-200"
                    style={
                      option.value === 'transparent'
                        ? CHECKERBOARD
                        : { backgroundColor: option.swatch }
                    }
                  />
                  {option.label}
                </button>
              ))}
            </div>
            {background === 'transparent' && (
              <p className="text-[11px] leading-relaxed text-zinc-400">
                Transparent corners download as PNG.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={applyRotation}
              disabled={phase === 'working'}
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
                  Rotate &amp; download
                </>
              )}
            </button>
            {hasTransform && (
              <button
                onClick={resetTransform}
                className="w-full text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                Reset rotation &amp; flips
              </button>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-zinc-400">
            Rotation is baked into the pixels, so the downloaded image is a new file. Your image stays on this device.
          </p>
        </div>

        {/* Preview */}
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Preview</h3>
            <span className="text-[10px] font-bold text-zinc-500 tabular-nums">
              {output?.width} × {output?.height} px
            </span>
          </div>

          <div
            className="rounded-xl border border-zinc-200 shadow-sm flex items-center justify-center p-4 min-h-[320px]"
            style={background === 'transparent' ? CHECKERBOARD : { backgroundColor: '#ffffff' }}
          >
            <canvas
              ref={previewCanvasRef}
              className="max-h-[520px] max-w-full object-contain"
              aria-label="Rotation preview"
            />
          </div>

          <p className="mt-3 text-[11px] text-zinc-400 text-center">
            {hasTransform
              ? [
                  rotation !== 0 ? `Rotated ${rotation}°` : null,
                  flipH ? 'flipped horizontally' : null,
                  flipV ? 'flipped vertically' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Uploaded image at its original orientation.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function StepButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900 active:scale-[0.98]"
    >
      {icon}
      <span className="text-xs font-bold">{label}</span>
    </button>
  )
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all active:scale-[0.98] ${
        active
          ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg'
          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-white'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
