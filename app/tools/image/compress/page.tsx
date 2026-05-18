'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Upload, Zap, X, ShieldCheck } from 'lucide-react'

export default function ImageCompressor() {
    const [image, setImage] = useState<{ file: File; preview: string; size: number } | null>(null)
    const [quality, setQuality] = useState(0.7)
    const [isProcessing, setIsProcessing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file && file.type.startsWith('image/')) {
            setImage({
                file,
                preview: URL.createObjectURL(file),
                size: file.size
            })
        }
    }

    const downloadCompressed = () => {
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
                ctx.imageSmoothingEnabled = true
                ctx.imageSmoothingQuality = 'high'
                ctx.drawImage(img, 0, 0)

                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `docuzy-compressed-${image.file.name.split('.')[0]}.jpg`
                        a.click()
                        URL.revokeObjectURL(url)
                    }
                    setIsProcessing(false)
                }, 'image/jpeg', quality)
            }
        }
    }

    return (
        <div className="max-w-xl mx-auto py-16 px-6 font-sans antialiased text-zinc-900">
            <div className="mb-10 text-left">
                <h1 className="text-3xl font-extrabold tracking-tight mb-2">Image Compressor</h1>
                <p className="text-zinc-500">Reduce footprint, retain clarity. All processing stays in your browser.</p>
            </div>

            <AnimatePresence mode="wait">
                {!image ? (
                    <motion.div
                        key="dropzone"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative border-2 border-dashed border-zinc-200 rounded-3xl p-16 text-center cursor-pointer hover:border-zinc-900 hover:bg-zinc-50 transition-all duration-300"
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/*" />
                        <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6 text-zinc-400 group-hover:scale-110 group-hover:text-zinc-900 transition-all">
                            <Upload size={24} />
                        </div>
                        <p className="font-semibold text-zinc-900">Click to upload or drag & drop</p>
                        <p className="text-xs text-zinc-400 mt-2 uppercase tracking-widest">JPG, PNG, WebP up to 20MB</p>
                    </motion.div>
                ) : (
                    <motion.div
                        key="editor"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-8"
                    >
                        <div className="relative bg-zinc-50 rounded-3xl p-4 border border-zinc-100 overflow-hidden">
                            <div className="flex justify-center items-center h-64 overflow-hidden rounded-2xl bg-white shadow-inner">
                                <img src={image.preview} alt="Preview" className="max-h-full object-contain" />
                            </div>
                            <button
                                onClick={() => setImage(null)}
                                className="absolute top-6 right-6 p-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm hover:text-red-500 transition-colors"
                            >
                                <X size={16} />
                            </button>

                            <div className="mt-4 flex justify-between items-center px-2">
                                <div>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Original Size</p>
                                    <p className="text-sm font-bold">{formatSize(image.size)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Est. Savings</p>
                                    <p className="text-sm font-bold text-emerald-600">~{Math.round((1 - quality) * 100)}% lighter</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold flex items-center gap-2">
                                        <Zap size={14} className="text-zinc-400" /> Compression Quality
                                    </label>
                                    <span className="text-xs font-mono font-bold bg-zinc-100 px-2 py-1 rounded">
                                        {Math.round(quality * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1"
                                    step="0.01"
                                    value={quality}
                                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                                />
                                <div className="flex justify-between text-[10px] font-bold text-zinc-300 uppercase tracking-tighter">
                                    <span>Smallest File</span>
                                    <span>Highest Quality</span>
                                </div>
                            </div>

                            <button
                                onClick={downloadCompressed}
                                disabled={isProcessing}
                                className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-zinc-200"
                            >
                                {isProcessing ? (
                                    "Processing..."
                                ) : (
                                    <>
                                        <Download size={18} /> Compress & Save
                                    </>
                                )}
                            </button>

                            <div className="flex items-center justify-center gap-2 text-zinc-400">
                                <ShieldCheck size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Private Device-Level Processing</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}