'use client'

import React, { useState, useRef, useMemo } from 'react'
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import {
  AlertCircle,
  Check,
  Contrast,
  Download,
  Eye,
  FlipHorizontal2,
  FlipVertical2,
  Palette,
  RefreshCw,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Upload,
  X,
} from 'lucide-react'

export type FilterPreset =
  | 'none'
  | 'vivid'
  | 'warm'
  | 'cool'
  | 'bw'
  | 'sepia'
  | 'matte'
  | 'dramatic'
  | 'invert'

export type TextPosition = 'bottom-center' | 'bottom-left' | 'top-left' | 'center'

interface ImageAdjustments {
  brightness: number // -100 to 100
  contrast: number // -100 to 100
  saturation: number // -100 to 100
  warmth: number // -100 to 100
  vibrance: number // -100 to 100
  blur: number // 0 to 20px
  preset: FilterPreset
  rotation: number // 0, 90, 180, 270
  flipH: boolean
  flipV: boolean
}

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  vibrance: 0,
  blur: 0,
  preset: 'none',
  rotation: 0,
  flipH: false,
  flipV: false,
}

const PRESET_CONFIGS: Record<
  FilterPreset,
  { name: string; description: string; previewColor: string }
> = {
  none: { name: 'Original', description: 'No color changes', previewColor: '#71717a' },
  vivid: { name: 'Vivid Pop', description: 'Punchy saturation & contrast', previewColor: '#6366f1' },
  warm: { name: 'Warm Sunset', description: 'Golden hour amber tones', previewColor: '#f59e0b' },
  cool: { name: 'Cool Slate', description: 'Cinematic teal & film cool', previewColor: '#06b6d4' },
  bw: { name: 'B&W Noir', description: 'Classic high contrast monochrome', previewColor: '#18181b' },
  sepia: { name: 'Vintage Sepia', description: 'Nostalgic warm retro paper', previewColor: '#b45309' },
  matte: { name: 'Matte Film', description: 'Lifted shadows & muted tones', previewColor: '#64748b' },
  dramatic: { name: 'Dramatic', description: 'Deep shadows & high clarity', previewColor: '#4f46e5' },
  invert: { name: 'Invert', description: 'Artistic negative inversion', previewColor: '#ec4899' },
}

export default function EditImage() {
  const [imgSrc, setImgSrc] = useState<string>('')
  const [fileName, setFileName] = useState<string>('photo.jpg')
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })
  const [originalFileSize, setOriginalFileSize] = useState<number>(0)

  // Current Adjustments
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS)

  // Active Tab
  const [activeTab, setActiveTab] = useState<'adjust' | 'filters' | 'crop' | 'text'>('adjust')

  // Crop State
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined)

  // Text Watermark / Caption State
  const [overlayText, setOverlayText] = useState<string>('')
  const [textColor, setTextColor] = useState<string>('#ffffff')
  const [textBg, setTextBg] = useState<boolean>(true)
  const [textPosition, setTextPosition] = useState<'bottom-center' | 'bottom-left' | 'top-left' | 'center'>('bottom-center')
  const [textSize, setTextSize] = useState<number>(24)

  // Comparison State (Press and hold to view original)
  const [isComparing, setIsComparing] = useState<boolean>(false)

  // Export Settings
  const [exportFormat, setExportFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg')
  const [exportQuality, setExportQuality] = useState<number>(0.92)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load selected file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setOriginalFileSize(file.size)
    setAdjustments(DEFAULT_ADJUSTMENTS)
    setCrop(undefined)
    setCompletedCrop(undefined)

    const reader = new FileReader()
    reader.onload = () => {
      setImgSrc(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    setFileName(file.name)
    setOriginalFileSize(file.size)
    setAdjustments(DEFAULT_ADJUSTMENTS)
    setCrop(undefined)
    setCompletedCrop(undefined)

    const reader = new FileReader()
    reader.onload = () => {
      setImgSrc(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Generate synthetic sample photo for instant testing
  const handleLoadSample = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, 500)
    sky.addColorStop(0, '#1e1b4b')
    sky.addColorStop(0.5, '#4338ca')
    sky.addColorStop(1, '#f97316')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, 1200, 800)

    // Sun
    ctx.fillStyle = '#fef08a'
    ctx.beginPath()
    ctx.arc(600, 420, 90, 0, Math.PI * 2)
    ctx.fill()

    // Mountain silhouettes
    ctx.fillStyle = '#311042'
    ctx.beginPath()
    ctx.moveTo(0, 800)
    ctx.lineTo(250, 420)
    ctx.lineTo(500, 580)
    ctx.lineTo(800, 360)
    ctx.lineTo(1050, 540)
    ctx.lineTo(1200, 400)
    ctx.lineTo(1200, 800)
    ctx.closePath()
    ctx.fill()

    // Foreground hills
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.moveTo(0, 800)
    ctx.lineTo(0, 650)
    ctx.bezierCurveTo(300, 600, 600, 700, 900, 620)
    ctx.bezierCurveTo(1050, 580, 1150, 660, 1200, 640)
    ctx.lineTo(1200, 800)
    ctx.closePath()
    ctx.fill()

    // Title label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.font = 'bold 28px system-ui, sans-serif'
    ctx.fillText('Docuzy Photo Studio Sample', 60, 80)
    ctx.font = '16px system-ui, sans-serif'
    ctx.fillText('1200 × 800px • Test brightness, contrast, filters, crop & export', 60, 112)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
    setImgSrc(dataUrl)
    setFileName('mountain-sunset.jpg')
    setOriginalFileSize(185000)
    setAdjustments(DEFAULT_ADJUSTMENTS)
  }

  // Record image natural dimensions on load
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight, width, height } = e.currentTarget
    setOriginalDimensions({ width: naturalWidth, height: naturalHeight })

    if (aspectRatio) {
      setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspectRatio, width, height), width, height))
    }
  }

  // Update adjustment helper
  const updateAdjustment = <K extends keyof ImageAdjustments>(key: K, value: ImageAdjustments[K]) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }))
  }

  // Rotate 90 degrees
  const handleRotateCw = () => {
    setAdjustments((prev) => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))
  }

  const handleRotateCcw = () => {
    setAdjustments((prev) => ({ ...prev, rotation: (prev.rotation + 270) % 360 }))
  }

  // Flip Horizontal / Vertical
  const handleFlipH = () => {
    setAdjustments((prev) => ({ ...prev, flipH: !prev.flipH }))
  }

  const handleFlipV = () => {
    setAdjustments((prev) => ({ ...prev, flipV: !prev.flipV }))
  }

  // Calculate live CSS filter string for instant 60fps preview
  const liveCssFilter = useMemo(() => {
    if (isComparing) return 'none'

    const { brightness, contrast, saturation, blur, preset } = adjustments

    const bVal = 100 + brightness // 0% to 200%
    const cVal = 100 + contrast // 0% to 200%
    const sVal = 100 + saturation // 0% to 200%

    let filterStr = `brightness(${bVal}%) contrast(${cVal}%) saturate(${sVal}%)`

    if (blur > 0) {
      filterStr += ` blur(${blur}px)`
    }

    switch (preset) {
      case 'vivid':
        filterStr += ' saturate(135%) contrast(115%)'
        break
      case 'warm':
        filterStr += ' sepia(25%) saturate(120%) brightness(105%)'
        break
      case 'cool':
        filterStr += ' hue-rotate(185deg) saturate(90%) contrast(105%)'
        break
      case 'bw':
        filterStr += ' grayscale(100%) contrast(125%)'
        break
      case 'sepia':
        filterStr += ' sepia(80%) saturate(110%) contrast(95%)'
        break
      case 'matte':
        filterStr += ' contrast(90%) brightness(108%) saturate(85%)'
        break
      case 'dramatic':
        filterStr += ' contrast(145%) saturate(110%) brightness(95%)'
        break
      case 'invert':
        filterStr += ' invert(100%)'
        break
      case 'none':
      default:
        break
    }

    return filterStr
  }, [adjustments, isComparing])

  // Live CSS transform string (rotation and flip)
  const liveCssTransform = useMemo(() => {
    if (isComparing) return 'none'
    const { rotation, flipH, flipV } = adjustments
    const scaleX = flipH ? -1 : 1
    const scaleY = flipV ? -1 : 1
    return `rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`
  }, [adjustments, isComparing])

  // Render & Export Full-Resolution Canvas
  const handleExport = async () => {
    if (!imgRef.current) return

    setIsExporting(true)
    setError(null)

    try {
      const sourceImg = imgRef.current
      const natW = sourceImg.naturalWidth
      const natH = sourceImg.naturalHeight

      // Target canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Could not initialize canvas.')

      const { rotation, flipH, flipV, brightness, contrast, saturation, warmth, preset } = adjustments
      const isQuarterTurn = rotation === 90 || rotation === 270

      // If cropped
      let cropX = 0
      let cropY = 0
      let cropW = natW
      let cropH = natH

      if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        const scaleX = natW / sourceImg.width
        const scaleY = natH / sourceImg.height
        cropX = completedCrop.x * scaleX
        cropY = completedCrop.y * scaleY
        cropW = completedCrop.width * scaleX
        cropH = completedCrop.height * scaleY
      }

      const outW = isQuarterTurn ? cropH : cropW
      const outH = isQuarterTurn ? cropW : cropH

      canvas.width = Math.round(outW)
      canvas.height = Math.round(outH)

      // Transform context
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)

      const drawW = isQuarterTurn ? canvas.height : canvas.width
      const drawH = isQuarterTurn ? canvas.width : canvas.height

      ctx.drawImage(sourceImg, cropX, cropY, cropW, cropH, -drawW / 2, -drawH / 2, drawW, drawH)
      ctx.restore()

      // Pixel-level adjustments
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imgData.data

      const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast))
      const bOffset = brightness * 2.55
      const sFactor = (100 + saturation) / 100
      const wFactor = warmth * 0.7

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i]
        let g = data[i + 1]
        let b = data[i + 2]

        // Brightness
        if (brightness !== 0) {
          r += bOffset
          g += bOffset
          b += bOffset
        }

        // Contrast
        if (contrast !== 0) {
          r = cFactor * (r - 128) + 128
          g = cFactor * (g - 128) + 128
          b = cFactor * (b - 128) + 128
        }

        // Saturation
        if (saturation !== 0 || preset === 'bw') {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b
          if (preset === 'bw') {
            r = gray
            g = gray
            b = gray
          } else {
            r = gray + (r - gray) * sFactor
            g = gray + (g - gray) * sFactor
            b = gray + (b - gray) * sFactor
          }
        }

        // Warmth
        if (warmth !== 0) {
          r += wFactor
          b -= wFactor
        }

        // Presets
        if (preset === 'sepia') {
          const tr = 0.393 * r + 0.769 * g + 0.189 * b
          const tg = 0.349 * r + 0.686 * g + 0.168 * b
          const tb = 0.272 * r + 0.534 * g + 0.131 * b
          r = tr
          g = tg
          b = tb
        } else if (preset === 'invert') {
          r = 255 - r
          g = 255 - g
          b = 255 - b
        } else if (preset === 'vivid') {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b
          r = gray + (r - gray) * 1.3
          g = gray + (g - gray) * 1.3
          b = gray + (b - gray) * 1.3
        } else if (preset === 'matte') {
          r = r * 0.9 + 25
          g = g * 0.9 + 25
          b = b * 0.9 + 25
        }

        data[i] = Math.max(0, Math.min(255, r))
        data[i + 1] = Math.max(0, Math.min(255, g))
        data[i + 2] = Math.max(0, Math.min(255, b))
      }

      ctx.putImageData(imgData, 0, 0)

      // Draw text overlay if provided
      if (overlayText.trim()) {
        const text = overlayText.trim()
        ctx.font = `bold ${textSize * 1.5}px system-ui, sans-serif`
        const metrics = ctx.measureText(text)
        const textW = metrics.width
        const textH = textSize * 1.5

        let x = canvas.width / 2 - textW / 2
        let y = canvas.height - 50

        if (textPosition === 'top-left') {
          x = 40
          y = textH + 40
        } else if (textPosition === 'bottom-left') {
          x = 40
          y = canvas.height - 40
        } else if (textPosition === 'center') {
          x = (canvas.width - textW) / 2
          y = (canvas.height + textH) / 2
        }

        if (textBg) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
          ctx.beginPath()
          ctx.roundRect(x - 16, y - textH, textW + 32, textH + 16, 8)
          ctx.fill()
        }

        ctx.fillStyle = textColor
        ctx.fillText(text, x, y)
      }

      // Encode and trigger download
      const ext = exportFormat === 'image/png' ? 'png' : exportFormat === 'image/webp' ? 'webp' : 'jpg'
      const baseName = fileName.replace(/\.[^/.]+$/, '')
      const finalFileName = `${baseName}_edited.${ext}`

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), exportFormat, exportQuality)
      })

      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = finalFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err: unknown) {
      console.error(err)
      setError('Failed to export edited image.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Top Action Bar */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Left Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Upload size={14} />
            <span>Open Image</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            className="px-3.5 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Load Sample Photo</span>
          </button>

          {imgSrc && (
            <button
              type="button"
              onClick={() => {
                setAdjustments(DEFAULT_ADJUSTMENTS)
                setCrop(undefined)
                setCompletedCrop(undefined)
                setOverlayText('')
              }}
              className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Reset all edits to original"
            >
              <RotateCcw size={14} />
              <span>Reset Edits</span>
            </button>
          )}

          {imgSrc && (
            <button
              type="button"
              onClick={() => {
                setImgSrc('')
                setAdjustments(DEFAULT_ADJUSTMENTS)
              }}
              className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <X size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Right Info: Image Details & Hold to Compare */}
        {imgSrc && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onMouseDown={() => setIsComparing(true)}
              onMouseUp={() => setIsComparing(false)}
              onMouseLeave={() => setIsComparing(false)}
              onTouchStart={() => setIsComparing(true)}
              onTouchEnd={() => setIsComparing(false)}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95 select-none"
              title="Hold to see original unedited photo"
            >
              <Eye size={13} />
              <span>{isComparing ? 'Showing Original…' : 'Hold to Compare'}</span>
            </button>

            <span className="text-xs text-zinc-500 font-medium bg-zinc-100 px-2.5 py-1 rounded-lg">
              {originalDimensions.width} × {originalDimensions.height} px
              {originalFileSize > 0 ? ` (${(originalFileSize / 1024).toFixed(0)} KB)` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 text-red-700 text-xs animate-in fade-in">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError(null)} className="hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Empty State / Dropzone */}
      {!imgSrc && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-200 hover:border-zinc-300 bg-white/70 hover:bg-zinc-50/50 rounded-3xl p-12 text-center transition-all cursor-pointer"
        >
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
              <SlidersHorizontal size={30} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-zinc-900">
                Drop your photo here, or browse
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Fine-tune lighting, contrast, warmth, and saturation. Apply cinematic photo filters, crop to popular aspect ratios, rotate, and annotate—100% in your browser.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                <Check size={12} className="text-emerald-500" /> Pro Light & Color Controls
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                <Check size={12} className="text-emerald-500" /> 1-Click Filters
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                <Check size={12} className="text-emerald-500" /> Lossless Canvas Export
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Studio Workspace */}
      {imgSrc && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Canvas Preview Area (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-zinc-950/95 border border-zinc-800 rounded-2xl p-6 min-h-[480px] max-h-[640px] flex items-center justify-center overflow-hidden relative shadow-lg">
              {isComparing && (
                <div className="absolute top-4 left-4 z-20 bg-black/75 text-white text-[11px] font-semibold px-3 py-1 rounded-full backdrop-blur-xs border border-white/20">
                  Original Photo
                </div>
              )}

              {/* Crop Mode vs Normal Canvas Preview */}
              {activeTab === 'crop' ? (
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={aspectRatio}
                  className="max-h-[540px] max-w-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    onLoad={onImageLoad}
                    alt="Editor Preview"
                    style={{
                      filter: liveCssFilter,
                      transform: liveCssTransform,
                      maxHeight: '520px',
                      maxWidth: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </ReactCrop>
              ) : (
                <div className="relative flex items-center justify-center max-w-full max-h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    onLoad={onImageLoad}
                    alt="Editor Preview"
                    className="rounded-lg shadow-md max-h-[520px] max-w-full object-contain select-none"
                    style={{
                      filter: liveCssFilter,
                      transform: liveCssTransform,
                    }}
                  />

                  {/* Live Text Overlay Preview */}
                  {overlayText.trim() && (
                    <div
                      className={`absolute pointer-events-none select-none px-3 py-1.5 rounded-lg text-sm font-bold ${
                        textBg ? 'bg-black/60 backdrop-blur-xs' : ''
                      }`}
                      style={{
                        color: textColor,
                        fontSize: `${textSize}px`,
                        bottom: textPosition.startsWith('bottom') ? '24px' : 'auto',
                        top: textPosition.startsWith('top') ? '24px' : 'auto',
                        left: textPosition.endsWith('left') ? '24px' : 'auto',
                        transform: textPosition === 'center' ? 'translate(-50%, -50%)' : 'none',
                      }}
                    >
                      {overlayText}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Canvas Orientation Controls Bar */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRotateCcw}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium flex items-center gap-1.5 transition-colors"
                  title="Rotate 90° Left"
                >
                  <RotateCcw size={13} />
                  <span>Left</span>
                </button>
                <button
                  type="button"
                  onClick={handleRotateCw}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium flex items-center gap-1.5 transition-colors"
                  title="Rotate 90° Right"
                >
                  <RotateCw size={13} />
                  <span>Right</span>
                </button>
                <button
                  type="button"
                  onClick={handleFlipH}
                  className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-colors ${
                    adjustments.flipH
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                  }`}
                  title="Flip Horizontal"
                >
                  <FlipHorizontal2 size={13} />
                  <span>Flip H</span>
                </button>
                <button
                  type="button"
                  onClick={handleFlipV}
                  className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-colors ${
                    adjustments.flipV
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                  }`}
                  title="Flip Vertical"
                >
                  <FlipVertical2 size={13} />
                  <span>Flip V</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 font-medium">
                  {fileName}
                </span>
              </div>
            </div>
          </div>

          {/* Right Controls Panel (4 Cols) */}
          <div className="lg:col-span-4 bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs space-y-5">
            {/* Studio Navigation Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-zinc-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('adjust')}
                className={`py-1.5 rounded-lg transition-all text-center ${
                  activeTab === 'adjust'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Adjust
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('filters')}
                className={`py-1.5 rounded-lg transition-all text-center ${
                  activeTab === 'filters'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Filters
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('crop')}
                className={`py-1.5 rounded-lg transition-all text-center ${
                  activeTab === 'crop'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Crop
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`py-1.5 rounded-lg transition-all text-center ${
                  activeTab === 'text'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Text
              </button>
            </div>

            {/* TAB 1: Adjustments (Sliders) */}
            {activeTab === 'adjust' && (
              <div className="space-y-4">
                {/* Brightness */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <Sun size={13} className="text-amber-500" />
                      <span>Brightness</span>
                    </span>
                    <span>{adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={adjustments.brightness}
                    onChange={(e) => updateAdjustment('brightness', parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <Contrast size={13} className="text-indigo-600" />
                      <span>Contrast</span>
                    </span>
                    <span>{adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={adjustments.contrast}
                    onChange={(e) => updateAdjustment('contrast', parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Saturation */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <Palette size={13} className="text-emerald-600" />
                      <span>Saturation</span>
                    </span>
                    <span>{adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={adjustments.saturation}
                    onChange={(e) => updateAdjustment('saturation', parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Warmth */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-orange-500" />
                      <span>Warmth / Tone</span>
                    </span>
                    <span>{adjustments.warmth > 0 ? `+${adjustments.warmth}` : adjustments.warmth}</span>
                  </div>
                  <input
                    type="range"
                    min="-80"
                    max="80"
                    value={adjustments.warmth}
                    onChange={(e) => updateAdjustment('warmth', parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Soft Focus / Blur */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <Eye size={13} className="text-zinc-500" />
                      <span>Soft Blur</span>
                    </span>
                    <span>{adjustments.blur} px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={adjustments.blur}
                    onChange={(e) => updateAdjustment('blur', parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: Filters & Presets */}
            {activeTab === 'filters' && (
              <div className="space-y-3">
                <p className="text-[11px] text-zinc-500">
                  Select a color grade to instantly transform mood and aesthetics:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PRESET_CONFIGS) as FilterPreset[]).map((key) => {
                    const cfg = PRESET_CONFIGS[key]
                    const isActive = adjustments.preset === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateAdjustment('preset', key)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isActive
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-2 ring-indigo-500/20'
                            : 'border-zinc-200 hover:border-zinc-300 bg-white'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full mb-2 shrink-0 border border-black/10"
                          style={{ backgroundColor: cfg.previewColor }}
                        />
                        <div>
                          <span className="block text-xs font-bold text-zinc-900 leading-tight">
                            {cfg.name}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: Crop Presets */}
            {activeTab === 'crop' && (
              <div className="space-y-3">
                <p className="text-[11px] text-zinc-500">
                  Drag the frame on the photo to adjust crop boundaries, or select an aspect ratio:
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Freeform', aspect: undefined },
                    { label: '1:1 Square (Avatar)', aspect: 1 },
                    { label: '4:3 Standard', aspect: 4 / 3 },
                    { label: '16:9 Widescreen', aspect: 16 / 9 },
                    { label: '9:16 Story / Reel', aspect: 9 / 16 },
                    { label: '3:2 Classic Photo', aspect: 3 / 2 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setAspectRatio(preset.aspect)
                        if (imgRef.current) {
                          const { width, height } = imgRef.current
                          if (preset.aspect) {
                            setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, preset.aspect, width, height), width, height))
                          } else {
                            setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 })
                          }
                        }
                      }}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                        aspectRatio === preset.aspect
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-300 text-zinc-700 bg-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {completedCrop && (
                  <button
                    type="button"
                    onClick={() => {
                      setCrop(undefined)
                      setCompletedCrop(undefined)
                      setAspectRatio(undefined)
                    }}
                    className="w-full mt-2 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-600"
                  >
                    Reset Crop Area
                  </button>
                )}
              </div>
            )}

            {/* TAB 4: Text Overlay */}
            {activeTab === 'text' && (
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700">Text Caption</label>
                  <input
                    type="text"
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                    placeholder="e.g. Vacation 2026 or Copyright"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700">Position</label>
                    <select
                      value={textPosition}
                      onChange={(e) => setTextPosition(e.target.value as TextPosition)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 text-xs text-zinc-800 bg-white"
                    >
                      <option value="bottom-center">Bottom Center</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="top-left">Top Left</option>
                      <option value="center">Center</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700">Text Size ({textSize}px)</label>
                    <input
                      type="range"
                      min="14"
                      max="48"
                      value={textSize}
                      onChange={(e) => setTextSize(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600 cursor-pointer pt-2"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={textBg}
                      onChange={(e) => setTextBg(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Dark Background Pill</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    {['#ffffff', '#000000', '#f59e0b', '#6366f1'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTextColor(c)}
                        className={`w-5 h-5 rounded-full border ${
                          textColor === c ? 'ring-2 ring-indigo-500 ring-offset-1' : 'border-black/20'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Export Settings & Download Button */}
            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-700">Export Format</span>
                <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setExportFormat('image/jpeg')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      exportFormat === 'image/jpeg' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    JPG
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('image/png')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      exportFormat === 'image/png' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('image/webp')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      exportFormat === 'image/webp' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    WebP
                  </button>
                </div>
              </div>

              {exportFormat !== 'image/png' && (
                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <span>Quality ({Math.round(exportQuality * 100)}%)</span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.0"
                    step="0.05"
                    value={exportQuality}
                    onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                    className="w-32 accent-indigo-600 cursor-pointer"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow disabled:opacity-50"
              >
                {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                <span>Save & Download Image</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
