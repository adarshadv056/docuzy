'use client'

import React, { useState, useRef } from 'react'

interface CompressionResult {
  originalSize: number
  newSize: number
  savingsPercent: string
}

export default function CompressPDFTool() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<CompressionResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected && selected.type === 'application/pdf') {
      setFile(selected)
      setResult(null)
    }
  }

  const startCompression = async () => {
    if (!file) return
    setIsProcessing(true)

    try {
      const buffer = await file.arrayBuffer()
      const worker = new Worker(new URL('./compress.worker.ts', import.meta.url))

      worker.onmessage = (event) => {
        const { status, compressedBytes, message } = event.data

        if (status === 'success') {
          const original = file.size
          const compressed = compressedBytes.length
          
          setResult({
            originalSize: original,
            newSize: compressed,
            savingsPercent: (((original - compressed) / original) * 100).toFixed(1)
          })

          // Download logic
          const blob = new Blob([compressedBytes], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `docuzy-compressed-${file.name}`
          a.click()
          URL.revokeObjectURL(url)

          setIsProcessing(false)
          worker.terminate()
        } else {
          throw new Error(message)
        }
      }

      worker.postMessage({ buffer }, [buffer] as any)
    } catch (err) {
      console.error(err)
      alert("Compression failed. Try a different file.")
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-20 px-6">
      <div className="text-left mb-10">
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Compress PDF</h1>
        <p className="text-zinc-500 mt-2">Optimize your vault documents for faster sharing.</p>
      </div>

      {!file ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-200 rounded-2xl p-16 text-center hover:border-zinc-400 bg-white transition-all cursor-pointer group"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelection} 
            accept="application/pdf" 
            className="hidden" 
          />
          <div className="space-y-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-500 group-hover:scale-110 transition-transform">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <p className="text-sm font-semibold text-zinc-900">Select file to compress</p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-2xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm font-bold text-zinc-900 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-zinc-400">{formatSize(file.size)}</p>
            </div>
            <button 
              onClick={() => setFile(null)} 
              className="text-xs font-medium text-zinc-400 hover:text-red-500 transition-colors"
            >
              Change File
            </button>
          </div>

          {result && (
            <div className="mb-8 p-4 bg-zinc-50 rounded-xl flex items-center justify-between border border-zinc-100">
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">New Size</p>
                <p className="text-lg font-bold text-zinc-900">{formatSize(result.newSize)}</p>
              </div>
              <div className="text-right">
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
                  -{result.savingsPercent}% Saved
                </span>
              </div>
            </div>
          )}

          <button
            onClick={startCompression}
            disabled={isProcessing}
            className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] ${
              isProcessing 
                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed shadow-none' 
                : 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-200'
            }`}
          >
            {isProcessing ? 'Optimizing Stream...' : 'Compress Document'}
          </button>
        </div>
      )}
    </div>
  )
}