'use client'

import React, { useState, useRef, useCallback } from 'react'
import * as pdfjs from 'pdfjs-dist'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BookMarked,
  Check,
  Copy,
  Download,
  Eye,
  FileCode,
  FileText,
  Loader2,
  RotateCcw,
  Settings2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

// Ensure pdfjs worker is configured
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface PageMarkdown {
  pageNumber: number
  markdown: string
}

function processPageItemsToMarkdown(
  items: any[],
  detectHeadings: boolean,
  detectBold: boolean
): string {
  if (items.length === 0) return ''

  // Filter valid text items
  const textItems = items.filter((item) => item.str && item.str.trim().length > 0)
  if (textItems.length === 0) return ''

  // Calculate median/average font size to calibrate headings
  const fontSizes = textItems.map((item) => Math.abs(item.transform?.[0] || item.height || 12))
  fontSizes.sort((a, b) => a - b)
  const medianSize = fontSizes[Math.floor(fontSizes.length / 2)] || 12

  // Group items by line based on Y coordinate (within 4 points tolerance)
  const lines: { y: number; items: any[] }[] = []

  for (const item of textItems) {
    const y = Math.round(item.transform?.[5] || 0)
    let foundLine = lines.find((l) => Math.abs(l.y - y) <= 4)
    if (!foundLine) {
      foundLine = { y, items: [] }
      lines.push(foundLine)
    }
    foundLine.items.push(item)
  }

  // Sort lines from top of page to bottom (descending Y)
  lines.sort((a, b) => b.y - a.y)

  const mdLines: string[] = []

  for (const line of lines) {
    // Sort items left-to-right (ascending X)
    line.items.sort((a, b) => (a.transform?.[4] || 0) - (b.transform?.[4] || 0))

    let lineText = ''
    let maxFontSizeOnLine = 0
    let isBoldLine = false

    for (const item of line.items) {
      let str = item.str
      const fontSize = Math.abs(item.transform?.[0] || item.height || 12)
      if (fontSize > maxFontSizeOnLine) maxFontSizeOnLine = fontSize

      const fontName = (item.fontName || '').toLowerCase()
      const isBold = fontName.includes('bold') || fontName.includes('heavy') || fontName.includes('black')
      if (isBold) isBoldLine = true

      if (detectBold && isBold && !str.startsWith('**') && str.length > 2) {
        str = `**${str}**`
      }

      lineText += (lineText ? ' ' : '') + str
    }

    lineText = lineText.trim()
    if (!lineText) continue

    // Detect Headings based on font scale relative to median
    if (detectHeadings) {
      if (maxFontSizeOnLine >= medianSize * 1.6) {
        lineText = `# ${lineText.replace(/\*\*/g, '')}`
      } else if (maxFontSizeOnLine >= medianSize * 1.3) {
        lineText = `## ${lineText.replace(/\*\*/g, '')}`
      } else if (maxFontSizeOnLine >= medianSize * 1.15 && isBoldLine) {
        lineText = `### ${lineText.replace(/\*\*/g, '')}`
      }
    }

    // Detect Bullet points
    if (lineText.startsWith('• ') || lineText.startsWith('- ') || lineText.startsWith('* ')) {
      lineText = `- ${lineText.replace(/^[•\-\*]\s*/, '')}`
    }

    mdLines.push(lineText)
  }

  return mdLines.join('\n\n')
}

export default function PdfToMarkdown() {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'done'>('idle')
  const [progressText, setProgressText] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [pageMarkdowns, setPageMarkdowns] = useState<PageMarkdown[]>([])
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Options
  const [detectHeadings, setDetectHeadings] = useState(true)
  const [detectBold, setDetectBold] = useState(true)
  const [includePageDividers, setIncludePageDividers] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processPdf = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile)
      setPhase('parsing')
      setError(null)
      setMarkdown('')
      setPageMarkdowns([])

      try {
        const arrayBuffer = await selectedFile.arrayBuffer()
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          useWorkerFetch: false,
          disableFontFace: true,
        })

        const pdf = await loadingTask.promise
        const totalPages = pdf.numPages
        const pagesData: PageMarkdown[] = []

        for (let p = 1; p <= totalPages; p++) {
          setProgressText(`Converting page ${p} of ${totalPages}…`)
          const page = await pdf.getPage(p)
          const textContent = await page.getTextContent()

          const pageMd = processPageItemsToMarkdown(
            textContent.items,
            detectHeadings,
            detectBold
          )

          pagesData.push({
            pageNumber: p,
            markdown: pageMd,
          })
        }

        setPageMarkdowns(pagesData)

        // Combine all pages with dividers
        const fullMarkdown = pagesData
          .map((p) => {
            if (includePageDividers && totalPages > 1) {
              return `<!-- Page ${p.pageNumber} -->\n${p.markdown}`
            }
            return p.markdown
          })
          .join('\n\n---\n\n')

        setMarkdown(fullMarkdown)
        setPhase('done')
      } catch (err: any) {
        console.error(err)
        setError(err?.message || 'Could not convert this PDF to Markdown.')
        setPhase('idle')
      }
    },
    [detectHeadings, detectBold, includePageDividers]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) processPdf(selected)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped && dropped.type === 'application/pdf') {
      processPdf(dropped)
    }
  }

  const handleCopy = () => {
    if (!markdown) return
    navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!markdown || !file) return
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    a.download = `${baseName}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const startOver = () => {
    setFile(null)
    setMarkdown('')
    setPageMarkdowns([])
    setPhase('idle')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Dropzone */}
      {phase === 'idle' && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 lg:p-14 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-600 bg-indigo-50/50 scale-[0.99]'
              : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
          }`}
        >
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            <BookMarked size={28} />
          </div>

          <h3 className="text-base font-bold text-zinc-900 mb-1">
            Choose a PDF to convert to Markdown
          </h3>
          <p className="text-xs text-zinc-400 mb-5">
            Extract text, auto-detect headings, lists, tables, and export as editable .md
          </p>

          <span className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors">
            <Upload size={14} />
            Browse Files
          </span>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-6 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              Automatic Heading Detection
            </span>
            <span className="flex items-center gap-1.5">
              <FileCode size={14} className="text-indigo-500" />
              Clean GitHub-Flavored Markdown
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-500" />
              100% Client-Side &amp; Private
            </span>
          </div>
        </div>
      )}

      {/* Parsing Progress */}
      {phase === 'parsing' && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-10 text-center space-y-4 shadow-sm">
          <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-900">Converting Document to Markdown</h3>
            <p className="text-xs text-zinc-400">{progressText}</p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <X size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {/* Converted Workspace */}
      {phase === 'done' && (
        <div className="space-y-6">
          {/* Top Control Bar */}
          <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-900 truncate">{file?.name}</p>
                <p className="text-xs text-zinc-400">
                  {pageMarkdowns.length} page{pageMarkdowns.length === 1 ? '' : 's'} · {markdown.length} chars
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center bg-zinc-100 p-1 rounded-xl text-xs font-semibold text-zinc-600">
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                    viewMode === 'preview' ? 'bg-white text-zinc-900 shadow-xs' : 'hover:text-zinc-900'
                  }`}
                >
                  <Eye size={13} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('raw')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                    viewMode === 'raw' ? 'bg-white text-zinc-900 shadow-xs' : 'hover:text-zinc-900'
                  }`}
                >
                  <FileCode size={13} />
                  <span>Markdown Code</span>
                </button>
              </div>

              {/* Copy Action */}
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>

              {/* Download Action */}
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Download size={14} />
                <span>Download .md</span>
              </button>

              {/* Reset */}
              <button
                type="button"
                onClick={startOver}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-colors"
                title="Convert another PDF"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Content Sheet */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 lg:p-10 shadow-sm min-h-[500px]">
            {viewMode === 'preview' ? (
              <div className="prose prose-zinc max-w-none prose-headings:font-bold prose-p:leading-relaxed prose-table:border prose-th:bg-zinc-100 prose-th:p-2 prose-td:p-2 prose-pre:bg-zinc-900 prose-pre:text-zinc-100">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdown || '_No text could be extracted from this PDF._'}
                </ReactMarkdown>
              </div>
            ) : (
              <textarea
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                className="w-full h-[600px] p-4 bg-zinc-50/70 border border-zinc-100 rounded-2xl font-mono text-xs leading-relaxed text-zinc-800 resize-none focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
