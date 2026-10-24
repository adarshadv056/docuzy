'use client'

import React, { useCallback, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import {
  AlertTriangle,
  Calendar,
  Check,
  Download,
  FileText,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  User,
  Wrench,
  X,
} from 'lucide-react'

interface MetadataState {
  title: string
  author: string
  subject: string
  keywords: string
  creator: string
  producer: string
  creationDate?: Date
  modificationDate?: Date
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

export default function PdfMetadata() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pageCount, setPageCount] = useState(0)

  // Metadata fields
  const [metadata, setMetadata] = useState<MetadataState>({
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
  })

  // Status & Export
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{
    bytes: Uint8Array
    originalSize: number
    newSize: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')

    try {
      const buffer = await selectedFile.arrayBuffer()
      const pdf = await PDFDocument.load(buffer.slice(0), {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      })

      setSourceBuffer(buffer)
      setFile(selectedFile)
      setPageCount(pdf.getPageCount())

      // Read existing metadata
      const rawKeywords = pdf.getKeywords()
      const keywordsStr = Array.isArray(rawKeywords) ? rawKeywords.join(', ') : rawKeywords || ''

      setMetadata({
        title: pdf.getTitle() || '',
        author: pdf.getAuthor() || '',
        subject: pdf.getSubject() || '',
        keywords: keywordsStr,
        creator: pdf.getCreator() || '',
        producer: pdf.getProducer() || '',
        creationDate: pdf.getCreationDate(),
        modificationDate: pdf.getModificationDate(),
      })
    } catch (err) {
      console.error(err)
      setError('Could not open this PDF. It may be password-protected or corrupted.')
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
    setSourceBuffer(null)
    setMetadata({
      title: '',
      author: '',
      subject: '',
      keywords: '',
      creator: '',
      producer: '',
    })
    setPhase('idle')
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Clear all metadata (Privacy Scrub)
  const clearAllMetadata = () => {
    setMetadata({
      title: '',
      author: '',
      subject: '',
      keywords: '',
      creator: '',
      producer: '',
    })
  }

  // Save updated metadata
  const saveMetadata = async () => {
    if (!file || !sourceBuffer) return
    setPhase('working')
    setError(null)

    try {
      const pdf = await PDFDocument.load(sourceBuffer.slice(0), {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      })

      // Update fields
      pdf.setTitle(metadata.title.trim())
      pdf.setAuthor(metadata.author.trim())
      pdf.setSubject(metadata.subject.trim())

      const parsedKeywords = metadata.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
      pdf.setKeywords(parsedKeywords)

      pdf.setCreator(metadata.creator.trim())
      pdf.setProducer(metadata.producer.trim())
      pdf.setModificationDate(new Date())

      const bytes = await pdf.save()
      setResult({
        bytes,
        originalSize: file.size,
        newSize: bytes.byteLength,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not save PDF metadata. Please check the fields and try again.')
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `updated-${file.name}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Done phase
  if (phase === 'done' && result) {
    return (
      <div className="bg-white border border-zinc-100 rounded-3xl p-8 shadow-sm max-w-xl mx-auto">
        <div className="mb-6 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100/60">
            <Check size={28} className="text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Metadata Updated!</h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            Your document properties and privacy tags have been saved into the PDF.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Original Size</p>
            <p className="text-base font-semibold text-zinc-600 tabular-nums">{formatSize(result.originalSize)}</p>
          </div>
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Updated PDF</p>
            <p className="text-base font-bold text-zinc-900 tabular-nums">{formatSize(result.newSize)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={downloadResult}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download Updated PDF
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('idle')}
              className="flex-1 py-3 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl transition-colors"
            >
              Continue Editing
            </button>
            <button
              onClick={startOver}
              className="flex-1 py-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={14} />
              Start Over
            </button>
          </div>
        </div>
      </div>
    )
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
              <Tags size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">Select a PDF to view &amp; edit metadata</p>
              <p className="text-xs text-zinc-400 mt-1">Change author, title, keywords, or scrub personal data</p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 rounded-full text-[11px] font-medium text-zinc-500">
              <Sparkles size={12} className="text-indigo-600" />
              100% private &amp; processed locally in your browser
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

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
              {pageCount} page{pageCount === 1 ? '' : 's'} · {formatSize(file.size)}
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

      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-8 bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Document Properties</h3>
              <p className="text-xs text-zinc-400">Edit document description and metadata headers</p>
            </div>
            <button
              type="button"
              onClick={clearAllMetadata}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 active:scale-95"
              title="Remove all metadata for maximum privacy"
            >
              <Trash2 size={13} />
              Scrub All Metadata
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="meta-title" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                Document Title
              </label>
              <input
                id="meta-title"
                type="text"
                value={metadata.title}
                onChange={(e) => setMetadata((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Annual Financial Report 2026"
                className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            </div>

            {/* Author */}
            <div className="space-y-1.5">
              <label htmlFor="meta-author" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                Author / Organization
              </label>
              <input
                id="meta-author"
                type="text"
                value={metadata.author}
                onChange={(e) => setMetadata((prev) => ({ ...prev, author: e.target.value }))}
                placeholder="e.g. Acme Corp / John Doe"
                className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label htmlFor="meta-subject" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                Subject
              </label>
              <input
                id="meta-subject"
                type="text"
                value={metadata.subject}
                onChange={(e) => setMetadata((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="e.g. Audited Quarterly Earnings"
                className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            </div>

            {/* Keywords */}
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="meta-keywords" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                Keywords (Comma Separated)
              </label>
              <input
                id="meta-keywords"
                type="text"
                value={metadata.keywords}
                onChange={(e) => setMetadata((prev) => ({ ...prev, keywords: e.target.value }))}
                placeholder="e.g. finance, 2026, confidential, report"
                className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            </div>

            {/* Creator Application */}
            <div className="space-y-1.5">
              <label htmlFor="meta-creator" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                Creator / Application
              </label>
              <input
                id="meta-creator"
                type="text"
                value={metadata.creator}
                onChange={(e) => setMetadata((prev) => ({ ...prev, creator: e.target.value }))}
                placeholder="e.g. Microsoft Word / Docuzy"
                className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            </div>

            {/* Producer / PDF Engine */}
            <div className="space-y-1.5">
              <label htmlFor="meta-producer" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                Producer / PDF Engine
              </label>
              <input
                id="meta-producer"
                type="text"
                value={metadata.producer}
                onChange={(e) => setMetadata((prev) => ({ ...prev, producer: e.target.value }))}
                placeholder="e.g. pdf-lib / macOS Quartz"
                className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={saveMetadata}
            disabled={phase === 'working'}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {phase === 'working' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Updating Document Properties…
              </>
            ) : (
              <>
                <Check size={16} />
                Save &amp; Apply Metadata
              </>
            )}
          </button>
        </div>

        {/* Right Column: Privacy & Info Sidebar */}
        <div className="lg:col-span-4 bg-zinc-50/70 border border-zinc-100 rounded-3xl p-6 space-y-5">
          <div className="flex items-center gap-2 text-zinc-900">
            <ShieldCheck size={20} className="text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Privacy &amp; Security</h4>
          </div>

          <div className="space-y-3 text-xs text-zinc-600 leading-relaxed">
            <p>
              PDF files often contain hidden metadata such as author full names, organization usernames, software
              builds, and exact editing timestamps.
            </p>
            <p>
              Use <strong>Scrub All Metadata</strong> before sharing documents externally or submitting court filings
              to ensure no personal or corporate tracking data leaks.
            </p>
          </div>

          {metadata.creationDate && (
            <div className="pt-3 border-t border-zinc-200/80 space-y-2 text-[11px]">
              <div className="flex items-center justify-between text-zinc-500">
                <span>Created On:</span>
                <span className="font-mono text-zinc-700">{metadata.creationDate.toLocaleDateString()}</span>
              </div>
              {metadata.modificationDate && (
                <div className="flex items-center justify-between text-zinc-500">
                  <span>Last Modified:</span>
                  <span className="font-mono text-zinc-700">{metadata.modificationDate.toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
