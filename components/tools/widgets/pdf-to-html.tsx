'use client'

import React, { useState, useRef, useCallback } from 'react'
import * as pdfjs from 'pdfjs-dist'
import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  FileCode,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

// Ensure pdfjs worker is configured
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

export default function PdfToHtml() {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'done'>('idle')
  const [progressText, setProgressText] = useState('')
  const [htmlOutput, setHtmlOutput] = useState('')
  const [layoutMode, setLayoutMode] = useState<'semantic' | 'exact'>('semantic')
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processPdf = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile)
      setPhase('parsing')
      setError(null)
      setHtmlOutput('')

      try {
        const arrayBuffer = await selectedFile.arrayBuffer()
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          useWorkerFetch: false,
          disableFontFace: true,
        })

        const pdf = await loadingTask.promise
        const totalPages = pdf.numPages
        const pagesHtml: string[] = []

        for (let p = 1; p <= totalPages; p++) {
          setProgressText(`Converting page ${p} of ${totalPages}…`)
          const page = await pdf.getPage(p)
          const viewport = page.getViewport({ scale: 1.0 })
          const textContent = await page.getTextContent()

          if (layoutMode === 'exact') {
            // Exact layout with absolute positioning
            let pageElements = `<div class="pdf-page" style="position: relative; width: ${viewport.width}px; height: ${viewport.height}px; background: #fff; margin: 20px auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden;">`

            for (const item of textContent.items as any[]) {
              if (!item.str || !item.str.trim()) continue
              const tx = item.transform
              const x = Math.round(tx[4] || 0)
              const y = Math.round(viewport.height - (tx[5] || 0))
              const fontSize = Math.round(Math.abs(tx[0] || item.height || 12))
              const fontName = item.fontName || 'sans-serif'
              const isBold = fontName.toLowerCase().includes('bold')

              pageElements += `<span style="position: absolute; left: ${x}px; top: ${y - fontSize}px; font-size: ${fontSize}px; font-family: sans-serif; font-weight: ${isBold ? 'bold' : 'normal'}; color: #111; white-space: pre;">${item.str}</span>\n`
            }

            pageElements += `</div>`
            pagesHtml.push(pageElements)
          } else {
            // Semantic flow text
            let semanticPage = `<article class="pdf-page-content" style="margin-bottom: 40px; padding: 24px; background: #fff; border-radius: 8px;">\n`
            semanticPage += `<div style="font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: 700; margin-bottom: 12px;">Page ${p} of ${totalPages}</div>\n`

            // Group by line Y
            const lines: { y: number; text: string; maxFont: number }[] = []
            for (const item of textContent.items as any[]) {
              if (!item.str || !item.str.trim()) continue
              const y = Math.round(item.transform?.[5] || 0)
              const fontSize = Math.abs(item.transform?.[0] || item.height || 12)
              let line = lines.find((l) => Math.abs(l.y - y) <= 4)
              if (!line) {
                line = { y, text: '', maxFont: fontSize }
                lines.push(line)
              }
              line.text += (line.text ? ' ' : '') + item.str.trim()
              if (fontSize > line.maxFont) line.maxFont = fontSize
            }

            lines.sort((a, b) => b.y - a.y)

            for (const line of lines) {
              if (line.maxFont >= 18) {
                semanticPage += `<h1 style="font-size: 22px; color: #111827; margin: 16px 0 8px 0;">${line.text}</h1>\n`
              } else if (line.maxFont >= 14) {
                semanticPage += `<h2 style="font-size: 17px; color: #1f2937; margin: 14px 0 6px 0;">${line.text}</h2>\n`
              } else {
                semanticPage += `<p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 10px 0;">${line.text}</p>\n`
              }
            }

            semanticPage += `</article>`
            pagesHtml.push(semanticPage)
          }
        }

        const fullDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${selectedFile.name.replace(/\.[^/.]+$/, '')}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f3f4f6;
      margin: 0;
      padding: 30px 15px;
    }
    .pdf-container {
      max-width: 900px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="pdf-container">
    ${pagesHtml.join('\n\n')}
  </div>
</body>
</html>`

        setHtmlOutput(fullDocument)
        setPhase('done')
      } catch (err: any) {
        console.error(err)
        setError(err?.message || 'Could not convert this PDF to HTML.')
        setPhase('idle')
      }
    },
    [layoutMode]
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
    if (!htmlOutput) return
    navigator.clipboard.writeText(htmlOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!htmlOutput || !file) return
    const blob = new Blob([htmlOutput], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    a.download = `${baseName}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const startOver = () => {
    setFile(null)
    setHtmlOutput('')
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
            <FileCode size={28} />
          </div>

          <h3 className="text-base font-bold text-zinc-900 mb-1">
            Choose a PDF to convert to HTML
          </h3>
          <p className="text-xs text-zinc-400 mb-5">
            Transform PDF pages into standalone, responsive HTML5 documents with CSS styling
          </p>

          <span className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors">
            <Upload size={14} />
            Browse Files
          </span>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-6 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              Semantic Flow or Exact Positioning
            </span>
            <span className="flex items-center gap-1.5">
              <Code2 size={14} className="text-indigo-500" />
              Clean Self-Contained HTML5
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-500" />
              100% In-Browser &amp; Private
            </span>
          </div>
        </div>
      )}

      {/* Parsing Progress */}
      {phase === 'parsing' && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-10 text-center space-y-4 shadow-sm">
          <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-900">Converting Document to HTML</h3>
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

      {/* Result Workspace */}
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
                  HTML5 Webpage &bull; {htmlOutput.length} characters
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Layout Mode */}
              <select
                value={layoutMode}
                onChange={(e) => {
                  setLayoutMode(e.target.value as any)
                  if (file) processPdf(file)
                }}
                className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none cursor-pointer"
              >
                <option value="semantic">Semantic Flow (Responsive)</option>
                <option value="exact">Exact Pixel Layout</option>
              </select>

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
                  onClick={() => setViewMode('code')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                    viewMode === 'code' ? 'bg-white text-zinc-900 shadow-xs' : 'hover:text-zinc-900'
                  }`}
                >
                  <Code2 size={13} />
                  <span>HTML Code</span>
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
                <span>Download HTML</span>
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

          {/* View Container */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm min-h-[500px]">
            {viewMode === 'preview' ? (
              <iframe
                title="HTML Preview"
                srcDoc={htmlOutput}
                className="w-full h-[650px] border-0 rounded-2xl bg-zinc-50"
              />
            ) : (
              <textarea
                readOnly
                value={htmlOutput}
                className="w-full h-[650px] p-4 bg-zinc-50/70 border border-zinc-100 rounded-2xl font-mono text-xs leading-relaxed text-zinc-800 resize-none outline-none"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
