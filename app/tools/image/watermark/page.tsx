'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Upload, Type, Image as ImageIcon, X, Layers3 } from 'lucide-react'

// --- Helpers ---
const getImageUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.readAsDataURL(file)
  })
}

const loadSingleImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = src
    img.onload = () => resolve(img)
  })
}

export default function ImageWatermarker() {
  // State for original image
  const [baseImage, setBaseImage] = useState<{ file: File, preview: string, w: number, h: number } | null>(null)
  
  // Watermark Settings
  const [wmType, setWmType] = useState<'text' | 'image'>('text')
  const [wmText, setWmText] = useState('© Docuzy Vault')
  const [wmImage, setWmImage] = useState<{ preview: string, w: number, h: number } | null>(null)
  
  // Common Controls
  const [opacity, setOpacity] = useState(0.5)
  const [scale, setScale] = useState(0.2) // Size relative to base image
  const [position, setPosition] = useState<'center' | 'bottom-right' | 'top-left'>('bottom-right')
  
  // UI/Processing State
  const [previewUrl, setPreviewUrl] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wmFileInputRef = useRef<HTMLInputElement>(null)

  // --- Core Logic: The Drawing Engine ---
  const generateWatermark = useCallback(async () => {
    if (!baseImage) return
    setIsProcessing(true)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 1. Load background image and set canvas size to match actual photo
    const mainImg = await loadSingleImage(baseImage.preview)
    canvas.width = mainImg.naturalWidth
    canvas.height = mainImg.naturalHeight

    // 2. Draw background
    ctx.drawImage(mainImg, 0, 0)

    // 3. Configure transparency for the watermark layer
    ctx.globalAlpha = opacity 
    ctx.fillStyle = 'white' // Standard watermark color
    ctx.shadowColor = 'rgba(0,0,0,0.5)' // Add shadow for visibility on white areas
    ctx.shadowBlur = canvas.width * 0.005
    
    // Calculate watermark sizing
    const wmMaxWidth = canvas.width * scale

    // 4. Draw the specific type
    if (wmType === 'text') {
      // Dynamic font size based on image width
      const fontSize = Math.max(canvas.width * scale * 0.2, 20)
      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.textBaseline = 'middle'
      
      const textMetrics = ctx.measureText(wmText)
      let tx = 0, ty = 0

      // Positioning logic
      if (position === 'center') {
        tx = canvas.width / 2 - textMetrics.width / 2
        ty = canvas.height / 2
      } else if (position === 'bottom-right') {
        tx = canvas.width - textMetrics.width - (canvas.width * 0.05)
        ty = canvas.height - fontSize - (canvas.height * 0.05)
      } else { // top-left
        tx = canvas.width * 0.05
        ty = fontSize + (canvas.height * 0.05)
      }

      ctx.fillText(wmText, tx, ty)

    } else if (wmType === 'image' && wmImage) {
      const logoImg = await loadSingleImage(wmImage.preview)
      
      // Calculate aspect ratio of logo
      const logoAspect = wmImage.w / wmImage.h
      const hStr = wmMaxWidth / logoAspect
      
      let lx = 0, ly = 0
      
      // Positioning logic
      if (position === 'center') {
        lx = canvas.width / 2 - wmMaxWidth / 2
        ly = canvas.height / 2 - hStr / 2
      } else if (position === 'bottom-right') {
        lx = canvas.width - wmMaxWidth - (canvas.width * 0.05)
        ly = canvas.height - hStr - (canvas.height * 0.05)
      } else { // top-left
        lx = canvas.width * 0.05
        ly = canvas.height * 0.05
      }

      ctx.drawImage(logoImg, lx, ly, wmMaxWidth, hStr)
    }

    // 5. Export for preview/download
    // Reset alpha just in case
    ctx.globalAlpha = 1.0 
    
    canvas.toBlob((blob) => {
      if (blob) {
        if (previewUrl) URL.revokeObjectURL(previewUrl) // Memory cleanup
        setPreviewUrl(URL.createObjectURL(blob))
      }
      setIsProcessing(false)
    }, baseImage.file.type, 0.95)

  } , [baseImage, wmType, wmText, wmImage, opacity, scale, position, previewUrl])

  // Automatic redraw when settings change (Debounced for performance)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (baseImage) generateWatermark()
    }, 300)
    return () => clearTimeout(timer)
  }, [baseImage, wmType, wmText, wmImage, opacity, scale, position, generateWatermark])


  // --- Handlers ---
  const handleMainFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const preview = await getImageUrl(file)
    const img = await loadSingleImage(preview)
    setBaseImage({ file, preview, w: img.width, h: img.height })
  }

  const handleWmFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const preview = await getImageUrl(file)
    const img = await loadSingleImage(preview)
    setWmImage({ preview, w: img.width, h: img.height })
  }

  const downloadFinal = () => {
    if (!previewUrl || !baseImage) return
    const link = document.createElement('a')
    link.href = previewUrl
    link.download = `docuzy-marked-${baseImage.file.name}`
    link.click()
  }

  return (
    <div className="max-w-5xl mx-auto py-16 px-6 font-sans text-zinc-900">
      <header className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight">Image Watermark</h1>
        <p className="text-zinc-500 mt-2">Protect your visual assets with custom text or logos.</p>
      </header>

      <AnimatePresence mode="wait">
        {!baseImage ? (
          // --- Upload State ---
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => fileInputRef.current?.click()} className="h-96 border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 group transition-all">
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleMainFile(e.target.files[0])} />
            <Upload className="mx-auto mb-4 text-zinc-400 group-hover:scale-110 transition-transform" size={24}/>
            <p className="font-semibold">Upload Image to Protect</p>
          </motion.div>
        ) : (
          // --- Editor State ---
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left: Live Preview */}
            <div className="lg:col-span-7 bg-zinc-50 border border-zinc-100 rounded-3xl p-6 flex flex-col items-center justify-center relative min-h-[500px]">
              {isProcessing && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-3xl z-10 text-xs font-bold uppercase tracking-widest text-zinc-500">Updating Vault...</div>}
              <img src={previewUrl || baseImage.preview} alt="Preview" className="max-h-[500px] object-contain rounded-lg shadow-2xl transition-opacity duration-300" />
              <button onClick={() => {setBaseImage(null); setWmImage(null); setPreviewUrl('');}} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md hover:text-red-500"><X size={16}/></button>
            </div>

            {/* Right: Controls */}
            <div className="lg:col-span-5 space-y-8 p-2">
              <section className="space-y-4">
                <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
                  <button onClick={() => setWmType('text')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold uppercase ${wmType === 'text' ? 'bg-white text-zinc-900 shadow' : 'text-zinc-500 hover:text-zinc-900'}`}><Type size={14}/> Text</button>
                  <button onClick={() => setWmType('image')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold uppercase ${wmType === 'image' ? 'bg-white text-zinc-900 shadow' : 'text-zinc-500 hover:text-zinc-900'}`}><ImageIcon size={14}/> Logo</button>
                </div>

                <AnimatePresence mode="wait">
                  {wmType === 'text' ? (
                    <motion.input initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} type="text" value={wmText} onChange={(e) => setWmText(e.target.value)} placeholder="© Your Name/Company" className="w-full p-4 border border-zinc-200 rounded-xl text-sm" />
                  ) : (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => wmFileInputRef.current?.click()} className="p-4 border-2 border-dashed border-zinc-200 rounded-xl text-center cursor-pointer hover:border-zinc-400 bg-white">
                      <input ref={wmFileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleWmFile(e.target.files[0])} />
                      {wmImage ? <img src={wmImage.preview} className="h-10 mx-auto object-contain" /> : <p className="text-xs text-zinc-500 font-medium">Upload Transparent PNG Logo</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Advanced Controls */}
              <section className="space-y-6 pt-6 border-t border-zinc-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2"><Layers3 size={14}/> Placement & Style</h3>
                
                {/* Position Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {lbl: 'TL', val: 'top-left'},
                    {lbl: 'Center', val: 'center'},
                    {lbl: 'BR', val: 'bottom-right'}
                  ].map(pos => (
                    <button key={pos.val} onClick={() => setPosition(pos.val as any)} className={`py-3 text-[10px] font-bold uppercase rounded-lg border ${position === pos.val ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 hover:border-zinc-400'}`}>{pos.lbl}</button>
                  ))}
                </div>

                {/* Opacity Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><label className="font-semibold">Transparency</label><span className="font-mono text-zinc-500">{Math.round(opacity * 100)}%</span></div>
                  <input type="range" min="0.1" max="1" step="0.01" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-zinc-900" />
                </div>

                {/* Scale Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><label className="font-semibold">Watermark Size</label><span className="font-mono text-zinc-500">{Math.round(scale * 100)}%</span></div>
                  <input type="range" min="0.05" max="0.5" step="0.01" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-zinc-900" />
                </div>
              </section>

              <button onClick={downloadFinal} disabled={isProcessing || !previewUrl} className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold shadow-xl hover:bg-zinc-800 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all">
                <Download size={18} /> Save Protected Image
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}