'use client'

import React, { useState, useRef } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import {
  Download,
  FileDown,
  FileText,
  FileType2,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

const SAMPLE_WORD_DOC = `Docuzy Official Proposal

Introduction & Executive Summary
This document serves as an official technical statement for the Docuzy platform. Docuzy provides an all-in-one privacy-first document workspace designed for modern professionals, enterprise teams, and individual developers.

Core Capabilities
1. In-House Cryptographic Protection: Full ISO 32000-2 standard AES-256 PDF encryption and decryption.
2. Direct OpenXML Integration: Native generation and parsing of .docx, .xlsx, and .pptx documents without proprietary server dependencies.
3. Client-Side Execution: All files are processed strictly in-browser for zero data leakage.

Technical Compliance
- Standard: ISO/IEC 29500 OpenXML
- Encryption: 256-bit AES Hardware-Accelerated
- Architecture: 100% In-House Clean Code (Zero Unvetted NPM Packages)

Conclusion
Docuzy ensures complete ownership and security over your document workflows.`

export default function WordToPdf() {
  const [docText, setDocText] = useState(SAMPLE_WORD_DOC)
  const [documentTitle, setDocumentTitle] = useState('document.pdf')
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>('a4')
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const baseName = file.name.replace(/\.[^/.]+$/, '')
    setDocumentTitle(`${baseName}.pdf`)
    setError(null)

    try {
      // If it's a docx, we read as text/xml or binary
      const text = await file.text()
      // If text contains word/document.xml markers, strip XML tags
      if (text.includes('<w:document') || text.includes('word/document.xml')) {
        const clean = text
          .replace(/<w:p[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim()
        setDocText(clean || text)
      } else {
        setDocText(text)
      }
    } catch {
      setError('Could not read Word file text.')
    }
  }

  const handleExportPdf = async () => {
    if (!docText.trim()) return
    setIsExporting(true)
    setError(null)

    try {
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      const isA4 = pageSize === 'a4'
      const pageWidth = isA4 ? 595.28 : 612.0
      const pageHeight = isA4 ? 841.89 : 792.0
      const margin = 48
      const availableWidth = pageWidth - margin * 2

      const rawLines = docText.split('\n')
      let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      let currentY = pageHeight - margin

      const fontSize = 10.5
      const headingFontSize = 15
      const lineHeight = fontSize * 1.5

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].trim()
        if (!line) {
          currentY -= lineHeight * 0.75
          continue
        }

        const isHeading =
          i === 0 ||
          line.length < 50 &&
            !line.endsWith('.') &&
            (line.startsWith('Introduction') ||
              line.startsWith('Core') ||
              line.startsWith('Technical') ||
              line.startsWith('Conclusion') ||
              rawLines[i - 1]?.trim() === '')

        const currentFont = isHeading ? fontBold : font
        const currentSize = isHeading ? headingFontSize : fontSize

        // Word wrap long lines
        const words = line.split(' ')
        let currentLineText = ''

        for (const word of words) {
          const testText = currentLineText ? `${currentLineText} ${word}` : word
          const textWidth = currentFont.widthOfTextAtSize(testText, currentSize)

          if (textWidth > availableWidth) {
            // Check page wrap
            if (currentY - lineHeight < margin + 20) {
              currentPage = pdfDoc.addPage([pageWidth, pageHeight])
              currentY = pageHeight - margin
            }

            currentPage.drawText(currentLineText, {
              x: margin,
              y: currentY,
              size: currentSize,
              font: currentFont,
              color: isHeading ? rgb(0.1, 0.1, 0.1) : rgb(0.2, 0.2, 0.2),
            })

            currentY -= isHeading ? lineHeight * 1.6 : lineHeight
            currentLineText = word
          } else {
            currentLineText = testText
          }
        }

        if (currentLineText) {
          if (currentY - lineHeight < margin + 20) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight])
            currentY = pageHeight - margin
          }

          currentPage.drawText(currentLineText, {
            x: margin,
            y: currentY,
            size: currentSize,
            font: currentFont,
            color: isHeading ? rgb(0.1, 0.1, 0.1) : rgb(0.2, 0.2, 0.2),
          })

          currentY -= isHeading ? lineHeight * 1.6 : lineHeight
        }
      }

      // Add page numbering
      const totalPages = pdfDoc.getPageCount()
      for (let p = 0; p < totalPages; p++) {
        const page = pdfDoc.getPage(p)
        const pageStr = `Page ${p + 1} of ${totalPages}`
        const textWidth = font.widthOfTextAtSize(pageStr, 8.5)
        page.drawText(pageStr, {
          x: (pageWidth - textWidth) / 2,
          y: margin - 20,
          size: 8.5,
          font,
          color: rgb(0.5, 0.5, 0.5),
        })
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = documentTitle.endsWith('.pdf') ? documentTitle : `${documentTitle}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Could not export Word document to PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Main Toolbar */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Upload size={14} />
            <span>Open Word (.docx)</span>
          </button>

          <button
            type="button"
            onClick={() => setDocText(SAMPLE_WORD_DOC)}
            className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Load Sample</span>
          </button>

          <button
            type="button"
            onClick={() => setDocText('')}
            className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={14} />
            <span>Clear</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting || !docText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Converting…</span>
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

      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <X size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {/* Workspace Editor */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-6 lg:p-8 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
            <FileText size={16} className="text-blue-600" />
            <span>Document Content</span>
          </div>
          <span className="text-[11px] text-zinc-400">
            {docText.length} characters &bull; {docText.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>

        <textarea
          value={docText}
          onChange={(e) => setDocText(e.target.value)}
          placeholder="Paste or write your document text here…"
          className="w-full h-[500px] p-4 bg-zinc-50/70 border border-zinc-100 rounded-2xl font-serif text-sm leading-relaxed text-zinc-800 resize-none focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none"
        />
      </div>
    </div>
  )
}
