'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Loader2, Upload, X } from 'lucide-react'
import { convertHeic } from '@/actions/convert-image'

export default function HeicToJpg() {
  const [file, setFile] = useState<File | null>(null)
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null)
  const [convertedSize, setConvertedSize] = useState<number | null>(null)
  const [dimensions, setDimensions] = useState<{ width?: number; height?: number } | null>(null)
  const [quality, setQuality] = useState<number>(95)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processHeic = async (selectedFile: File, q: number) => {
    setIsProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('quality', q.toString())

      const result = await convertHeic(formData)
      if (!result.success || !result.dataUrl) {
        throw new Error(result.error || 'Conversion failed.')
      }

      setConvertedUrl(result.dataUrl)
      setConvertedSize(result.size || null)
      setDimensions({ width: result.width, height: result.height })
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not convert HEIC photo.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setConvertedUrl(null)
    setConvertedSize(null)
    processHeic(selectedFile, quality)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFileSelect(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) handleFileSelect(f)
  }

  const handleQualityChange = (newQuality: number) => {
    setQuality(newQuality)
    if (file) {
      processHeic(file, newQuality)
    }
  }

  const handleDownload = () => {
    if (!file || !convertedUrl) return
    const a = document.createElement('a')
    a.href = convertedUrl
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    a.download = `${baseName}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleClear = () => {
    setFile(null)
    setConvertedUrl(null)
    setConvertedSize(null)
    setDimensions(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".heic,.heif,image/heic,image/heif"
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
                  Select an iPhone HEIC photo
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Convert Apple HEIC and HEIF photos to universally compatible JPG images.
                </p>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <span className="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-600 text-[11px] font-semibold uppercase">
                  HEIC
                </span>
                <span className="text-zinc-400 text-xs self-center">→</span>
                <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 text-[11px] font-semibold uppercase">
                  JPG
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
            {/* Image Preview & Details */}
            <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 flex flex-col items-center justify-center relative min-h-64">
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-500 border border-zinc-200 shadow-xs transition-colors"
                title="Clear file"
              >
                <X size={16} />
              </button>

              {isProcessing && !convertedUrl ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-500">
                  <Loader2 size={32} className="animate-spin text-indigo-600" />
                  <p className="text-xs font-medium">Converting HEIC photo to JPG…</p>
                </div>
              ) : convertedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={convertedUrl}
                  alt={file.name}
                  className="max-h-72 object-contain rounded-2xl shadow-sm bg-white border border-zinc-200/60"
                />
              ) : null}

              <div className="mt-4 text-center">
                <h4 className="text-sm font-semibold text-zinc-900 truncate max-w-md">
                  {file.name}
                </h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Original: {(file.size / (1024 * 1024)).toFixed(2)} MB
                  {convertedSize ? ` • Converted JPG: ${(convertedSize / (1024 * 1024)).toFixed(2)} MB` : ''}
                  {dimensions?.width && dimensions?.height ? ` • ${dimensions.width} × ${dimensions.height} px` : ''}
                </p>
              </div>
            </div>

            {/* Quality Presets */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider block">
                  JPG Output Quality
                </span>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Balance between compression and visual clarity
                </p>
              </div>

              <div className="flex items-center gap-2">
                {[
                  { label: 'Standard (85%)', val: 85 },
                  { label: 'High (95%)', val: 95 },
                  { label: 'Maximum (100%)', val: 100 },
                ].map((tier) => (
                  <button
                    key={tier.val}
                    type="button"
                    onClick={() => handleQualityChange(tier.val)}
                    disabled={isProcessing}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      quality === tier.val
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isProcessing || !convertedUrl}
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
                  <span>Download Converted JPG</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="w-full text-center text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              Convert another photo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
