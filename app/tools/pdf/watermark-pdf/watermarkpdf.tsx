'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import { motion } from 'framer-motion'
import { Download, Upload } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export default function WatermarkPDF() {
    const [file, setFile] = useState<{ name: string; buffer: ArrayBuffer; pages: number } | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [pageNumber, setPageNumber] = useState(1)
    const [pagePreview, setPagePreview] = useState<string | null>(null)

    const [type, setType] = useState<'text' | 'image'>('text')
    const [text, setText] = useState('CONFIDENTIAL')
    const [watermarkImage, setWatermarkImage] = useState<{ data: string, isPng: boolean } | null>(null)
    const [opacity, setOpacity] = useState(0.3)
    const [rotation, setRotation] = useState(-45)
    const [size, setSize] = useState(50)

    useEffect(() => {
        const renderPage = async () => {
            if (!file) return
            try {
                const pdf = await pdfjs.getDocument({ data: file.buffer.slice(0) }).promise
                const page = await pdf.getPage(pageNumber)
                const viewport = page.getViewport({ scale: 1.5 })
                const canvas = document.createElement('canvas')
                const context = canvas.getContext('2d')
                if (context) {
                    canvas.height = viewport.height
                    canvas.width = viewport.width
                    await page.render({ canvasContext: context, viewport, canvas }).promise
                    setPagePreview(canvas.toDataURL())
                }
            } catch (err) { console.error(err) }
        }
        renderPage()
    }, [file, pageNumber])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (f?.type === 'application/pdf') {
            const buffer = await f.arrayBuffer()
            const pdfDoc = await PDFDocument.load(buffer)
            setFile({ name: f.name, buffer, pages: pdfDoc.getPageCount() })
        }
    }

    const applyWatermark = async () => {
        if (!file) return
        setIsProcessing(true)
        try {
            const pdfDoc = await PDFDocument.load(file.buffer)
            const pages = pdfDoc.getPages()
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

            let imgAsset = null
            if (type === 'image' && watermarkImage) {
                imgAsset = watermarkImage.isPng
                    ? await pdfDoc.embedPng(watermarkImage.data)
                    : await pdfDoc.embedJpg(watermarkImage.data)
            }

            const pdfRotation = -rotation
            const rad = (pdfRotation * Math.PI) / 180

            pages.forEach((page) => {
                const { width, height } = page.getSize()
                const centerX = width / 2
                const centerY = height / 2

                if (type === 'text') {
                    const fontSize = (width / 850) * size;
                    const textWidth = font.widthOfTextAtSize(text, fontSize)
                    const textHeight = font.heightAtSize(fontSize)

                    const drawX = centerX - (Math.cos(rad) * textWidth / 2) + (Math.sin(rad) * textHeight / 2)
                    const drawY = centerY - (Math.sin(rad) * textWidth / 2) - (Math.cos(rad) * textHeight / 2)

                    page.drawText(text, {
                        x: drawX,
                        y: drawY,
                        size: fontSize,
                        font,
                        color: rgb(0.5, 0.5, 0.5),
                        opacity,
                        rotate: degrees(pdfRotation),
                    })
                } else if (imgAsset) {
                    const imgWidth = (width / 2) * (size / 100)
                    const imgHeight = (imgAsset.height / imgAsset.width) * imgWidth

                    const drawX = centerX - (Math.cos(rad) * imgWidth / 2) + (Math.sin(rad) * imgHeight / 2)
                    const drawY = centerY - (Math.sin(rad) * imgWidth / 2) - (Math.cos(rad) * imgHeight / 2)

                    page.drawImage(imgAsset, {
                        x: drawX,
                        y: drawY,
                        width: imgWidth,
                        height: imgHeight,
                        opacity,
                        rotate: degrees(pdfRotation),
                    })
                }
            })

            const pdfBytes = await pdfDoc.save()
            const blob = new Blob([pdfBytes.slice(0)], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `protected-${file.name}`
            link.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error("Export failed", err)
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="max-w-6xl mx-auto py-12 px-6">
            {!file ? (
                <div className="h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="application/pdf" onChange={handleFileUpload} />
                    <Upload className="text-zinc-400 mb-2" />
                    <p className="text-sm font-medium">Drop PDF here</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 space-y-6 bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm h-fit">
                        <div className="flex gap-2 bg-zinc-50 p-1 rounded-xl">
                            {(['text', 'image'] as const).map((t) => (
                                <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize ${type === t ? 'bg-white shadow-sm' : 'text-zinc-500'}`}>{t}</button>
                            ))}
                        </div>

                        <div className="space-y-4">
                            {type === 'text' ? (
                                <input type="text" value={text} onChange={(e) => setText(e.target.value)} className="w-full p-3 bg-zinc-50 rounded-xl border-none text-sm font-bold focus:ring-2 focus:ring-zinc-200 outline-none" />
                            ) : (
                                <input type="file" accept="image/*" onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => setWatermarkImage({ data: ev.target?.result as string, isPng: f.type === 'image/png' });
                                        reader.readAsDataURL(f);
                                    }
                                }} className="text-xs file:bg-zinc-900 file:text-white file:border-none file:px-3 file:py-2 file:rounded-lg file:mr-3" />
                            )}

                            <ControlSlider label="Opacity" value={opacity} min={0} max={1} step={0.01} onChange={setOpacity} />
                            <ControlSlider label="Rotation" value={rotation} min={-180} max={180} step={1} onChange={setRotation} suffix="°" />
                            <ControlSlider label="Scale" value={size} min={10} max={200} step={1} onChange={setSize} suffix="%" />
                        </div>

                        <button onClick={applyWatermark} disabled={isProcessing} className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all disabled:opacity-50">
                            {isProcessing ? 'Generating...' : 'Download Watermarked PDF'}
                        </button>
                    </div>

                    <div className="lg:col-span-8 bg-zinc-100 rounded-3xl p-8 flex items-center justify-center overflow-hidden">
                        <div className="relative shadow-2xl bg-white border border-zinc-200" style={{ width: '100%', maxWidth: '500px', aspectRatio: '1/1.414' }}>
                            {pagePreview && <img src={pagePreview} className="absolute inset-0 w-full h-full object-contain" alt="Preview" />}

                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <motion.div
                                    animate={{ opacity, rotate: rotation, scale: size / 100 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                >
                                    {type === 'text' ? (
                                        <span className="text-6xl font-black text-zinc-500/50 whitespace-nowrap">{text}</span>
                                    ) : (
                                        watermarkImage && <img src={watermarkImage.data} className="w-64 h-auto" alt="Watermark" />
                                    )}
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ControlSlider({ label, value, min, max, step, onChange, suffix = "" }: any) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                <span>{label}</span>
                <span>{value}{suffix}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900" />
        </div>
    )
}