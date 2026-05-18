'use client'

import React, { useState, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import { motion, AnimatePresence } from 'framer-motion'
import { Scissors, Download, Upload, FileText, ChevronRight, X } from 'lucide-react'

export default function SplitPDF() {
    const [file, setFile] = useState<{ name: string; buffer: ArrayBuffer; pageCount: number } | null>(null)
    const [startPage, setStartPage] = useState(1)
    const [endPage, setEndPage] = useState(1)
    const [isProcessing, setIsProcessing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile && selectedFile.type === 'application/pdf') {
            const buffer = await selectedFile.arrayBuffer()
            const pdfDoc = await PDFDocument.load(buffer)

            setFile({
                name: selectedFile.name,
                buffer: buffer,
                pageCount: pdfDoc.getPageCount()
            })
            setEndPage(pdfDoc.getPageCount())
        }
    }

    const executeSplit = async () => {
        if (!file) return
        setIsProcessing(true)

        try {
            const srcDoc = await PDFDocument.load(file.buffer)
            const newDoc = await PDFDocument.create()

            const indicesToExtract = []
            for (let i = startPage - 1; i <= endPage - 1; i++) {
                indicesToExtract.push(i)
            }

            const copiedPages = await newDoc.copyPages(srcDoc, indicesToExtract)
            copiedPages.forEach((page) => newDoc.addPage(page))

            const pdfBytes = await newDoc.save()
            const blob = new Blob([pdfBytes.slice(0)], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = url
            link.download = `split-${startPage}-to-${endPage}-${file.name}`
            link.click()

            URL.revokeObjectURL(url)
        } catch (error) {
            console.error("Split failed:", error)
            alert("Could not split PDF. It might be password protected.")
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto py-20 px-6 font-sans text-zinc-900">
            <header className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight">Split PDF</h1>
                <p className="text-zinc-500 mt-2">Extract specific pages from your documents instantly.</p>
            </header>

            <AnimatePresence mode="wait">
                {!file ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-64 border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 hover:border-zinc-900 transition-all group"
                    >
                        <input ref={fileInputRef} type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
                        <Upload className="text-zinc-300 group-hover:text-zinc-900 transition-colors mb-4" size={32} />
                        <p className="font-semibold text-zinc-900">Upload PDF to Split</p>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                        <div className="bg-zinc-50 border border-zinc-100 p-6 rounded-3xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-zinc-400">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold truncate max-w-[200px]">{file.name}</p>
                                    <p className="text-xs text-zinc-400">{file.pageCount} Pages Total</p>
                                </div>
                            </div>
                            <button onClick={() => setFile(null)} className="p-2 text-zinc-300 hover:text-red-500"><X size={18} /></button>
                        </div>

                        <div className="bg-white border border-zinc-100 p-8 rounded-3xl shadow-sm space-y-6">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Select Range</h3>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">From Page</label>
                                    <input
                                        type="number" min="1" max={file.pageCount} value={startPage}
                                        onChange={(e) => setStartPage(Math.max(1, Math.min(file.pageCount, Number(e.target.value))))}
                                        className="w-full p-4 bg-zinc-50 border-none rounded-2xl font-mono font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">To Page</label>
                                    <input
                                        type="number" min={startPage} max={file.pageCount} value={endPage}
                                        onChange={(e) => setEndPage(Math.max(startPage, Math.min(file.pageCount, Number(e.target.value))))}
                                        className="w-full p-4 bg-zinc-50 border-none rounded-2xl font-mono font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={executeSplit}
                                disabled={isProcessing}
                                className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold shadow-xl hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                            >
                                <Scissors size={18} />
                                {isProcessing ? "Processing..." : "Split PDF Now"}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}