'use client'

import React, { useState, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import { motion, AnimatePresence } from 'framer-motion'
import { Hash, Download, Upload, FileText, X, Settings2, Layout, Type } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export default function PageNumberPDF() {
  const [file, setFile] = useState<{ name: string; buffer: ArrayBuffer; pages: number } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pagePreview, setPagePreview] = useState<string | null>(null)
  const [previewPage, setPreviewPage] = useState(1)

  const [position, setPosition] = useState<'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'top-left' | 'top-center'>('bottom-center')
  const [format, setFormat] = useState('Page {n} of {total}')
  const [fontSize, setFontSize] = useState(12)
  const [startFrom, setStartFrom] = useState(1)

  useEffect(() => {
    const renderPreview = async () => {
      if (!file) return
      try {
        const bufferCopy = file.buffer.slice(0)
        const pdf = await pdfjs.getDocument({ data: bufferCopy }).promise
        const page = await pdf.getPage(previewPage)
        const viewport = page.getViewport({ scale: 1.2 })
        
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (context) {
          canvas.height = viewport.height
          canvas.width = viewport.width
          await page.render({ canvasContext: context, viewport, canvas: canvas }).promise
          setPagePreview(canvas.toDataURL())
        }
      } catch (err) {
        console.error("Preview failed:", err)
      }
    }
    renderPreview()
  }, [file, previewPage])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f && f.type === 'application/pdf') {
      const buffer = await f.arrayBuffer()
      const pdfDoc = await PDFDocument.load(buffer.slice(0))
      setFile({ name: f.name, buffer, pages: pdfDoc.getPageCount() })
    }
  }

  const addPageNumbers = async () => {
    if (!file) return
    setIsProcessing(true)

    try {
      const pdfDoc = await PDFDocument.load(file.buffer.slice(0), { ignoreEncryption: true ,throwOnInvalidObject: false})
      const pages = pdfDoc.getPages()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const totalPages = pages.length

      pages.forEach((page, index) => {
        const { width, height } = page.getSize()
        
        if (index + 1 < startFrom) return

        const currentPageNum = index + 1
        const text = format
          .replace('{n}', currentPageNum.toString())
          .replace('{total}', totalPages.toString())

        const textWidth = font.widthOfTextAtSize(text, fontSize)
        const margin = 30

        let x = margin
        let y = margin

        if (position.includes('right')) x = width - textWidth - margin
        else if (position.includes('center')) x = (width / 2) - (textWidth / 2)

        if (position.includes('top')) y = height - margin - fontSize

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        })
      })

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes.slice(0)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `numbered-${file.name}`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-16 px-6 font-sans text-zinc-900">
      <header className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight">Add Page Numbers</h1>
        <p className="text-zinc-500 mt-2">Organize your document with customizable numbering.</p>
      </header>

      {!file ? (
        <div className="h-80 border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 relative group">
          <input type="file" className="absolute inset-0 opacity-0 z-10 cursor-pointer" accept="application/pdf" onChange={handleFileUpload} />
          <Upload className="text-zinc-300 group-hover:text-zinc-900 mb-4 transition-colors" size={32} />
          <p className="font-semibold text-zinc-900">Upload PDF</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm space-y-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2"><Settings2 size={14}/> Numbering Settings</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Format</label>
                  <input type="text" value={format} onChange={(e) => setFormat(e.target.value)} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold outline-none focus:border-zinc-900 transition-all" placeholder="e.g. {n} / {total}" />
                  <p className="text-[10px] text-zinc-400 ml-1">Use <span className="font-mono text-zinc-900">{`{n}`}</span> for current and <span className="font-mono text-zinc-900">{`{total}`}</span> for total pages.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Position</label>
                    <select value={position} onChange={(e) => setPosition(e.target.value as any)} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold text-sm outline-none">
                      <option value="bottom-center">Bottom Center</option>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="top-center">Top Center</option>
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Start From</label>
                    <input type="number" min="1" max={file.pages} value={startFrom} onChange={(e) => setStartFrom(Number(e.target.value))} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-bold outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <button onClick={addPageNumbers} disabled={isProcessing} className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-50 transition-all">
              {isProcessing ? 'Adding Numbers...' : <><Hash size={18} /> Add Numbers & Download</>}
            </button>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 relative">
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Layout Preview</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-400">Preview Page</span>
                  <input type="number" min="1" max={file.pages} value={previewPage} onChange={(e) => setPreviewPage(Number(e.target.value))} className="w-12 text-center bg-white border border-zinc-200 rounded-lg text-xs py-1 outline-none" />
                </div>
              </div>

              <div className="relative aspect-[1/1.414] bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden flex items-center justify-center">
                {pagePreview && <img src={pagePreview} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />}
                
                <div className={`absolute p-2 flex items-center justify-center pointer-events-none z-10 ${
                  position.includes('bottom') ? 'bottom-8' : 'top-8'
                } ${
                  position.includes('left') ? 'left-8' : position.includes('right') ? 'right-8' : 'left-1/2 -translate-x-1/2'
                }`}>
                  <div className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
                    <Hash size={10} /> {format.replace('{n}', previewPage.toString()).replace('{total}', file.pages.toString())}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}