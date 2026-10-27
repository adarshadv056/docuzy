'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Loader2, Sparkles, Upload, X } from 'lucide-react'
import { convertToAvif } from '@/actions/convert-image'

export default function ImageToAvif() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [quality, setQuality] = useState<number>(0.8)
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

  const checkCanvasAvifSupport = (): boolean => {
    try {
      const c = document.createElement('canvas')
      c.width = 1
      c.height = 1
      return c.toDataURL('image/avif').startsWith('data:image/avif')
    } catch {
      return false
    }
  }

  const convertClientSide = async (imgUrl: string): Promise<Blob> => {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Image failed to load.'))
      img.src = imgUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available.')

    ctx.drawImage(img, 0, 0)

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b && b.type === 'image/avif') {
            resolve(b)
          } else {
            reject(new Error('Browser canvas did not export AVIF.'))
          }
        },
        'image/avif',
        quality
      )
    })
  }

  const convertServerSide = async (f: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', f)
    formData.append('quality', Math.round(quality * 100).toString())

    const result = await convertToAvif(formData)
    if (!result.success || !result.dataUrl) {
      throw new Error(result.error || 'Server AVIF conversion failed.')
    }
    return result.dataUrl
  }

  const handleConvert = async () => {
    if (!file || !previewUrl) return
    setIsProcessing(true)
    setError(null)

    try {
      const baseName = file.name.replace(/\.[^/.]+$/, '')

      if (checkCanvasAvifSupport()) {
        try {
          const blob = await convertClientSide(previewUrl)
          const downloadUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = downloadUrl
          a.download = `${baseName}.avif`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(downloadUrl)
          return
        } catch {
          // Fall through to server-side sharp if canvas export fell back to PNG
        }
      }

      // Server-side Sharp AVIF encoder
      const dataUrl = await convertServerSide(file)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${baseName}.avif`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: unknown) {
      console.error(err)
      setError('Could not convert image to AVIF. Please try again.')
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

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {!file ? (
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
                  Select an image to convert to AVIF
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Convert JPG, PNG, or WebP to high-efficiency AVIF format with superior compression.
                </p>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <span className="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-600 text-[11px] font-semibold uppercase">
                  JPG / PNG
                </span>
                <span className="text-zinc-400 text-xs self-center">→</span>
                <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 text-[11px] font-semibold uppercase">
                  AVIF
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Preview Box */}
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

            {/* Quality & Settings */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider block">
                    AVIF Quality ({Math.round(quality * 100)}%)
                  </span>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Recommended: 80% (produces up to 50% smaller files than JPEG with high visual fidelity)
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50/70 border border-indigo-100 px-3 py-1.5 rounded-xl font-medium">
                  <Sparkles size={14} />
                  <span>Next-Gen Compression</span>
                </div>
              </div>

              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
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
                  <span>Encoding to AVIF…</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Convert & Download AVIF</span>
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
