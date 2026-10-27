'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Download, Loader2, Upload, X } from 'lucide-react'

type TargetFormat = 'jpeg' | 'png' | 'webp' | 'bmp'

interface FormatOption {
  id: TargetFormat
  label: string
  mime: string
  ext: string
  description: string
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'jpeg', label: 'JPG', mime: 'image/jpeg', ext: 'jpg', description: 'Best for photos & small file size' },
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', description: 'Lossless quality & transparent background' },
  { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp', description: 'Modern high-efficiency web format' },
  { id: 'bmp', label: 'BMP', mime: 'image/bmp', ext: 'bmp', description: 'Uncompressed standard bitmap' },
]

export default function ImageConverter() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [targetFormat, setTargetFormat] = useState<TargetFormat>('png')
  const [quality, setQuality] = useState<number>(0.92)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (selectedFile: File) => {
    setError(null)
    setFile(selectedFile)

    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)

    const img = new Image()
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = objectUrl

    // Default target format: if current is jpg, suggest png, else suggest jpg
    const isJpg = selectedFile.type === 'image/jpeg' || selectedFile.name.toLowerCase().endsWith('.jpg')
    setTargetFormat(isJpg ? 'png' : 'jpeg')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFileSelect(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) {
      handleFileSelect(f)
    }
  }

  const handleConvert = async () => {
    if (!file || !previewUrl) return
    setIsProcessing(true)
    setError(null)

    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Could not load image.'))
        img.src = previewUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')

      if (!ctx) throw new Error('Canvas context not available.')

      const selectedOption = FORMAT_OPTIONS.find((f) => f.id === targetFormat) || FORMAT_OPTIONS[0]

      // Fill white background for JPEG/BMP if source has transparency
      if (selectedOption.id === 'jpeg' || selectedOption.id === 'bmp') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      ctx.drawImage(img, 0, 0)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Conversion failed.'))),
          selectedOption.mime,
          quality
        )
      })

      const downloadUrl = URL.createObjectURL(blob)
      const baseName = file.name.replace(/\.[^/.]+$/, '')
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${baseName}.${selectedOption.ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err: unknown) {
      console.error(err)
      setError('Could not convert image. Please check the file format.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setDimensions(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const selectedOption = FORMAT_OPTIONS.find((f) => f.id === targetFormat) || FORMAT_OPTIONS[0]

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {!file ? (
          /* Dropzone */
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-zinc-200 hover:border-zinc-300 bg-white/70 hover:bg-zinc-50/50 rounded-3xl p-16 text-center cursor-pointer transition-all"
          >
            <div className="max-w-sm mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-500">
                <Upload size={28} />
              </div>

              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Select an image to convert
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Supports JPG, PNG, WebP, GIF, BMP, and SVG files. Converted instantly in your browser.
                </p>
              </div>

              <div className="flex justify-center gap-1.5 pt-2">
                {FORMAT_OPTIONS.map((f) => (
                  <span
                    key={f.id}
                    className="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-600 text-[11px] font-semibold uppercase"
                  >
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Image Preview & Format Selector */
          <motion.div
            key="workspace"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Image Preview Box */}
            <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 flex flex-col items-center justify-center relative">
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-500 border border-zinc-200 shadow-xs transition-colors"
                title="Clear file"
              >
                <X size={16} />
              </button>

              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="max-h-72 object-contain rounded-2xl shadow-sm bg-white border border-zinc-200/60"
                />
              )}

              <div className="mt-4 text-center">
                <h4 className="text-sm font-semibold text-zinc-900 truncate max-w-md">
                  {file.name}
                </h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB
                  {dimensions ? ` • ${dimensions.width} × ${dimensions.height} px` : ''}
                </p>
              </div>
            </div>

            {/* Target Format Selection */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-900 uppercase tracking-wider block">
                  Convert To Format
                </label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Choose the target image extension for your download
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {FORMAT_OPTIONS.map((opt) => {
                  const isSelected = targetFormat === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTargetFormat(opt.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-2 ring-indigo-500/20'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-900">{opt.label}</span>
                        {isSelected && <Check size={14} className="text-indigo-600" />}
                      </div>
                      <span className="text-[11px] text-zinc-500 mt-1 line-clamp-1">
                        {opt.description}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Quality Slider for JPG & WebP */}
              {(targetFormat === 'jpeg' || targetFormat === 'webp') && (
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-4 text-xs">
                  <span className="font-semibold text-zinc-700">
                    Quality ({Math.round(quality * 100)}%)
                  </span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.0"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-48 accent-indigo-600 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handleConvert}
              disabled={isProcessing}
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Converting…</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Convert & Download as {selectedOption.label}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="w-full text-center text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              Convert another image
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
