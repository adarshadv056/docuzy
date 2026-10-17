'use client'

import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'

export default function ImageToJpg() {
  const [image, setImage] = useState<{ file: File, preview: string } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImage({ file, preview: URL.createObjectURL(file) })
  }

  const convertToJpg = () => {
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
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        ctx.drawImage(img, 0, 0)

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${image.file.name.split('.')[0]}.jpg`
            a.click()
            URL.revokeObjectURL(url)
          }
          setIsProcessing(false)
        }, 'image/jpeg', 1) 
      }
    }
  }

  return (
    <div className="font-sans">
      {!image ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-200 rounded-3xl p-20 text-center cursor-pointer hover:bg-zinc-50 transition-all"
        >
          <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/*" />
          <Upload className="mx-auto mb-4 text-zinc-400" />
          <p className="font-semibold text-zinc-900">Select Image</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-zinc-50 p-4 rounded-3xl border border-zinc-100 flex justify-center">
            <img src={image.preview} alt="Preview" className="max-h-64 object-contain rounded-xl shadow-lg" />
          </div>

          <button
            onClick={convertToJpg}
            disabled={isProcessing}
            className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold shadow-xl hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isProcessing ? "Converting..." : "Download as JPG"}
          </button>

          <button onClick={() => setImage(null)} className="w-full text-zinc-400 text-sm font-medium">
            Clear and Try Another
          </button>
        </motion.div>
      )}
    </div>
  )
}
