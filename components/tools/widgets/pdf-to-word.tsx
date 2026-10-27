'use client'

import React, { useState, useRef, useCallback } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { createDocx, DocxParagraph } from '@/lib/office/openxml-native'
import {
  Check,
  Download,
  FileText,
  FileType2,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

export default function PdfToWord() {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'converting' | 'done'>('idle')
  const [progressText, setProgressText] = useState('')
  const [docxBytes, setDocxBytes] = useState<Uint8Array | null>(null)
  const [extractedCount, setExtractedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processPdf = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setPhase('converting')
    setError(null)
    setDocxBytes(null)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        useWorkerFetch: false,
        disableFontFace: true,
      })

      const pdf = await loadingTask.promise
      const totalPages = pdf.numPages
      const paragraphs: DocxParagraph[] = []

      for (let p = 1; p <= totalPages; p++) {
        setProgressText(`Analyzing page ${p} of ${totalPages}…`)
        const page = await pdf.getPage(p)
        const textContent = await page.getTextContent()

        // Filter and sort items
        const textItems = (textContent.items as any[]).filter(
          (item) => item.str && item.str.trim().length > 0
        )

        // Find font size scale
        const fontSizes = textItems.map((item) => Math.abs(item.transform?.[0] || item.height || 12))
        fontSizes.sort((a, b) => a - b)
        const medianSize = fontSizes[Math.floor(fontSizes.length / 2)] || 12

        // Group into lines by Y coordinate
        const lines: { y: number; text: string; maxFont: number; isBold: boolean }[] = []
        for (const item of textItems) {
          const y = Math.round(item.transform?.[5] || 0)
          const fontSize = Math.abs(item.transform?.[0] || item.height || 12)
          const fontName = (item.fontName || '').toLowerCase()
          const isBold = fontName.includes('bold') || fontName.includes('heavy')

          let line = lines.find((l) => Math.abs(l.y - y) <= 4)
          if (!line) {
            line = { y, text: '', maxFont: fontSize, isBold }
            lines.push(line)
          }
          line.text += (line.text ? ' ' : '') + item.str.trim()
          if (fontSize > line.maxFont) line.maxFont = fontSize
          if (isBold) line.isBold = true
        }

        lines.sort((a, b) => b.y - a.y)

        for (const line of lines) {
          const isH1 = line.maxFont >= medianSize * 1.5
          const isH2 = line.maxFont >= medianSize * 1.25 && !isH1

          paragraphs.push({
            text: line.text,
            isHeading: isH1 || isH2,
            headingLevel: isH1 ? 1 : isH2 ? 2 : undefined,
            isBold: line.isBold,
          })
        }
      }

      setExtractedCount(paragraphs.length)
      setProgressText('Packaging into OpenXML Word (.docx)…')
      const docx = await createDocx(paragraphs)
      setDocxBytes(docx)
      setPhase('done')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Could not convert this PDF to Word.')
      setPhase('idle')
    }
  }, [])

  const handleDownload = () => {
    if (!docxBytes || !file) return
    const blob = new Blob([docxBytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    a.download = `${baseName}.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const startOver = () => {
    setFile(null)
    setDocxBytes(null)
    setPhase('idle')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) processPdf(f)
        }}
        className="hidden"
      />

      {phase === 'idle' && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            const dropped = e.dataTransfer.files?.[0]
            if (dropped && dropped.type === 'application/pdf') processPdf(dropped)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 lg:p-14 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-600 bg-indigo-50/50 scale-[0.99]'
              : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
          }`}
        >
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            <FileType2 size={28} />
          </div>

          <h3 className="text-base font-bold text-zinc-900 mb-1">
            Choose a PDF to convert to Word (.docx)
          </h3>
          <p className="text-xs text-zinc-400 mb-5">
            Convert PDF into an editable Microsoft Word document with headings and paragraphs
          </p>

          <span className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors">
            <Upload size={14} />
            Browse Files
          </span>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-6 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              Standard OpenXML (.docx)
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-blue-500" />
              Microsoft Word &amp; Google Docs Compatible
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-500" />
              100% In-House &amp; Private
            </span>
          </div>
        </div>
      )}

      {phase === 'converting' && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-10 text-center space-y-4 shadow-sm">
          <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-900">Converting PDF to Word Document</h3>
            <p className="text-xs text-zinc-400">{progressText}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <X size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {phase === 'done' && docxBytes && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileType2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Conversion Completed</h3>
              <p className="text-xs text-zinc-400">
                {extractedCount} paragraphs extracted and packaged into Microsoft Word (.docx) format
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-zinc-500" />
              <span className="font-semibold text-zinc-800">
                {file?.name.replace(/\.[^/.]+$/, '')}.docx
              </span>
            </div>
            <span className="text-zinc-500 font-medium">Ready to edit</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <Download size={15} />
              <span>Download Word Document (.docx)</span>
            </button>
            <button
              onClick={startOver}
              className="py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw size={15} />
              <span>Convert Another</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
