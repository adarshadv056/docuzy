'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import * as pdfjs from 'pdfjs-dist'
import {
  createEpub,
  type EpubChapter,
  type EpubMetadata,
  type EpubTheme,
} from '@/lib/ebook/epub-native'
import {
  BookMarked,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Layers,
  Library,
  Loader2,
  RotateCcw,
  Sliders,
  Sparkles,
  Upload,
  User,
  Wand2,
  X,
} from 'lucide-react'

if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface ParsedPageData {
  pageNumber: number
  text: string
  lines: Array<{
    text: string
    fontSize: number
    isBold: boolean
    y: number
  }>
}

type ChapterStrategy = 'smart' | 'pages' | 'continuous'

export default function PdfToEbook() {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'ready' | 'generating'>('idle')
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Book metadata
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [publisher, setPublisher] = useState('Docuzy Books')
  const [language, setLanguage] = useState('en')
  const [description, setDescription] = useState('')

  // Conversion options
  const [chapterStrategy, setChapterStrategy] = useState<ChapterStrategy>('smart')
  const [theme, setTheme] = useState<EpubTheme>('classic')
  const [includeCover, setIncludeCover] = useState(true)
  const [filterRunningHeaders, setFilterRunningHeaders] = useState(true)

  // Extracted data
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null)
  const [coverBytes, setCoverBytes] = useState<Uint8Array | null>(null)
  const [parsedPages, setParsedPages] = useState<ParsedPageData[]>([])
  const [chapters, setChapters] = useState<EpubChapter[]>([])
  const [selectedChapterIdx, setSelectedChapterIdx] = useState(0)
  const [previewTab, setPreviewTab] = useState<'reader' | 'toc' | 'raw'>('reader')

  // Export state
  const [epubBlobUrl, setEpubBlobUrl] = useState<string | null>(null)
  const [epubFileSize, setEpubFileSize] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clean up blob URLs
  useEffect(() => {
    return () => {
      if (epubBlobUrl) URL.revokeObjectURL(epubBlobUrl)
    }
  }, [epubBlobUrl])

  // Build chapters from parsed pages and user strategy
  const rebuildChapters = useCallback(
    (pages: ParsedPageData[], strategy: ChapterStrategy, filterHeaders: boolean) => {
      if (pages.length === 0) {
        setChapters([])
        return
      }

      const generatedChapters: EpubChapter[] = []

      if (strategy === 'pages') {
        // Strategy 1: Each PDF page is a chapter
        for (const p of pages) {
          const linesToUse = filterHeaders
            ? p.lines.filter((l, idx) => {
                // Heuristic: drop first line if very short / looks like header, drop last line if looks like page number
                if (idx === 0 && l.text.length < 40 && p.lines.length > 2) return false
                if (idx === p.lines.length - 1 && /^\d+$/.test(l.text.trim())) return false
                return true
              })
            : p.lines

          const paragraphsHtml = linesToUse
            .map((l) => {
              if (l.fontSize >= 16 || l.isBold) {
                return `<h2>${escapeHtml(l.text)}</h2>`
              }
              return `<p>${escapeHtml(l.text)}</p>`
            })
            .join('\n')

          generatedChapters.push({
            id: `page-${p.pageNumber}`,
            title: `Page ${p.pageNumber}`,
            contentHtml: paragraphsHtml || '<p><em>Empty page</em></p>',
          })
        }
      } else if (strategy === 'continuous') {
        // Strategy 2: One continuous flow
        const allParagraphs: string[] = []
        for (const p of pages) {
          const linesToUse = filterHeaders
            ? p.lines.filter((l, idx) => {
                if (idx === 0 && l.text.length < 40 && p.lines.length > 2) return false
                if (idx === p.lines.length - 1 && /^\d+$/.test(l.text.trim())) return false
                return true
              })
            : p.lines

          for (const l of linesToUse) {
            if (l.fontSize >= 18) {
              allParagraphs.push(`<h1>${escapeHtml(l.text)}</h1>`)
            } else if (l.fontSize >= 14 || l.isBold) {
              allParagraphs.push(`<h2>${escapeHtml(l.text)}</h2>`)
            } else {
              allParagraphs.push(`<p>${escapeHtml(l.text)}</p>`)
            }
          }
        }

        generatedChapters.push({
          id: 'complete-book',
          title: 'Complete Document',
          contentHtml: allParagraphs.join('\n') || '<p><em>No content detected</em></p>',
        })
      } else {
        // Strategy 3 (Smart): Detect headings or "Chapter" / "Section" labels
        let currentChapterTitle = 'Introduction'
        let currentChapterId = 'chapter-1'
        let currentChapterLines: string[] = []
        let chapterIndex = 1

        for (const p of pages) {
          const linesToUse = filterHeaders
            ? p.lines.filter((l, idx) => {
                if (idx === 0 && l.text.length < 40 && p.lines.length > 2) return false
                if (idx === p.lines.length - 1 && /^\d+$/.test(l.text.trim())) return false
                return true
              })
            : p.lines

          for (const line of linesToUse) {
            const isHeadingPattern = /^(chapter|section|part|act|book)\s+[0-9ivxlcdm]+/i.test(
              line.text.trim()
            )
            const isLargeHeading = line.fontSize >= 16 && line.text.length < 80

            if ((isHeadingPattern || isLargeHeading) && currentChapterLines.length > 0) {
              // Flush current chapter
              generatedChapters.push({
                id: currentChapterId,
                title: currentChapterTitle,
                contentHtml: currentChapterLines.join('\n'),
              })

              chapterIndex++
              currentChapterId = `chapter-${chapterIndex}`
              currentChapterTitle = line.text.trim()
              currentChapterLines = [`<h2>${escapeHtml(line.text.trim())}</h2>`]
            } else if (isLargeHeading && currentChapterLines.length === 0) {
              currentChapterTitle = line.text.trim()
              currentChapterLines.push(`<h2>${escapeHtml(line.text.trim())}</h2>`)
            } else if (line.fontSize >= 14 || line.isBold) {
              currentChapterLines.push(`<h3>${escapeHtml(line.text)}</h3>`)
            } else {
              currentChapterLines.push(`<p>${escapeHtml(line.text)}</p>`)
            }
          }
        }

        // Flush remaining
        if (currentChapterLines.length > 0) {
          generatedChapters.push({
            id: currentChapterId,
            title: currentChapterTitle,
            contentHtml: currentChapterLines.join('\n'),
          })
        }

        // Fallback if no headings were detected and only 1 chapter was formed with many pages
        if (generatedChapters.length === 1 && pages.length > 5) {
          // Fall back to splitting every 5 pages
          const chunked: EpubChapter[] = []
          for (let i = 0; i < pages.length; i += 5) {
            const chunkPages = pages.slice(i, i + 5)
            const chunkNum = Math.floor(i / 5) + 1
            const html = chunkPages
              .flatMap((p) => p.lines.map((l) => `<p>${escapeHtml(l.text)}</p>`))
              .join('\n')
            chunked.push({
              id: `part-${chunkNum}`,
              title: `Part ${chunkNum} (Pages ${i + 1}–${Math.min(i + 5, pages.length)})`,
              contentHtml: html,
            })
          }
          setChapters(chunked)
          setSelectedChapterIdx(0)
          return
        }
      }

      setChapters(generatedChapters)
      setSelectedChapterIdx(0)
    },
    []
  )

  // Parse dropped or selected PDF
  const processPdf = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile)
      setPhase('parsing')
      setError(null)
      if (epubBlobUrl) URL.revokeObjectURL(epubBlobUrl)
      setEpubBlobUrl(null)
      setEpubFileSize(null)

      try {
        const arrayBuffer = await selectedFile.arrayBuffer()
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          useWorkerFetch: false,
          disableFontFace: true,
        })

        const pdf = await loadingTask.promise
        const totalPages = pdf.numPages

        // 1. Extract metadata
        let docTitle = selectedFile.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')
        let docAuthor = 'Docuzy Author'

        try {
          const meta = await pdf.getMetadata()
          const info = (meta?.info as Record<string, any>) || {}
          if (info.Title && typeof info.Title === 'string' && info.Title.trim().length > 0) {
            docTitle = info.Title.trim()
          }
          if (info.Author && typeof info.Author === 'string' && info.Author.trim().length > 0) {
            docAuthor = info.Author.trim()
          }
        } catch {
          // ignore metadata failure
        }

        setTitle(docTitle)
        setAuthor(docAuthor)

        // 2. Render Page 1 to high-res canvas for cover image
        try {
          setProgressText('Rendering book cover from Page 1…')
          const page1 = await pdf.getPage(1)
          const viewport = page1.getViewport({ scale: 1.5 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')

          if (ctx) {
            await page1.render({ canvasContext: ctx, viewport, canvas }).promise
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
            setCoverDataUrl(dataUrl)

            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, 'image/jpeg', 0.88)
            )
            if (blob) {
              const buffer = await blob.arrayBuffer()
              setCoverBytes(new Uint8Array(buffer))
            }
          }
        } catch {
          // cover rendering is optional
        }

        // 3. Extract text page by page
        const pagesData: ParsedPageData[] = []

        for (let p = 1; p <= totalPages; p++) {
          setProgressText(`Reading page ${p} of ${totalPages}…`)
          const page = await pdf.getPage(p)
          const textContent = await page.getTextContent()

          const items = (textContent.items as any[]).filter(
            (item) => item.str && item.str.trim().length > 0
          )

          // Group items by vertical lines (Y position)
          const lineMap = new Map<number, any[]>()
          for (const item of items) {
            const y = Math.round(item.transform[5] / 4) * 4 // round to 4px buckets
            if (!lineMap.has(y)) {
              lineMap.set(y, [])
            }
            lineMap.get(y)!.push(item)
          }

          // Sort lines descending by Y (top of page to bottom)
          const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
          const lines: ParsedPageData['lines'] = []

          for (const y of sortedYs) {
            const lineItems = lineMap.get(y) || []
            // Sort items left-to-right
            lineItems.sort((a, b) => a.transform[4] - b.transform[4])

            const lineText = lineItems.map((i) => i.str).join(' ').trim()
            if (lineText) {
              const maxFontSize = Math.max(...lineItems.map((i) => Math.abs(i.transform[0]) || 12))
              const isBold = lineItems.some(
                (i) => i.fontName && /bold|black|heavy/i.test(i.fontName)
              )
              lines.push({
                text: lineText,
                fontSize: maxFontSize,
                isBold,
                y,
              })
            }
          }

          pagesData.push({
            pageNumber: p,
            text: lines.map((l) => l.text).join('\n'),
            lines,
          })
        }

        setParsedPages(pagesData)
        rebuildChapters(pagesData, chapterStrategy, filterRunningHeaders)
        setPhase('ready')
      } catch (err: any) {
        console.error('PDF parsing error:', err)
        setError(err?.message || 'Failed to read the PDF document.')
        setPhase('idle')
      }
    },
    [chapterStrategy, filterRunningHeaders, rebuildChapters, epubBlobUrl]
  )

  // Handle Strategy or Filter changes
  const handleStrategyChange = (newStrategy: ChapterStrategy) => {
    setChapterStrategy(newStrategy)
    if (parsedPages.length > 0) {
      rebuildChapters(parsedPages, newStrategy, filterRunningHeaders)
    }
  }

  const handleFilterHeadersChange = (newFilter: boolean) => {
    setFilterRunningHeaders(newFilter)
    if (parsedPages.length > 0) {
      rebuildChapters(parsedPages, chapterStrategy, newFilter)
    }
  }

  // Generate EPUB file
  const handleGenerateEpub = async () => {
    if (chapters.length === 0) return
    setPhase('generating')
    setError(null)

    try {
      const metadata: EpubMetadata = {
        title: title || 'Untitled E-book',
        author: author || 'Unknown Author',
        publisher: publisher || undefined,
        language: language || 'en',
        description: description || undefined,
        coverImageBytes: includeCover && coverBytes ? coverBytes : undefined,
        coverImageMime: 'image/jpeg',
      }

      const epubBytes = await createEpub(metadata, chapters, { theme })
      const blob = new Blob([epubBytes as BlobPart], { type: 'application/epub+zip' })
      const url = URL.createObjectURL(blob)

      setEpubBlobUrl(url)
      setEpubFileSize(blob.size)
      setPhase('ready')

      // Trigger instant download
      const a = document.createElement('a')
      a.href = url
      a.download = `${(title || 'book').replace(/[^a-zA-Z0-9_\- ]/g, '')}.epub`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: any) {
      console.error('EPUB Generation error:', err)
      setError(err?.message || 'Failed to generate EPUB file.')
      setPhase('ready')
    }
  }

  const handleReset = () => {
    setFile(null)
    setPhase('idle')
    setParsedPages([])
    setChapters([])
    setCoverDataUrl(null)
    setCoverBytes(null)
    if (epubBlobUrl) URL.revokeObjectURL(epubBlobUrl)
    setEpubBlobUrl(null)
    setEpubFileSize(null)
    setError(null)
  }

  // Calculate statistics
  const totalWords = parsedPages.reduce((acc, p) => acc + (p.text.match(/\S+/g)?.length || 0), 0)
  const estReadingMinutes = Math.max(1, Math.round(totalWords / 200))

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      {!file && (
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
            if (dropped && dropped.type === 'application/pdf') {
              processPdf(dropped)
            } else {
              setError('Please drop a valid PDF document.')
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 shadow-md'
              : 'border-zinc-300 hover:border-zinc-400 bg-white'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0]
              if (selected) processPdf(selected)
            }}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-900">
                Drop your PDF here, or <span className="text-indigo-600">browse</span>
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                Converts into standard, reflowable EPUB 3.0 for Kindle, Apple Books, and e-readers
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 text-xs text-zinc-600">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              100% In-house conversion • Private and secure
            </div>
          </div>
        </div>
      )}

      {/* Parsing progress */}
      {phase === 'parsing' && (
        <div className="p-8 border border-zinc-200 rounded-2xl bg-white text-center space-y-4 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <div>
            <p className="font-semibold text-zinc-900">{progressText || 'Reading PDF...'}</p>
            <p className="text-xs text-zinc-500 mt-1">
              Extracting chapter structure, headings, and generating cover thumbnail
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* E-book Studio Workspace */}
      {(phase === 'ready' || phase === 'generating') && (
        <div className="space-y-6">
          {/* Top Document Summary Card */}
          <div className="p-5 border border-zinc-200 rounded-2xl bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <BookMarked className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-zinc-900 truncate text-base">
                  {title || file?.name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mt-0.5">
                  <span>{parsedPages.length} PDF Pages</span>
                  <span>•</span>
                  <span>{chapters.length} Chapters</span>
                  <span>•</span>
                  <span>{totalWords.toLocaleString()} Words</span>
                  <span>•</span>
                  <span>~{estReadingMinutes} min read</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-3.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New PDF
              </button>
              <button
                onClick={handleGenerateEpub}
                disabled={phase === 'generating' || chapters.length === 0}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {phase === 'generating' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Packaging EPUB…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download EPUB
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Download ready banner if generated */}
          {epubBlobUrl && (
            <div className="p-4 border border-emerald-200 bg-emerald-50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    EPUB generated successfully!
                  </p>
                  <p className="text-xs text-emerald-700">
                    {epubFileSize ? `${(epubFileSize / 1024).toFixed(1)} KB • ` : ''}Ready for Apple Books, Kindle, Kobo, and e-readers.
                  </p>
                </div>
              </div>
              <a
                href={epubBlobUrl}
                download={`${(title || 'book').replace(/[^a-zA-Z0-9_\- ]/g, '')}.epub`}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Download Again
              </a>
            </div>
          )}

          {/* Studio Columns: Main Preview + Sidebar Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Preview Area (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {/* Tab Navigation */}
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
                <button
                  onClick={() => setPreviewTab('reader')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    previewTab === 'reader'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Reader Preview
                </button>
                <button
                  onClick={() => setPreviewTab('toc')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    previewTab === 'toc'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Table of Contents ({chapters.length})
                </button>
                <button
                  onClick={() => setPreviewTab('raw')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    previewTab === 'raw'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  XHTML Source
                </button>
              </div>

              {/* Reader Preview Tab */}
              {previewTab === 'reader' && (
                <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm">
                  {/* Reader header bar */}
                  <div className="px-5 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 font-medium">Chapter:</span>
                      <select
                        value={selectedChapterIdx}
                        onChange={(e) => setSelectedChapterIdx(Number(e.target.value))}
                        className="text-xs font-semibold bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-zinc-900 max-w-xs truncate focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {chapters.map((ch, idx) => (
                          <option key={ch.id} value={idx}>
                            {idx + 1}. {ch.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="text-xs text-zinc-500">
                      Theme: <span className="capitalize font-medium text-zinc-700">{theme}</span>
                    </div>
                  </div>

                  {/* Simulated E-Reader Page */}
                  <div className="p-8 max-h-[560px] overflow-y-auto bg-white">
                    {chapters[selectedChapterIdx] ? (
                      <div
                        className={`prose max-w-none ${
                          theme === 'classic'
                            ? 'font-serif text-zinc-800 leading-relaxed'
                            : theme === 'academic'
                            ? 'font-serif text-zinc-900 leading-normal text-justify'
                            : 'font-sans text-zinc-800 leading-relaxed'
                        }`}
                      >
                        <h2 className="text-xl font-bold border-b border-zinc-200 pb-2 mb-6 text-zinc-900">
                          {chapters[selectedChapterIdx].title}
                        </h2>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: chapters[selectedChapterIdx].contentHtml,
                          }}
                          className="space-y-3 text-sm [&>p]:mb-3 [&>h2]:text-lg [&>h2]:font-bold [&>h2]:mt-4 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:mt-3 text-zinc-800"
                        />
                      </div>
                    ) : (
                      <p className="text-zinc-400 text-sm">No chapter selected.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Table of Contents Tab */}
              {previewTab === 'toc' && (
                <div className="border border-zinc-200 rounded-2xl bg-white p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    E-book Navigation Map (EPUB 3 / NCX)
                  </h4>
                  <div className="divide-y divide-zinc-100 max-h-[500px] overflow-y-auto">
                    {chapters.map((ch, idx) => (
                      <div
                        key={ch.id}
                        onClick={() => {
                          setSelectedChapterIdx(idx)
                          setPreviewTab('reader')
                        }}
                        className="py-3 px-3 flex items-center justify-between hover:bg-zinc-50 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-zinc-100 text-zinc-600 text-xs flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium text-zinc-800 group-hover:text-indigo-600 transition-colors">
                            {ch.title}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* XHTML Source Tab */}
              {previewTab === 'raw' && (
                <div className="border border-zinc-200 rounded-2xl bg-zinc-50 p-4 font-mono text-xs text-zinc-800 max-h-[560px] overflow-auto shadow-inner">
                  <pre>{chapters[selectedChapterIdx]?.contentHtml || ''}</pre>
                </div>
              )}
            </div>

            {/* Right: Settings & Book Metadata (4 cols) */}
            <div className="lg:col-span-4 space-y-5">
              {/* Cover Preview Card */}
              <div className="p-4 border border-zinc-200 rounded-2xl bg-white shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                    <BookMarked className="w-3.5 h-3.5 text-indigo-500" />
                    Book Cover
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={includeCover}
                      onChange={(e) => setIncludeCover(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Include Cover
                  </label>
                </div>

                {includeCover && coverDataUrl ? (
                  <div className="relative aspect-[3/4] w-36 mx-auto rounded-lg overflow-hidden border border-zinc-200 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverDataUrl} alt="Cover preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-[3/4] w-36 mx-auto rounded-lg border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-400 text-xs p-2 text-center">
                    <BookOpen className="w-6 h-6 mb-1 opacity-50" />
                    {includeCover ? 'No cover detected' : 'Cover disabled'}
                  </div>
                )}
              </div>

              {/* Book Metadata Form */}
              <div className="p-4 border border-zinc-200 rounded-2xl bg-white shadow-sm space-y-3">
                <h4 className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  Book Metadata
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-zinc-500 mb-1">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Book title"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-500 mb-1">Author</label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Author name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-zinc-500 mb-1">Language</label>
                      <input
                        type="text"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="en"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-500 mb-1">Publisher</label>
                      <input
                        type="text"
                        value={publisher}
                        onChange={(e) => setPublisher(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Publisher"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Conversion Settings */}
              <div className="p-4 border border-zinc-200 rounded-2xl bg-white shadow-sm space-y-3.5">
                <h4 className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                  E-book Formatting
                </h4>

                {/* Chapter Strategy */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-600">
                    Chapter Separation
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'smart', label: 'Smart' },
                      { id: 'pages', label: 'Per Page' },
                      { id: 'continuous', label: 'Single Flow' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleStrategyChange(opt.id as ChapterStrategy)}
                        className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all text-center ${
                          chapterStrategy === opt.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-600 font-semibold'
                            : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Typography Theme */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-600">
                    Typography Theme
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'classic', label: 'Classic' },
                      { id: 'modern', label: 'Modern' },
                      { id: 'academic', label: 'Academic' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id as EpubTheme)}
                        className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all text-center ${
                          theme === t.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-600 font-semibold'
                            : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Header/Footer Filter Toggle */}
                <div className="pt-2 border-t border-zinc-100">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={filterRunningHeaders}
                      onChange={(e) => handleFilterHeadersChange(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Filter running headers &amp; page numbers</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
