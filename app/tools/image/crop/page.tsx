'use client'

import React, { useState, useRef } from 'react'
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { motion, AnimatePresence } from 'framer-motion'
import { Crop as CropIcon, Download, Upload, Maximize, X } from 'lucide-react'

export default function ImageCropper() {
    const [imgSrc, setImgSrc] = useState('')
    const [crop, setCrop] = useState<Crop>()
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
    const [aspect, setAspect] = useState<number | undefined>(undefined)

    const imgRef = useRef<HTMLImageElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files.length > 0) {
            setCrop(undefined)
            const reader = new FileReader()
            reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''))
            reader.readAsDataURL(e.target.files[0])
        }
    }

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        if (aspect) {
            const { width, height } = e.currentTarget
            setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height), width, height))
        }
    }

    async function downloadCrop() {
        const image = imgRef.current
        const crop = completedCrop
        if (!image || !crop) return

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const scaleX = image.naturalWidth / image.width
        const scaleY = image.naturalHeight / image.height

        canvas.width = crop.width * scaleX
        canvas.height = crop.height * scaleY

        ctx.imageSmoothingQuality = 'high'

        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            crop.width * scaleX,
            crop.height * scaleY
        )

        const base64Image = canvas.toDataURL('image/jpeg', 0.95)
        const link = document.createElement('a')
        link.download = 'docuzy-cropped.jpg'
        link.href = base64Image
        link.click()
    }

    return (
        <div className="max-w-4xl mx-auto py-16 px-6 text-zinc-900">
            <header className="mb-10 text-left">
                <h1 className="text-3xl font-bold tracking-tight">Precision Cropper</h1>
                <p className="text-zinc-500 mt-2">Trim your assets with mathematical accuracy.</p>
            </header>

            <AnimatePresence mode="wait">
                {!imgSrc ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-96 border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 transition-all group"
                    >
                        <input type="file" ref={fileInputRef} onChange={onSelectFile} className="hidden" accept="image/*" />
                        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 group-hover:scale-110 group-hover:text-zinc-900 transition-all duration-500">
                            <Upload size={24} />
                        </div>
                        <p className="mt-6 font-semibold">Import image for cropping</p>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-8 bg-zinc-50 rounded-3xl p-6 border border-zinc-100 flex items-center justify-center relative min-h-[500px]">
                            <ReactCrop
                                crop={crop}
                                onChange={(c) => setCrop(c)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={aspect}
                                className="max-h-[600px]"
                            >
                                <img
                                    ref={imgRef}
                                    src={imgSrc}
                                    onLoad={onImageLoad}
                                    alt="Source"
                                    className="max-h-[500px] object-contain rounded-lg shadow-2xl"
                                />
                            </ReactCrop>
                            <button
                                onClick={() => setImgSrc('')}
                                className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md hover:text-red-500"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="lg:col-span-4 space-y-8">
                            <section className="space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Aspect Ratio</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Free', val: undefined },
                                        { label: '1:1 Square', val: 1 },
                                        { label: '4:3 Standard', val: 4 / 3 },
                                        { label: '16:9 Cinema', val: 16 / 9 }
                                    ].map((ratio) => (
                                        <button
                                            key={ratio.label}
                                            onClick={() => setAspect(ratio.val)}
                                            className={`py-3 text-[10px] font-bold uppercase rounded-xl border transition-all ${aspect === ratio.val ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 hover:border-zinc-400'
                                                }`}
                                        >
                                            {ratio.label}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <div className="pt-8 border-t border-zinc-100">
                                <button
                                    disabled={!completedCrop}
                                    onClick={downloadCrop}
                                    className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
                                >
                                    <CropIcon size={18} /> Download Crop
                                </button>
                                <p className="text-[10px] text-center text-zinc-400 mt-4 uppercase tracking-widest">
                                    Processed in the secure vault.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}