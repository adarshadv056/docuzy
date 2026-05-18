'use client'

import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Download, Upload, FileType } from 'lucide-react'

export default function JpgToPng() {
  const [image, setImage] = useState<{ file: File, preview: string } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImage({ file, preview: URL.createObjectURL(file) })
  }

  const convertToPng = () => {
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
            a.download = `${image.file.name.split('.')[0]}.png`
            a.click()
            URL.revokeObjectURL(url)
          }
          setIsProcessing(false)
        }, 'image/png')
      }
    }
  }

  return (
    <div className="max-w-xl mx-auto py-20 px-6 font-sans">
      <div className="mb-10 text-left">
        <h1 className="text-3xl font-bold tracking-tight">JPG to PNG</h1>
        <p className="text-zinc-500 mt-2">Convert compressed photos into high-quality, lossless PNG files.</p>
      </div>

      {!image ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="group border-2 border-dashed border-zinc-200 rounded-3xl p-20 text-center cursor-pointer hover:border-zinc-900 hover:bg-zinc-50 transition-all"
        >
          <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/jpeg,image/jpg" />
          <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 group-hover:text-zinc-900 transition-colors">
            <Upload size={20} />
          </div>
          <p className="font-semibold text-zinc-900">Upload JPG Image</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 flex flex-col items-center">
            <img src={image.preview} className="max-h-64 object-contain rounded-xl shadow-sm mb-4" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Ready for Conversion</div>
          </div>

          <button
            onClick={convertToPng}
            disabled={isProcessing}
            className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold shadow-xl hover:bg-zinc-800 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <FileType size={18} />
            {isProcessing ? "Converting..." : "Convert to PNG"}
          </button>

          <button onClick={() => setImage(null)} className="w-full text-zinc-400 text-sm font-medium hover:text-zinc-600 transition-colors">
            Cancel
          </button>
        </motion.div>
      )}
    </div>
  )
}