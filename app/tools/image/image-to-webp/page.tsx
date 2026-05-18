'use client'

import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Download, Upload, Zap } from 'lucide-react'

export default function ImageToWebp() {
  const [image, setImage] = useState<{ file: File, preview: string } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImage({ file, preview: URL.createObjectURL(file) })
  }

  const convertToWebp = () => {
    if (!image) return
    setIsProcessing(true)

    const img = new Image()
    img.src = image.preview
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        ctx.drawImage(img, 0, 0)

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${image.file.name.split('.')[0]}.webp`
            a.click()
            URL.revokeObjectURL(url)
          }
          setIsProcessing(false)
        }, 'image/webp', 1)
      }
    }
  }

  return (
    <div className="max-w-xl mx-auto py-20 px-6 font-sans">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Convert to WebP</h1>
        <p className="text-zinc-500 mt-2">Convert to the modern web format for maximum speed and quality.</p>
      </div>

      {!image ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-200 rounded-3xl p-20 text-center cursor-pointer hover:bg-zinc-50 transition-all"
        >
          <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/*" />
          <Upload className="mx-auto mb-4 text-zinc-400" />
          <p className="font-semibold text-zinc-900">Upload Image</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-zinc-50 p-4 rounded-3xl border border-zinc-100 flex justify-center">
            <img src={image.preview} className="max-h-64 object-contain rounded-xl" />
          </div>

          <button
            onClick={convertToWebp}
            disabled={isProcessing}
            className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold shadow-xl hover:bg-zinc-800 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Zap size={18} />
            {isProcessing ? "Optimizing..." : "Convert to WebP"}
          </button>

          <button onClick={() => setImage(null)} className="w-full text-zinc-400 text-sm font-medium">
            Reset
          </button>
        </motion.div>
      )}
    </div>
  )
}