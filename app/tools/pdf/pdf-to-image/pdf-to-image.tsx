'use client'

import React, { useState, useRef } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { motion } from 'framer-motion'
import { FileImage, Download, Upload, Loader2 } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export default function PdfToJpg() {
    const [file, setFile] = useState<File | null>(null)
    const [images, setImages] = useState<string[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const convertPdfToImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        setFile(selectedFile)
        setIsProcessing(true)
        setImages([])

        const arrayBuffer = await selectedFile.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
        const imageList: string[] = []

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 2.0 })

            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d')

            if (context) {
                canvas.height = viewport.height
                canvas.width = viewport.width

                await page.render({ canvasContext: context, viewport, canvas: canvas }).promise

                const jpgUrl = canvas.toDataURL('image/jpeg', 0.9)
                imageList.push(jpgUrl)
            }
        }

        setImages(imageList)
        setIsProcessing(false)
    }

    return (
        <div className="max-w-4xl mx-auto py-16 px-6 font-sans text-zinc-900">
            <header className="mb-12">
                <h1 className="text-3xl font-bold tracking-tight">PDF to JPG</h1>
                <p className="text-zinc-500 mt-2">Convert document pages into high-resolution image assets.</p>
            </header>

            {!file ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-80 border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 hover:border-zinc-900 transition-all group"
                >
                    <input ref={fileInputRef} type="file" className="hidden" accept="application/pdf" onChange={convertPdfToImages} />
                    <Upload className="text-zinc-300 mb-4 group-hover:text-zinc-900" size={32} />
                    <p className="font-semibold">Upload PDF to Extract Images</p>
                </div>
            ) : (
                <div className="space-y-10">
                    {isProcessing ? (
                        <div className="flex flex-col items-center py-20 gap-4">
                            <Loader2 className="animate-spin text-zinc-900" size={40} />
                            <p className="text-sm font-bold uppercase tracking-widest text-zinc-400">Rendering Pages...</p>
                        </div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            {images.map((src, index) => (
                                <div key={index} className="group relative bg-zinc-50 rounded-2xl p-2 border border-zinc-100 overflow-hidden">
                                    <img src={src} alt={`Page ${index + 1}`} className="rounded-xl shadow-sm" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <a
                                            href={src}
                                            download={`page-${index + 1}.jpg`}
                                            className="p-3 bg-white rounded-full text-zinc-900 shadow-xl hover:scale-110 transition-transform"
                                        >
                                            <Download size={20} />
                                        </a>
                                    </div>
                                    <div className="mt-2 text-center text-[10px] font-bold text-zinc-400 uppercase">Page {index + 1}</div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {!isProcessing && (
                        <button
                            onClick={() => { setFile(null); setImages([]); }}
                            className="w-full py-4 text-zinc-400 text-sm font-bold uppercase tracking-widest hover:text-zinc-900 transition-colors"
                        >
                            Convert Another File
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}