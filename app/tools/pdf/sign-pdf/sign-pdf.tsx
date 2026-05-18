'use client'

import React, { useState, useRef, useEffect } from 'react'
import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import { motion } from 'framer-motion'
import { Download, Upload, RotateCcw, Image as ImageIcon } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export default function SignPDF() {
    const [file, setFile] = useState<{ name: string; buffer: ArrayBuffer; pages: number } | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [pageNumber, setPageNumber] = useState(1)
    const [pagePreview, setPagePreview] = useState<string | null>(null)
    const [signMode, setSignMode] = useState<'draw' | 'upload'>('draw')
    const [signatureData, setSignatureData] = useState<string | null>(null)
    const [posMap, setPosMap] = useState({ x: 0.5, y: 0.85 })
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    useEffect(() => {
        const renderPreview = async () => {
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
                    await page.render({ canvasContext: context, viewport, canvas: canvas}).promise
                    setPagePreview(canvas.toDataURL())
                }
            } catch (error) {
                console.error("Error rendering PDF:", error)
            }
        }
        renderPreview()
    }, [file, pageNumber])

    const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        }
    }

    const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        setIsDrawing(true)
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (ctx) {
            const { x, y } = getCanvasCoordinates(e)
            ctx.beginPath()
            ctx.lineWidth = 3
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.strokeStyle = '#000'
            ctx.moveTo(x, y)
        }
    }

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (ctx) {
            const { x, y } = getCanvasCoordinates(e)
            ctx.lineTo(x, y)
            ctx.stroke()
        }
    }

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false)
            saveDrawing()
        }
    }

    const saveDrawing = () => {
        if (canvasRef.current) {
            setSignatureData(canvasRef.current.toDataURL('image/png'))
        }
    }

    const clearCanvas = () => {
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                ctx.beginPath()
                setSignatureData(null)
            }
        }
    }

    const handleSignUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file && file.type === 'image/png') {
            const reader = new FileReader()
            reader.onload = (event) => setSignatureData(event.target?.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setPosMap({
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height
        })
    }

    const signDocument = async () => {
        if (!file || !signatureData) return
        setIsProcessing(true)
        try {
            const pdfDoc = await PDFDocument.load(file.buffer.slice(0))
            const signatureImage = await pdfDoc.embedPng(signatureData)
            const page = pdfDoc.getPages()[pageNumber - 1]
            const { width, height } = page.getSize()
            const scaleFactor = signMode === 'draw' ? 0.4 : 0.25
            const sigWidth = signatureImage.width * scaleFactor
            const sigHeight = signatureImage.height * scaleFactor
            const finalX = (width * posMap.x) - (sigWidth / 2)
            const finalY = height - (height * posMap.y) - (sigHeight / 2)
            page.drawImage(signatureImage, {
                x: Math.max(0, Math.min(finalX, width - sigWidth)),
                y: Math.max(0, Math.min(finalY, height - sigHeight)),
                width: sigWidth,
                height: sigHeight,
            })
            const pdfBytes = await pdfDoc.save()
            const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `signed-${file.name}`
            link.click()
        } catch (error) {
            console.error("Signing error:", error)
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="max-w-6xl mx-auto py-12 px-6 font-sans text-zinc-900">
            <header className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight">Sign PDF</h1>
                <p className="text-zinc-500 mt-2">WYSIWYG: Precise placement for your documents.</p>
            </header>

            {!file ? (
                <div className="h-80 border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 relative">
                    <input type="file" className="absolute inset-0 opacity-0" accept="application/pdf" onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (f) setFile({ name: f.name, buffer: await f.arrayBuffer(), pages: 0 })
                    }} />
                    <Upload className="text-zinc-300 mb-4" size={32} />
                    <p className="font-semibold">Upload Document</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
                            <div className="flex bg-zinc-100 p-1 rounded-xl mb-6">
                                <button onClick={() => setSignMode('draw')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${signMode === 'draw' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}>Draw</button>
                                <button onClick={() => setSignMode('upload')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${signMode === 'upload' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}>Upload PNG</button>
                            </div>

                            {signMode === 'draw' ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Draw Below</span>
                                        <button onClick={clearCanvas} className="text-zinc-400 hover:text-red-500 transition-colors">
                                            <RotateCcw size={14} />
                                        </button>
                                    </div>
                                    <canvas 
                                        ref={canvasRef} 
                                        width={500} 
                                        height={200} 
                                        className="w-full h-40 bg-zinc-50 rounded-2xl border border-zinc-100 cursor-crosshair touch-none"
                                        onPointerDown={startDrawing}
                                        onPointerMove={draw}
                                        onPointerUp={stopDrawing}
                                        onPointerLeave={stopDrawing}
                                    />
                                </div>
                            ) : (
                                <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50 relative overflow-hidden">
                                    <input type="file" accept="image/png" onChange={handleSignUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                    {signatureData ? (
                                        <img src={signatureData} alt="Upload preview" className="max-h-32 object-contain" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <ImageIcon className="text-zinc-300" size={24} />
                                            <span className="text-xs text-zinc-400">Click to upload PNG</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={signDocument} 
                            disabled={!signatureData || isProcessing} 
                            className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                        >
                            {isProcessing ? "Processing..." : "Sign & Save"}
                        </button>
                    </div>

                    <div className="lg:col-span-7">
                        <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Placement Preview</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-400 font-bold">Page</span>
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={pageNumber} 
                                        onChange={(e) => setPageNumber(Math.max(1, Number(e.target.value)))} 
                                        className="w-12 text-center bg-white border border-zinc-200 rounded-lg text-xs py-1" 
                                    />
                                </div>
                            </div>

                            <div
                                onClick={handleMapClick}
                                className="relative w-full aspect-[1/1.414] bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden cursor-crosshair group"
                            >
                                {pagePreview && (
                                    <img src={pagePreview} alt="PDF Preview" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                                )}
                                
                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                {signatureData && (
                                    <motion.div
                                        animate={{ left: `${posMap.x * 100}%`, top: `${posMap.y * 100}%` }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                    >
                                        <img src={signatureData} alt="Signature floating" className="w-24 opacity-80" />
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                                            SIGNATURE POSITION
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}