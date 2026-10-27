'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { toPng } from 'html-to-image'
import {
  BookOpen,
  Check,
  Code,
  Copy,
  Download,
  FileDown,
  FileText,
  Layout,
  Loader2,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Settings2,
  Sparkles,
  Type,
  Upload,
} from 'lucide-react'

const SAMPLE_MARKDOWN = `# Project Documentation: Docuzy

Welcome to **Docuzy**, an AI-powered document workspace designed for modern document processing and retrieval.

## Key Features

- **In-House Cryptography**: Secure AES-256 standard encryption & decryption.
- **Client-Side Processing**: Documents never leave your device for maximum privacy.
- **Hardware Acceleration**: Built with native Web Crypto and Canvas APIs.

---

### Technical Specifications

| Component | Standard / Technology | Status |
| :--- | :--- | :---: |
| **PDF Encryption** | ISO 32000-2 (AES-256 / R=6) | Active |
| **PDF Decryption** | Zero-Knowledge Hash Matching | Active |
| **ZIP Packaging** | Native PKWARE Deflate | Active |
| **Image Extraction** | Original Bitstream Parser | Active |

### Code Example

\`\`\`typescript
import { encryptPDF } from '@/lib/pdf/encrypt-native';

const encrypted = await encryptPDF(pdfBytes, 'SuperSecret2026!', {
  allowPrinting: true,
  allowCopying: false,
});
console.log('Document secured with 256-bit AES encryption.');
\`\`\`

> *"Security and user privacy are not optional features; they are foundational requirements."*

#### Next Steps & Checklist

- [x] Implement in-house cryptographic engines
- [x] Zero external npm package dependencies
- [ ] Build Convert & OCR tools suite
`

type PageSize = 'a4' | 'letter'
type Theme = 'modern' | 'academic' | 'minimal'

export default function MarkdownToPdf() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN)
  const [pageSize, setPageSize] = useState<PageSize>('a4')
  const [theme, setTheme] = useState<Theme>('modern')
  const [includePageNumbers, setIncludePageNumbers] = useState(true)
  const [fontSize, setFontSize] = useState<number>(14)
  const [documentTitle, setDocumentTitle] = useState('document.pdf')

  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'both'>('both')

  const previewContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const baseName = file.name.replace(/\.[^/.]+$/, '')
    setDocumentTitle(`${baseName}.pdf`)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) setMarkdown(content)
    }
    reader.readAsText(file)
  }

  // Generate multi-page PDF
  const handleExportPdf = async () => {
    if (!previewContainerRef.current) return
    setIsExporting(true)
    setExportProgress('Rendering high-resolution pages…')

    try {
      const element = previewContainerRef.current

      // Target page dimensions in points (72 points = 1 inch)
      const isA4 = pageSize === 'a4'
      const pdfWidth = isA4 ? 595.28 : 612.0 // A4 vs Letter width
      const pdfHeight = isA4 ? 841.89 : 792.0 // A4 vs Letter height

      // Render element to high-res PNG
      const dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })

      setExportProgress('Assembling PDF pages…')

      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve) => (img.onload = resolve))

      const totalImgWidth = img.width
      const totalImgHeight = img.height

      // Scale factor to fit PDF page width
      const scale = pdfWidth / totalImgWidth
      const scaledTotalHeight = totalImgHeight * scale

      // Number of pages needed
      const numPages = Math.ceil(scaledTotalHeight / pdfHeight) || 1

      const pdfDoc = await PDFDocument.create()
      const embeddedImage = await pdfDoc.embedPng(dataUrl)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

      for (let p = 0; p < numPages; p++) {
        setExportProgress(`Generating page ${p + 1} of ${numPages}…`)
        const page = pdfDoc.addPage([pdfWidth, pdfHeight])

        // Height of the slice in image coordinate space
        const sliceHeightInPoints = pdfHeight
        const sliceYInPoints = p * pdfHeight

        // Draw image slice with vertical clipping/translation
        page.drawImage(embeddedImage, {
          x: 0,
          y: pdfHeight - scaledTotalHeight + sliceYInPoints,
          width: pdfWidth,
          height: scaledTotalHeight,
        })

        // Draw page numbers if enabled
        if (includePageNumbers) {
          const pageStr = `${p + 1} / ${numPages}`
          const textWidth = font.widthOfTextAtSize(pageStr, 9)
          page.drawText(pageStr, {
            x: (pdfWidth - textWidth) / 2,
            y: 20,
            size: 9,
            font,
            color: rgb(0.5, 0.5, 0.5),
          })
        }
      }

      setExportProgress('Finalizing document…')
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      let filename = documentTitle.trim() || 'document.pdf'
      if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf'
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Could not export PDF. Please check your Markdown formatting.')
    } finally {
      setIsExporting(false)
      setExportProgress('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Main Toolbar */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Left Actions: Upload & Templates */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Upload size={14} />
            <span>Open .md File</span>
          </button>

          <button
            type="button"
            onClick={() => setMarkdown(SAMPLE_MARKDOWN)}
            className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Load Sample</span>
          </button>

          <button
            type="button"
            onClick={() => setMarkdown('')}
            className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={14} />
            <span>Clear</span>
          </button>
        </div>

        {/* Center / Right Settings Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Page Format Selector */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl text-xs font-semibold text-zinc-600">
            <button
              onClick={() => setPageSize('a4')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                pageSize === 'a4' ? 'bg-white text-zinc-900 shadow-xs' : 'hover:text-zinc-900'
              }`}
            >
              A4
            </button>
            <button
              onClick={() => setPageSize('letter')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                pageSize === 'letter' ? 'bg-white text-zinc-900 shadow-xs' : 'hover:text-zinc-900'
              }`}
            >
              Letter
            </button>
          </div>

          {/* Theme Selector */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none cursor-pointer"
          >
            <option value="modern">Modern Clean</option>
            <option value="academic">Academic Serif</option>
            <option value="minimal">Minimal Dark Code</option>
          </select>

          {/* Export Action Button */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting || !markdown.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{exportProgress || 'Exporting…'}</span>
              </>
            ) : (
              <>
                <FileDown size={14} />
                <span>Export to PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor & Preview Split-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
        {/* Markdown Source Editor */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
              <Code size={15} className="text-indigo-600" />
              <span>Markdown Editor</span>
            </div>
            <span className="text-[11px] text-zinc-400">
              {markdown.length} characters · {markdown.split(/\s+/).filter(Boolean).length} words
            </span>
          </div>

          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Write or paste your Markdown here…"
            className="flex-1 w-full p-4 bg-zinc-50/70 border border-zinc-100 rounded-2xl font-mono text-xs leading-relaxed text-zinc-800 resize-none focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none min-h-[500px]"
          />
        </div>

        {/* Live Document Preview */}
        <div className="bg-zinc-100/70 border border-zinc-200 rounded-3xl p-5 shadow-sm flex flex-col space-y-3 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
              <BookOpen size={15} className="text-emerald-600" />
              <span>Print Preview</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-zinc-400">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePageNumbers}
                  onChange={(e) => setIncludePageNumbers(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Page numbers</span>
              </label>
            </div>
          </div>

          {/* Rendered Document Sheet Container */}
          <div className="flex-1 overflow-y-auto max-h-[700px] flex justify-center py-4">
            <div
              ref={previewContainerRef}
              className={`bg-white shadow-md border border-zinc-200 rounded-lg p-10 lg:p-12 transition-all ${
                pageSize === 'a4' ? 'w-[595px]' : 'w-[612px]'
              } ${
                theme === 'academic'
                  ? 'font-serif text-zinc-900'
                  : theme === 'minimal'
                  ? 'font-mono text-zinc-900'
                  : 'font-sans text-zinc-800'
              }`}
              style={{ fontSize: `${fontSize}px` }}
            >
              <div className="prose prose-zinc max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-pre:rounded-xl prose-table:border prose-th:bg-zinc-100 prose-th:p-2 prose-td:p-2 prose-blockquote:border-l-indigo-600 prose-blockquote:bg-indigo-50/30 prose-blockquote:py-1 prose-blockquote:px-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdown || '_Empty document. Start typing in the editor on the left…_'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
