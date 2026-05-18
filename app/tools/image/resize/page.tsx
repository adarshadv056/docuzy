'use client'

import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { MoveDiagonal, Download, Upload } from 'lucide-react'

export default function ImageResizer() {
    const [image, setImage] = useState<{ file: File, preview: string, w: number, h: number } | null>(null)
    const [width, setWidth] = useState(0)
    const [height, setHeight] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target?.result as string
            img.onload = () => {
                setImage({ file, preview: img.src, w: img.width, h: img.height })
                setWidth(img.width)
                setHeight(img.height)
            }
        }
        reader.readAsDataURL(file)
    }

    const downloadResized = () => {
        if (!image) return
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        const img = new Image()
        img.src = image.preview
        img.onload = () => {
            ctx?.drawImage(img, 0, 0, width, height)
            const link = document.createElement('a')
            link.download = `resized-${image.file.name}`
            link.href = canvas.toDataURL(image.file.type)
            link.click()
        }
    }

    return (
        <div className="max-w-2xl mx-auto py-20 px-6">
            <h1 className="text-3xl font-bold mb-2">Image Resizer</h1>
            <p className="text-zinc-500 mb-10">Change image dimensions instantly.</p>

            {!image ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-200 rounded-3xl p-20 text-center cursor-pointer hover:bg-zinc-50 transition-all"
                >
                    <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/*" />
                    <Upload className="mx-auto mb-4 text-zinc-400" />
                    <p className="font-medium">Upload Image</p>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-zinc-50 p-4 rounded-2xl flex justify-center">
                        <img src={image.preview} className="max-h-64 object-contain" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-zinc-400">Width (px)</label>
                            <input
                                type="number" value={width}
                                onChange={(e) => setWidth(Number(e.target.value))}
                                className="w-full p-4 bg-white border border-zinc-200 rounded-xl font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-zinc-400">Height (px)</label>
                            <input
                                type="number" value={height}
                                onChange={(e) => setHeight(Number(e.target.value))}
                                className="w-full p-4 bg-white border border-zinc-200 rounded-xl font-mono"
                            />
                        </div>
                    </div>

                    <button
                        onClick={downloadResized}
                        className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold shadow-xl hover:bg-zinc-800"
                    >
                        Download Resized Image
                    </button>
                </div>
            )}
        </div>
    )
}