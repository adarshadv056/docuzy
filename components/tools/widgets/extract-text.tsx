'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PageText {
  pageNumber: number
  text: string
  wordCount: number
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function ExtractText() {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<PageText[]>([])
  const [activePage, setActivePage] = useState<number>(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // Search filter inside extracted text
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedPage, setCopiedPage] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalWords = pages.reduce((acc, p) => acc + p.wordCount, 0)
  const fullDocumentText = pages
    .map((p) => `--- Page ${p.pageNumber} ---\n\n${p.text}\n\n`)
    .join('')

  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setFile(selectedFile)
    setIsProcessing(true)
    setPages([])
    setActivePage(1)
    setSearchQuery('')

    try {
      const buffer = await selectedFile.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: buffer }).promise
      const extractedPages: PageText[] = []

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const textContent = await page.getTextContent()

        let lastY: number | null = null
        let pageStr = ''

        for (const item of textContent.items) {
          if ('str' in item) {
            const currentY = item.transform[5]
            if (lastY !== null && Math.abs(currentY - lastY) > 5) {
              pageStr += '\n'
            } else if (pageStr.length > 0 && !pageStr.endsWith(' ') && !pageStr.endsWith('\n')) {
              pageStr += ' '
            }
            pageStr += item.str
            lastY = currentY
          }
        }

        const trimmed = pageStr.trim()
        const words = trimmed ? trimmed.split(/\s+/).length : 0

        extractedPages.push({
          pageNumber: i,
          text: trimmed,
          wordCount: words,
        })
      }

      setPages(extractedPages)
      setIsProcessing(false)
    } catch (err) {
      console.error(err)
      setError('Could not extract text from this PDF. It may be password-protected or contain only scanned images.')
      setIsProcessing(false)
    }
  }, [])

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      loadFile(selectedFile)
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped && dropped.type === 'application/pdf') {
      loadFile(dropped)
    }
  }

  const startOver = () => {
    setFile(null)
    setPages([])
    setError(null)
    setSearchQuery('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const copyToClipboard = (text: string, isFullDoc = false) => {
    navigator.clipboard.writeText(text)
    if (isFullDoc) {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    } else {
      setCopiedPage(true)
      setTimeout(() => setCopiedPage(false), 2000)
    }
  }

  const downloadTextFile = () => {
    if (!file || pages.length === 0) return
    const blob = new Blob([fullDocumentText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}-extracted.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Initial file upload state
  if (!file) {
    return (
      <div>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDraggingFile(true)
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-3xl p-16 text-center transition-all cursor-pointer group ${
            isDraggingFile ? 'border-indigo-500 bg-indigo-50/40' : 'border-zinc-200 hover:border-zinc-400 bg-white'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelection}
            accept="application/pdf"
            className="hidden"
          />
          <div className="space-y-4 max-w-sm mx-auto">
            <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto text-zinc-500 group-hover:scale-110 transition-transform">
              <AlignLeft size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">Select a PDF to extract text</p>
              <p className="text-xs text-zinc-400 mt-1">Copy text out of pages or download as a .txt file</p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 rounded-full text-[11px] font-medium text-zinc-500">
              <Sparkles size={12} className="text-indigo-600" />
              100% private &amp; rendered entirely in your browser
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
            <X size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  const currentPage = pages.find((p) => p.pageNumber === activePage) || pages[0]

  return (
    <div className="space-y-6">
      {/* File summary banner */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate">{file.name}</p>
            <p className="text-xs text-zinc-400">
              {pages.length} page{pages.length === 1 ? '' : 's'} · {totalWords.toLocaleString()} words · {formatSize(file.size)}
            </p>
          </div>
        </div>
        <button
          onClick={startOver}
          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Choose different PDF"
        >
          <X size={18} />
        </button>
      </div>

      {isProcessing ? (
        <div className="bg-white border border-zinc-100 rounded-3xl p-16 text-center shadow-sm space-y-4">
          <Loader2 size={36} className="animate-spin text-indigo-600 mx-auto" />
          <div>
            <p className="text-sm font-bold text-zinc-900">Extracting text from PDF…</p>
            <p className="text-xs text-zinc-400 mt-1">Reading words and formatting across all pages</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-4 bg-white border border-zinc-100 rounded-3xl p-6 shadow-sm space-y-6">
            {/* Quick Actions */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={downloadTextFile}
                className="w-full py-3.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
              >
                <Download size={15} />
                Download Extracted Text (.txt)
              </button>

              <button
                type="button"
                onClick={() => copyToClipboard(fullDocumentText, true)}
                className="w-full py-3 rounded-xl font-semibold text-xs transition-all border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 flex items-center justify-center gap-2"
              >
                {copiedAll ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    Copied All Text!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy Entire Document
                  </>
                )}
              </button>
            </div>

            {/* Document Word Stats */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-100">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[10px] uppercase font-bold text-zinc-400">Total Pages</p>
                <p className="text-base font-bold text-zinc-900 tabular-nums">{pages.length}</p>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[10px] uppercase font-bold text-zinc-400">Total Words</p>
                <p className="text-base font-bold text-zinc-900 tabular-nums">{totalWords.toLocaleString()}</p>
              </div>
            </div>

            {/* Page Navigator List */}
            <div className="space-y-2 pt-3 border-t border-zinc-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Pages</span>
                <span className="text-[11px] text-zinc-400">Click to view page</span>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {pages.map((p) => (
                  <button
                    key={p.pageNumber}
                    type="button"
                    onClick={() => setActivePage(p.pageNumber)}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                      activePage === p.pageNumber
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <span>Page {p.pageNumber}</span>
                    <span
                      className={`text-[10px] font-mono ${
                        activePage === p.pageNumber ? 'text-zinc-300' : 'text-zinc-400'
                      }`}
                    >
                      {p.wordCount} words
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Text Display Column */}
          <div className="lg:col-span-8 bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-4">
            {/* Page Header & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900">
                  Page {currentPage?.pageNumber} of {pages.length}
                </span>
                <span className="text-xs text-zinc-400">({currentPage?.wordCount} words)</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Search bar */}
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Find in page…"
                    className="pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900 w-36 sm:w-48 placeholder:text-zinc-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Copy Page Text Button */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(currentPage?.text || '')}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  {copiedPage ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      Copy Page
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Extracted Text Content Box */}
            <div className="min-h-[440px] max-h-[580px] overflow-y-auto p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100 font-mono text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed select-text">
              {currentPage?.text ? (
                currentPage.text
              ) : (
                <div className="py-20 text-center text-zinc-400 font-sans">
                  <p className="text-xs font-semibold">No text detected on this page.</p>
                  <p className="text-[11px] mt-1">This page might contain only scanned images or illustrations.</p>
                </div>
              )}
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                disabled={activePage <= 1}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={13} />
                Previous Page
              </button>

              <span className="text-xs font-semibold text-zinc-400 tabular-nums">
                Page {activePage} of {pages.length}
              </span>

              <button
                type="button"
                onClick={() => setActivePage((p) => Math.min(pages.length, p + 1))}
                disabled={activePage >= pages.length}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                Next Page
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
