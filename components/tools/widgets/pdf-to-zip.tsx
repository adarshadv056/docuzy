'use client'

import React, { useState, useRef, useCallback } from 'react'
import { createZip, ZipEntry } from '@/lib/zip/zip-native'
import {
  Archive,
  Download,
  FileArchive,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react'

interface UploadedPdfItem {
  id: string
  file: File
  name: string
  size: number
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function PdfToZip() {
  const [items, setItems] = useState<UploadedPdfItem[]>([])
  const [archiveName, setArchiveName] = useState('documents.zip')
  const [compressionMode, setCompressionMode] = useState<'deflate' | 'store'>('deflate')

  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{
    zipBytes: Uint8Array
    originalSize: number
    compressedSize: number
    filename: string
    fileCount: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const addMoreInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((files: FileList | File[]) => {
    setError(null)
    const validPdfs: UploadedPdfItem[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        validPdfs.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
        })
      }
    }

    if (validPdfs.length === 0) {
      setError('Please select valid PDF files.')
      return
    }

    setItems((prev) => {
      const updated = [...prev, ...validPdfs]
      // Set default archive name based on first file
      if (prev.length === 0 && validPdfs.length > 0) {
        const base = validPdfs[0].name.replace(/\.[^/.]+$/, '')
        setArchiveName(validPdfs.length === 1 ? `${base}.zip` : `${base}-bundle.zip`)
      }
      return updated
    })
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (addMoreInputRef.current) addMoreInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const clearAll = () => {
    setItems([])
    setResult(null)
    setPhase('idle')
    setError(null)
  }

  const totalInputSize = items.reduce((sum, item) => sum + item.size, 0)

  const handleCreateZip = async () => {
    if (items.length === 0) return
    setPhase('working')
    setError(null)

    try {
      const entries: ZipEntry[] = []
      const usedNames = new Set<string>()

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        let fileName = item.name.trim() || `document-${i + 1}.pdf`
        if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf'

        // Handle duplicate file names in archive
        let uniqueName = fileName
        let count = 1
        while (usedNames.has(uniqueName)) {
          const parts = fileName.split('.pdf')
          uniqueName = `${parts[0]} (${count}).pdf`
          count++
        }
        usedNames.add(uniqueName)

        const buffer = await item.file.arrayBuffer()
        entries.push({
          name: uniqueName,
          data: new Uint8Array(buffer),
        })
      }

      const zipBytes = await createZip(entries, { compression: compressionMode })

      let finalName = archiveName.trim() || 'documents.zip'
      if (!finalName.toLowerCase().endsWith('.zip')) finalName += '.zip'

      setResult({
        zipBytes,
        originalSize: totalInputSize,
        compressedSize: zipBytes.byteLength,
        filename: finalName,
        fileCount: items.length,
      })
      setPhase('done')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Could not package PDF files into a ZIP archive.')
      setPhase('idle')
    }
  }

  const handleDownload = () => {
    if (!result) return
    const blob = new Blob([result.zipBytes as BlobPart], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const startOver = () => {
    setItems([])
    setResult(null)
    setPhase('idle')
    setError(null)
    setArchiveName('documents.zip')
  }

  const savingsPercent = result
    ? Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={addMoreInputRef}
        type="file"
        multiple
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Dropzone */}
      {items.length === 0 && phase === 'idle' && (
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
            <FileArchive size={28} />
          </div>

          <h3 className="text-base font-bold text-zinc-900 mb-1">
            Choose PDF files to compress into ZIP
          </h3>
          <p className="text-xs text-zinc-400 mb-5">
            Select one or multiple PDF documents to bundle into a single compressed ZIP archive
          </p>

          <span className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors">
            <Upload size={14} />
            Browse Files
          </span>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-6 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              Native Deflate Compression
            </span>
            <span className="flex items-center gap-1.5">
              <Zap size={14} className="text-indigo-500" />
              100% In-Browser &amp; Private
            </span>
            <span className="flex items-center gap-1.5">
              <Archive size={14} className="text-emerald-500" />
              Universal ZIP Compatibility
            </span>
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

      {/* Workspace View */}
      {items.length > 0 && phase !== 'done' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                {items.length} PDF Document{items.length === 1 ? '' : 's'} Selected
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Total size: {formatSize(totalInputSize)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addMoreInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} />
                <span>Add More</span>
              </button>

              <button
                type="button"
                onClick={clearAll}
                className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Clear all files"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Files List */}
          <div className="bg-white border border-zinc-100 rounded-3xl p-5 shadow-sm space-y-2.5 max-h-96 overflow-y-auto">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-center text-xs font-bold text-zinc-400 shrink-0">
                    {index + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 truncate">{item.name}</p>
                    <p className="text-[10px] text-zinc-400">{formatSize(item.size)}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  title="Remove this PDF"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Archive Configuration Card */}
          <div className="bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Archive Options
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Archive Name Input */}
              <div className="space-y-1.5">
                <label htmlFor="zip-name" className="text-xs font-semibold text-zinc-700">
                  ZIP File Name
                </label>
                <input
                  id="zip-name"
                  type="text"
                  value={archiveName}
                  onChange={(e) => setArchiveName(e.target.value)}
                  placeholder="documents.zip"
                  className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-zinc-900 outline-none"
                />
              </div>

              {/* Compression Mode */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-700">Compression Mode</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCompressionMode('deflate')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                      compressionMode === 'deflate'
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                        : 'border-zinc-100 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    <p>Deflate</p>
                    <p className={`text-[10px] font-normal mt-0.5 ${compressionMode === 'deflate' ? 'text-zinc-300' : 'text-zinc-400'}`}>
                      Smallest size
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompressionMode('store')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                      compressionMode === 'store'
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                        : 'border-zinc-100 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    <p>Store</p>
                    <p className={`text-[10px] font-normal mt-0.5 ${compressionMode === 'store' ? 'text-zinc-300' : 'text-zinc-400'}`}>
                      Instant packaging
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Package Action Button */}
            <button
              type="button"
              onClick={handleCreateZip}
              disabled={phase === 'working' || items.length === 0}
              className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-50"
            >
              {phase === 'working' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Packaging &amp; Compressing ZIP…</span>
                </>
              ) : (
                <>
                  <Archive size={16} />
                  <span>Package {items.length} PDF{items.length === 1 ? '' : 's'} into ZIP</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Card */}
      {phase === 'done' && result && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FileArchive size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">ZIP Archive Created Successfully</h3>
              <p className="text-xs text-zinc-400">
                {result.fileCount} PDF document{result.fileCount === 1 ? '' : 's'} bundled into {result.filename}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-xs">
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-bold">Files Bundled</p>
              <p className="font-semibold text-zinc-700 mt-0.5">{result.fileCount} PDFs</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-bold">Uncompressed Size</p>
              <p className="font-semibold text-zinc-700 mt-0.5">{formatSize(result.originalSize)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-bold">ZIP Archive Size</p>
              <p className="font-semibold text-emerald-700 mt-0.5">
                {formatSize(result.compressedSize)}
                {savingsPercent > 0 && ` (${savingsPercent}% saved)`}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <Download size={15} />
              <span>Download {result.filename}</span>
            </button>
            <button
              onClick={startOver}
              className="py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw size={15} />
              <span>Package Another</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
