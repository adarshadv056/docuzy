'use client'

import React, { useState, useRef, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { toPng } from 'html-to-image'
import { fetchWebpage } from '@/actions/fetch-webpage'
import {
  AlertCircle,
  Check,
  Download,
  Earth,
  Globe,
  Loader2,
  Monitor,
  Printer,
  RotateCcw,
  Smartphone,
  Sparkles,
  Tablet,
  Upload,
  X,
} from 'lucide-react'

type PageFormat = 'continuous' | 'a4' | 'letter'
type ViewportSize = 'desktop' | 'tablet' | 'mobile'

const SAMPLE_URLS = [
  { label: 'Wikipedia: AI', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' },
  { label: 'Hacker News', url: 'https://news.ycombinator.com' },
  { label: 'Example Domain', url: 'https://example.com' },
]

export default function WebpageToPdf() {
  const [urlInput, setUrlInput] = useState('')
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [pageTitle, setPageTitle] = useState<string>('webpage')
  const [sourceUrl, setSourceUrl] = useState<string>('')

  // Settings
  const [pageFormat, setPageFormat] = useState<PageFormat>('continuous')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [viewport, setViewport] = useState<ViewportSize>('desktop')
  const [includeHeaderFooter, setIncludeHeaderFooter] = useState(true)

  // Status
  const [isFetching, setIsFetching] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultBlobUrl, setResultBlobUrl] = useState<string | null>(null)
  const [resultSize, setResultSize] = useState<number | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clean up blob URLs
  useEffect(() => {
    return () => {
      if (resultBlobUrl) URL.revokeObjectURL(resultBlobUrl)
    }
  }, [resultBlobUrl])

  const handleFetchUrl = async (urlToFetch?: string) => {
    const target = (urlToFetch || urlInput).trim()
    if (!target) {
      setError('Please enter a website URL.')
      return
    }

    setIsFetching(true)
    setError(null)
    if (resultBlobUrl) URL.revokeObjectURL(resultBlobUrl)
    setResultBlobUrl(null)
    setResultSize(null)

    try {
      const res = await fetchWebpage(target)
      if (!res.success || !res.html) {
        setError(res.error || 'Failed to fetch webpage.')
        setIsFetching(false)
        return
      }

      setHtmlContent(res.html)
      setPageTitle(res.title || 'webpage')
      setSourceUrl(res.url || target)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Error loading webpage.')
    } finally {
      setIsFetching(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const baseName = file.name.replace(/\.[^/.]+$/, '')
    setPageTitle(baseName)
    setSourceUrl(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        setHtmlContent(content)
        setError(null)
      }
    }
    reader.readAsText(file)
  }

  const handleNativePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus()
      iframeRef.current.contentWindow.print()
    }
  }

  const handleExportPdf = async () => {
    const iframe = iframeRef.current
    const iframeDoc = iframe?.contentDocument
    if (!iframe || !iframeDoc || !iframeDoc.body) {
      setError('Preview is not ready yet. Please wait for the page to render.')
      return
    }

    setIsExporting(true)
    setProgressText('Rendering webpage layout…')
    setError(null)

    // Calculate full document dimensions
    const scrollHeight = Math.max(
      iframeDoc.body.scrollHeight,
      iframeDoc.documentElement.scrollHeight,
      650
    )
    const scrollWidth = Math.max(
      iframeDoc.body.scrollWidth,
      iframeDoc.documentElement.scrollWidth,
      800
    )

    // Temporarily expand iframe height so full document is active
    const origHeight = iframe.style.height
    iframe.style.height = `${scrollHeight}px`

    try {
      // Capture PNG with skipFonts: true to prevent insertRule SyntaxError on Tailwind v4 CSS
      const dataUrl = await toPng(iframeDoc.body, {
        pixelRatio: 1.5,
        backgroundColor: '#ffffff',
        skipFonts: true,
        cacheBust: false,
        width: scrollWidth,
        height: scrollHeight,
        filter: (node) => {
          const tag = (node as HTMLElement)?.tagName?.toLowerCase()
          return tag !== 'script' && tag !== 'noscript'
        },
      })

      setProgressText('Compiling PDF document…')

      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve) => (img.onload = resolve))

      const imgWidth = img.width
      const imgHeight = img.height

      const pdfDoc = await PDFDocument.create()
      const embeddedImage = await pdfDoc.embedPng(dataUrl)

      if (pageFormat === 'continuous') {
        // Continuous Long Page (Full capture without page cuts)
        const pdfWidth = 792 // Standard 11-inch equivalent width
        const scale = pdfWidth / imgWidth
        const pdfHeight = Math.max(300, imgHeight * scale)

        const page = pdfDoc.addPage([pdfWidth, pdfHeight])
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: pdfWidth,
          height: pdfHeight,
        })

        if (includeHeaderFooter) {
          try {
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
            const stampText = `Captured by Docuzy • ${sourceUrl || 'Webpage'} • ${new Date().toLocaleDateString()}`
            page.drawText(stampText, {
              x: 24,
              y: 16,
              size: 9,
              font,
              color: rgb(0.4, 0.4, 0.45),
            })
          } catch {
            // stamp is optional
          }
        }
      } else {
        // Paginated A4 or US Letter
        const isA4 = pageFormat === 'a4'
        const baseWidth = isA4 ? 595.28 : 612.0
        const baseHeight = isA4 ? 841.89 : 792.0

        const pdfWidth = orientation === 'portrait' ? baseWidth : baseHeight
        const pdfHeight = orientation === 'portrait' ? baseHeight : baseWidth

        const margin = includeHeaderFooter ? 36 : 18
        const printableWidth = pdfWidth - margin * 2
        const printableHeight = pdfHeight - margin * 2

        const scale = printableWidth / imgWidth
        const scaledTotalHeight = imgHeight * scale

        const numPages = Math.ceil(scaledTotalHeight / printableHeight) || 1
        const font = includeHeaderFooter ? await pdfDoc.embedFont(StandardFonts.Helvetica) : null

        for (let p = 0; p < numPages; p++) {
          setProgressText(`Generating page ${p + 1} of ${numPages}…`)
          const page = pdfDoc.addPage([pdfWidth, pdfHeight])
          const sliceYInPoints = p * printableHeight

          page.drawImage(embeddedImage, {
            x: margin,
            y: pdfHeight - margin - scaledTotalHeight + sliceYInPoints,
            width: printableWidth,
            height: scaledTotalHeight,
          })

          if (includeHeaderFooter && font) {
            // Header: Page Title
            page.drawText((pageTitle || 'Webpage').slice(0, 60), {
              x: margin,
              y: pdfHeight - 24,
              size: 8,
              font,
              color: rgb(0.4, 0.4, 0.45),
            })

            // Footer: URL and page count
            const footerText = `${sourceUrl ? sourceUrl.slice(0, 50) + ' • ' : ''}Page ${p + 1} of ${numPages}`
            page.drawText(footerText, {
              x: margin,
              y: 16,
              size: 8,
              font,
              color: rgb(0.4, 0.4, 0.45),
            })
          }
        }
      }

      setProgressText('Finalizing…')
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      setResultBlobUrl(url)
      setResultSize(blob.size)

      // Trigger download
      const a = document.createElement('a')
      a.href = url
      let cleanFilename = pageTitle.trim().replace(/[^a-zA-Z0-9_\- ]/g, '') || 'webpage'
      if (!cleanFilename.toLowerCase().endsWith('.pdf')) cleanFilename += '.pdf'
      a.download = cleanFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: any) {
      console.error('Export error:', err)
      setError(
        'Canvas capture encountered restricted external assets. You can also use "Print Page" to save as a native vector PDF.'
      )
    } finally {
      if (iframe) {
        iframe.style.height = origHeight
      }
      setIsExporting(false)
      setProgressText('')
    }
  }

  const handleReset = () => {
    setHtmlContent('')
    setUrlInput('')
    setSourceUrl('')
    setPageTitle('webpage')
    if (resultBlobUrl) URL.revokeObjectURL(resultBlobUrl)
    setResultBlobUrl(null)
    setResultSize(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Top URL Input Bar */}
      <div className="p-5 border border-zinc-200 rounded-2xl bg-white shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <Earth className="w-4 h-4 text-indigo-500" />
            </div>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFetchUrl()
              }}
              placeholder="Enter URL (e.g. https://en.wikipedia.org/wiki/Artificial_intelligence)"
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFetchUrl()}
              disabled={isFetching || !urlInput.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 shrink-0"
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching…
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  Fetch Page
                </>
              )}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload local HTML file"
              className="p-2.5 border border-zinc-200 hover:bg-zinc-50 rounded-xl text-zinc-600 transition-colors shrink-0"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Quick sample URLs */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-500">
          <span className="text-zinc-400">Try an example:</span>
          {SAMPLE_URLS.map((s) => (
            <button
              key={s.url}
              onClick={() => {
                setUrlInput(s.url)
                handleFetchUrl(s.url)
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-medium transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Download Banner */}
      {resultBlobUrl && (
        <div className="p-4 border border-emerald-200 bg-emerald-50 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">PDF created successfully!</p>
              <p className="text-xs text-emerald-700">
                {resultSize ? `${(resultSize / 1024).toFixed(1)} KB • ` : ''}Saved as{' '}
                {pageFormat === 'continuous' ? 'Continuous Long Page' : 'Paginated Document'}.
              </p>
            </div>
          </div>
          <a
            href={resultBlobUrl}
            download={`${pageTitle || 'webpage'}.pdf`}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Download Again
          </a>
        </div>
      )}

      {/* Controls Bar & Layout Options */}
      {htmlContent && (
        <div className="p-4 border border-zinc-200 rounded-2xl bg-white shadow-sm flex flex-wrap items-center justify-between gap-4">
          {/* Format selection */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => setPageFormat('continuous')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  pageFormat === 'continuous'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Continuous (Full Page)
              </button>
              <button
                type="button"
                onClick={() => setPageFormat('a4')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  pageFormat === 'a4'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Paginated (A4)
              </button>
              <button
                type="button"
                onClick={() => setPageFormat('letter')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  pageFormat === 'letter'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                US Letter
              </button>
            </div>

            {/* Viewport switch */}
            <div className="inline-flex rounded-xl bg-zinc-100 p-1 items-center gap-0.5">
              <button
                type="button"
                onClick={() => setViewport('desktop')}
                title="Desktop View (Full Width)"
                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium ${
                  viewport === 'desktop'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setViewport('tablet')}
                title="Tablet View (768px)"
                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium ${
                  viewport === 'tablet'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <Tablet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tablet</span>
              </button>
              <button
                type="button"
                onClick={() => setViewport('mobile')}
                title="Mobile View (390px)"
                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium ${
                  viewport === 'mobile'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>

            {/* Orientation for Paginated */}
            {pageFormat !== 'continuous' && (
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                className="text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={handleNativePrint}
              title="Print directly or save as vector PDF"
              className="px-3.5 py-2 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Page
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {progressText || 'Capturing…'}
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Save as PDF
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Render Workspace & Isolated Iframe Preview */}
      {htmlContent && (
        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm">
          {/* Browser address bar mockup */}
          <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs text-zinc-500 select-none">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              </div>
              <span className="ml-2 font-mono text-[11px] text-zinc-600 truncate">
                {sourceUrl || 'https://webpage.preview'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 shrink-0">
              <span className="font-semibold uppercase text-[10px] tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {viewport}
              </span>
            </div>
          </div>

          {/* Iframe Viewport Container: Fills 100% in Desktop, centers in Tablet/Mobile */}
          <div className="p-3 bg-zinc-100 flex justify-center overflow-x-auto min-h-[500px]">
            <div
              className={`transition-all duration-300 bg-white shadow-md rounded-xl overflow-hidden ${
                viewport === 'mobile'
                  ? 'w-[390px]'
                  : viewport === 'tablet'
                  ? 'w-[768px]'
                  : 'w-full'
              }`}
            >
              <iframe
                ref={iframeRef}
                title="Webpage Preview"
                srcDoc={htmlContent}
                sandbox="allow-same-origin allow-scripts"
                className="w-full h-[650px] border-0 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!htmlContent && !isFetching && (
        <div className="border-2 border-dashed border-zinc-300 rounded-2xl p-12 text-center bg-white shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Globe className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-1">
            Convert any live Webpage to PDF
          </h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-4">
            Enter any public website URL above or click an example to convert articles, documentation, news, or receipts into high-resolution PDFs.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 text-xs text-zinc-600">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Supports Continuous Full-Page Capture and Paginated A4/Letter
          </div>
        </div>
      )}
    </div>
  )
}
