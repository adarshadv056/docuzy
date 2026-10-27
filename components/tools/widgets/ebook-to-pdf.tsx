'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { PDFDocument, type PDFPage, type PDFFont, rgb, StandardFonts } from 'pdf-lib'
import { toPng } from 'html-to-image'
import { parseEpub, type ParsedEpub } from '@/lib/ebook/epub-parser'
import { createSampleEbook } from '@/lib/ebook/sample-book'
import {
  AlertCircle,
  BookMarked,
  BookOpen,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Hash,
  ListOrdered,
  Loader2,
  Printer,
  RotateCcw,
  Search,
  Settings2,
  Sliders,
  Sparkles,
  Square,
  Upload,
  User,
  X,
} from 'lucide-react'

type PageFormat = 'a4' | 'letter' | 'a5' | 'trade'
type ThemeStyle = 'classic' | 'modern' | 'editorial' | 'compact'
type FontSize = 'small' | 'medium' | 'large' | 'xl'

interface PageDimensions {
  pdfWidth: number
  pdfHeight: number
  cssWidthPx: number
  cssHeightPx: number
  name: string
}

const PAGE_CONFIGS: Record<PageFormat, PageDimensions> = {
  a4: {
    pdfWidth: 595.28,
    pdfHeight: 841.89,
    cssWidthPx: 794,
    cssHeightPx: 1123,
    name: 'A4 (210 × 297 mm)',
  },
  letter: {
    pdfWidth: 612.0,
    pdfHeight: 792.0,
    cssWidthPx: 816,
    cssHeightPx: 1056,
    name: 'US Letter (8.5 × 11 in)',
  },
  a5: {
    pdfWidth: 419.53,
    pdfHeight: 595.28,
    cssWidthPx: 559,
    cssHeightPx: 794,
    name: 'A5 (148 × 210 mm)',
  },
  trade: {
    pdfWidth: 432.0,
    pdfHeight: 648.0,
    cssWidthPx: 576,
    cssHeightPx: 864,
    name: 'Trade Paperback (6 × 9 in)',
  },
}

export default function EbookToPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [parsedEpub, setParsedEpub] = useState<ParsedEpub | null>(null)
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set())
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)

  // Layout & Styling Options
  const [pageFormat, setPageFormat] = useState<PageFormat>('trade')
  const [theme, setTheme] = useState<ThemeStyle>('classic')
  const [fontSize, setFontSize] = useState<FontSize>('medium')
  const [includeCover, setIncludeCover] = useState(true)
  const [includeToc, setIncludeToc] = useState(true)
  const [includeHeaderFooter, setIncludeHeaderFooter] = useState(true)

  // Metadata overrides
  const [customTitle, setCustomTitle] = useState('')
  const [customAuthor, setCustomAuthor] = useState('')
  const [customPublisher, setCustomPublisher] = useState('')

  // UI State
  const [activeTab, setActiveTab] = useState<'reader' | 'chapters' | 'metadata'>('reader')
  const [chapterSearch, setChapterSearch] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Output State
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pdfFileSize, setPdfFileSize] = useState<number | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const renderContainerRef = useRef<HTMLDivElement>(null)
  const printIframeRef = useRef<HTMLIFrameElement>(null)

  // Cleanup blob URLs on unmount or new export
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    }
  }, [pdfBlobUrl])

  // Load and parse an EPUB buffer
  const loadEpubData = useCallback(async (data: Uint8Array, fileName: string) => {
    setIsProcessing(true)
    setError(null)
    setProgressText('Extracting package manifest & chapters…')

    try {
      const parsed = await parseEpub(data, fileName)
      if (parsed.chapters.length === 0) {
        throw new Error('No readable chapters or sections found in this EPUB.')
      }

      setParsedEpub(parsed)
      setCustomTitle(parsed.metadata.title)
      setCustomAuthor(parsed.metadata.author)
      setCustomPublisher(parsed.metadata.publisher || '')

      // Select all chapters by default
      const allIds = new Set(parsed.chapters.map((c) => c.id))
      setSelectedChapterIds(allIds)
      setActiveChapterIndex(0)

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
        setPdfBlobUrl(null)
      }
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Failed to parse EPUB file.'
      setError(message)
    } finally {
      setIsProcessing(false)
      setProgressText('')
    }
  }, [pdfBlobUrl])

  // Handle uploaded file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    const arrayBuffer = await selected.arrayBuffer()
    await loadEpubData(new Uint8Array(arrayBuffer), selected.name)
  }

  // Handle Drag & Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files?.[0]
    if (!droppedFile) return

    if (!droppedFile.name.toLowerCase().endsWith('.epub')) {
      setError('Please upload a valid .epub e-book file.')
      return
    }

    setFile(droppedFile)
    const arrayBuffer = await droppedFile.arrayBuffer()
    await loadEpubData(new Uint8Array(arrayBuffer), droppedFile.name)
  }

  // Load sample e-book
  const handleLoadSample = async () => {
    setIsProcessing(true)
    setError(null)
    setProgressText('Generating typography sample e-book…')

    try {
      const { data, fileName } = await createSampleEbook()
      setFile(new File([data as BlobPart], fileName, { type: 'application/epub+zip' }))
      await loadEpubData(data, fileName)
    } catch (err: unknown) {
      console.error(err)
      setError('Could not generate sample e-book.')
      setIsProcessing(false)
    }
  }

  // Toggle chapter selection
  const toggleChapter = (id: string) => {
    const next = new Set(selectedChapterIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedChapterIds(next)
  }

  const selectAllChapters = () => {
    if (!parsedEpub) return
    setSelectedChapterIds(new Set(parsedEpub.chapters.map((c) => c.id)))
  }

  const clearAllChapters = () => {
    setSelectedChapterIds(new Set())
  }

  // Theme styling helpers
  const getThemeStyles = () => {
    switch (theme) {
      case 'modern':
        return {
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          bg: '#ffffff',
          color: '#0f172a',
          headingColor: '#020617',
          accent: '#4f46e5',
          bodySize: fontSize === 'small' ? '12px' : fontSize === 'medium' ? '14px' : fontSize === 'large' ? '16px' : '18px',
          lineHeight: '1.7',
          textAlign: 'left' as const,
          indent: '0',
          paraMargin: '1.1em',
        }
      case 'editorial':
        return {
          fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
          bg: '#faf8f5',
          color: '#27272a',
          headingColor: '#18181b',
          accent: '#6366f1',
          bodySize: fontSize === 'small' ? '12.5px' : fontSize === 'medium' ? '14.5px' : fontSize === 'large' ? '16.5px' : '18.5px',
          lineHeight: '1.75',
          textAlign: 'justify' as const,
          indent: '1.5em',
          paraMargin: '0.4em',
        }
      case 'compact':
        return {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          bg: '#ffffff',
          color: '#18181b',
          headingColor: '#09090b',
          accent: '#3b82f6',
          bodySize: fontSize === 'small' ? '11px' : fontSize === 'medium' ? '12.5px' : fontSize === 'large' ? '14px' : '16px',
          lineHeight: '1.45',
          textAlign: 'left' as const,
          indent: '0',
          paraMargin: '0.8em',
        }
      case 'classic':
      default:
        return {
          fontFamily: 'Georgia, "Times New Roman", Cambria, serif',
          bg: '#ffffff',
          color: '#1c1917',
          headingColor: '#0c0a09',
          accent: '#4338ca',
          bodySize: fontSize === 'small' ? '12px' : fontSize === 'medium' ? '14px' : fontSize === 'large' ? '16px' : '18px',
          lineHeight: '1.7',
          textAlign: 'justify' as const,
          indent: '2em',
          paraMargin: '0.35em',
        }
    }
  }

  const currentTheme = getThemeStyles()
  const currentDimensions = PAGE_CONFIGS[pageFormat]

  // Formatted chapters list according to search filter
  const filteredChapters = parsedEpub
    ? parsedEpub.chapters.filter((c) =>
        c.title.toLowerCase().includes(chapterSearch.toLowerCase()) ||
        c.plainText.toLowerCase().includes(chapterSearch.toLowerCase())
      )
    : []

  // Generate Multi-Page PDF
  const handleExportPdf = async () => {
    if (!parsedEpub || !renderContainerRef.current) return

    const activeChapters = parsedEpub.chapters.filter((c) => selectedChapterIds.has(c.id))
    if (activeChapters.length === 0) {
      setError('Please select at least one chapter to export.')
      return
    }

    setIsExporting(true)
    setError(null)
    setProgressText('Initializing PDF document…')

    try {
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      const { pdfWidth, pdfHeight, cssWidthPx } = currentDimensions
      let currentTotalPages = 0

      // Margins in PDF points
      const marginX = pageFormat === 'trade' || pageFormat === 'a5' ? 36 : 46
      const marginTop = includeHeaderFooter ? 48 : 36
      const marginBottom = includeHeaderFooter ? 48 : 36
      const printableWidth = pdfWidth - marginX * 2
      const printableHeight = pdfHeight - marginTop - marginBottom

      // 1. Cover Page
      if (includeCover) {
        setProgressText('Rendering Cover Page…')
        const coverPage = pdfDoc.addPage([pdfWidth, pdfHeight])
        currentTotalPages++

        if (parsedEpub.metadata.coverDataUrl) {
          try {
            const coverRes = await fetch(parsedEpub.metadata.coverDataUrl)
            const coverBytes = await coverRes.arrayBuffer()
            let embeddedCover
            if (parsedEpub.metadata.coverMime === 'image/png') {
              embeddedCover = await pdfDoc.embedPng(coverBytes)
            } else {
              embeddedCover = await pdfDoc.embedJpg(coverBytes)
            }

            const imgRatio = embeddedCover.width / embeddedCover.height
            let drawW = pdfWidth - marginX * 2
            let drawH = drawW / imgRatio

            if (drawH > pdfHeight - 120) {
              drawH = pdfHeight - 120
              drawW = drawH * imgRatio
            }

            const posX = (pdfWidth - drawW) / 2
            const posY = (pdfHeight - drawH) / 2 + 10

            coverPage.drawImage(embeddedCover, {
              x: posX,
              y: posY,
              width: drawW,
              height: drawH,
            })
          } catch {
            // If image embedding fails, fallback to typographic cover
            renderTypographicCover(coverPage, pdfWidth, pdfHeight, font, fontBold)
          }
        } else {
          renderTypographicCover(coverPage, pdfWidth, pdfHeight, font, fontBold)
        }
      }

      // 2. Table of Contents Page
      if (includeToc && activeChapters.length > 1) {
        setProgressText('Generating Table of Contents…')
        const tocPage = pdfDoc.addPage([pdfWidth, pdfHeight])
        currentTotalPages++

        let tocY = pdfHeight - 72
        const tocTitle = 'Table of Contents'
        const tocTitleW = fontBold.widthOfTextAtSize(tocTitle, 20)
        tocPage.drawText(tocTitle, {
          x: (pdfWidth - tocTitleW) / 2,
          y: tocY,
          size: 20,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.12),
        })

        tocY -= 40
        // Draw thin rule
        tocPage.drawLine({
          start: { x: marginX + 30, y: tocY },
          end: { x: pdfWidth - marginX - 30, y: tocY },
          thickness: 0.75,
          color: rgb(0.8, 0.8, 0.85),
        })
        tocY -= 28

        const maxTocItems = Math.min(activeChapters.length, 24)
        for (let t = 0; t < maxTocItems; t++) {
          const ch = activeChapters[t]
          const chNum = `${t + 1}.`
          const title = ch.title.length > 45 ? ch.title.slice(0, 42) + '…' : ch.title

          tocPage.drawText(chNum, {
            x: marginX + 30,
            y: tocY,
            size: 10,
            font: fontBold,
            color: rgb(0.3, 0.3, 0.35),
          })

          tocPage.drawText(title, {
            x: marginX + 54,
            y: tocY,
            size: 10,
            font,
            color: rgb(0.15, 0.15, 0.18),
          })

          tocY -= 20
          if (tocY < 60) break
        }
      }

      // 3. Render Chapters via Offscreen High-Res Canvas
      const renderContainer = renderContainerRef.current
      renderContainer.style.display = 'block'
      renderContainer.style.width = `${cssWidthPx}px`

      const totalChapters = activeChapters.length
      for (let cIdx = 0; cIdx < totalChapters; cIdx++) {
        const chapter = activeChapters[cIdx]
        setProgressText(`Formatting Chapter ${cIdx + 1} of ${totalChapters}: "${chapter.title}"…`)

        // Allow UI to breathe
        await new Promise((r) => setTimeout(r, 25))

        // Set chapter HTML into render container
        renderContainer.innerHTML = `
          <div style="
            width: ${cssWidthPx}px;
            padding: 40px 50px;
            background: ${currentTheme.bg};
            color: ${currentTheme.color};
            font-family: ${currentTheme.fontFamily};
            font-size: ${currentTheme.bodySize};
            line-height: ${currentTheme.lineHeight};
            text-align: ${currentTheme.textAlign};
            box-sizing: border-box;
          ">
            <style>
              h1, h2, h3, h4 { color: ${currentTheme.headingColor}; font-family: inherit; line-height: 1.25; margin-top: 1.2em; margin-bottom: 0.6em; }
              h1 { font-size: 1.85em; text-align: center; margin-bottom: 1.2em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5em; }
              h2 { font-size: 1.4em; }
              h3 { font-size: 1.15em; }
              p { text-indent: ${currentTheme.indent}; margin-top: 0; margin-bottom: ${currentTheme.paraMargin}; }
              p.lead, h1 + p, h2 + p { text-indent: 0; }
              blockquote { margin: 1.2em 0; padding: 0.8em 1.4em; border-left: 3px solid ${currentTheme.accent}; background: rgba(99, 102, 241, 0.04); font-style: italic; }
              ul, ol { margin: 0 0 1em 1.8em; padding: 0; }
              li { margin-bottom: 0.35em; }
              table { width: 100%; border-collapse: collapse; margin: 1.5em 0; font-size: 0.9em; }
              th, td { border: 1px solid #e2e8f0; padding: 8px 12px; }
              img { max-width: 100%; height: auto; display: block; margin: 1.5em auto; border-radius: 6px; }
            </style>
            ${chapter.contentHtml}
          </div>
        `

        // Capture high-res PNG slice using html-to-image
        const dataUrl = await toPng(renderContainer, {
          pixelRatio: 1.8,
          backgroundColor: currentTheme.bg,
          skipFonts: true,
          cacheBust: false,
          width: cssWidthPx,
          filter: (node) => {
            const tag = (node as HTMLElement)?.tagName?.toLowerCase()
            return tag !== 'script' && tag !== 'noscript'
          },
        })

        const img = new Image()
        img.src = dataUrl
        await new Promise((resolve) => (img.onload = resolve))

        const imgWidth = img.width
        const imgHeight = img.height

        const scale = printableWidth / imgWidth
        const scaledTotalHeight = imgHeight * scale

        // Calculate pages required for this chapter
        const chapterPages = Math.ceil(scaledTotalHeight / printableHeight) || 1

        const embeddedImage = await pdfDoc.embedPng(dataUrl)

        for (let p = 0; p < chapterPages; p++) {
          const page = pdfDoc.addPage([pdfWidth, pdfHeight])
          currentTotalPages++

          const sliceYInPoints = p * printableHeight

          // Draw the slice with vertical offset
          page.drawImage(embeddedImage, {
            x: marginX,
            y: marginTop + printableHeight - (scaledTotalHeight - sliceYInPoints),
            width: printableWidth,
            height: scaledTotalHeight,
          })

          // Draw Header & Footer if enabled
          if (includeHeaderFooter) {
            // Running Header
            const headerText = p % 2 === 0 ? customTitle || 'Docuzy E-Book' : chapter.title
            const trimmedHeader = headerText.length > 40 ? headerText.slice(0, 37) + '…' : headerText
            const headerW = font.widthOfTextAtSize(trimmedHeader, 8.5)

            page.drawText(trimmedHeader, {
              x: (pdfWidth - headerW) / 2,
              y: pdfHeight - marginTop + 14,
              size: 8.5,
              font,
              color: rgb(0.45, 0.45, 0.5),
            })

            // Thin header rule
            page.drawLine({
              start: { x: marginX, y: pdfHeight - marginTop + 8 },
              end: { x: pdfWidth - marginX, y: pdfHeight - marginTop + 8 },
              thickness: 0.5,
              color: rgb(0.88, 0.88, 0.9),
            })

            // Running Footer (Page Number)
            const pageNumStr = `${currentTotalPages}`
            const pageNumW = font.widthOfTextAtSize(pageNumStr, 9)

            page.drawText(pageNumStr, {
              x: (pdfWidth - pageNumW) / 2,
              y: marginBottom - 22,
              size: 9,
              font,
              color: rgb(0.4, 0.4, 0.45),
            })
          }
        }
      }

      // Hide offscreen render container
      renderContainer.style.display = 'none'

      setProgressText('Compiling final PDF file…')
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      setPdfBlobUrl(url)
      setPdfFileSize(blob.size)
      setPdfPageCount(currentTotalPages)

      // Trigger automatic download
      const a = document.createElement('a')
      a.href = url
      const safeTitle = (customTitle || 'ebook').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
      a.download = `${safeTitle}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Failed to generate PDF document.'
      setError(message)
    } finally {
      setIsExporting(false)
      setProgressText('')
      if (renderContainerRef.current) {
        renderContainerRef.current.style.display = 'none'
      }
    }
  }

  // Fallback typographic cover generator
  const renderTypographicCover = (
    coverPage: PDFPage,
    w: number,
    h: number,
    font: PDFFont,
    fontBold: PDFFont
  ) => {
    // Elegant border
    coverPage.drawRectangle({
      x: 36,
      y: 36,
      width: w - 72,
      height: h - 72,
      borderWidth: 1.5,
      borderColor: rgb(0.2, 0.2, 0.25),
      color: rgb(0.99, 0.99, 0.99),
    })

    const titleText = customTitle || 'Untitled Book'
    const titleW = fontBold.widthOfTextAtSize(titleText, 22)
    coverPage.drawText(titleText, {
      x: (w - titleW) / 2,
      y: h / 2 + 50,
      size: 22,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.15),
    })

    const authorText = `By ${customAuthor || 'Unknown Author'}`
    const authorW = font.widthOfTextAtSize(authorText, 13)
    coverPage.drawText(authorText, {
      x: (w - authorW) / 2,
      y: h / 2 + 15,
      size: 13,
      font,
      color: rgb(0.35, 0.35, 0.4),
    })

    const pubText = customPublisher || 'Published with Docuzy'
    const pubW = font.widthOfTextAtSize(pubText, 10)
    coverPage.drawText(pubText, {
      x: (w - pubW) / 2,
      y: 70,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.55),
    })
  }

  // Native Browser Print / Vector PDF export
  const handleNativePrint = () => {
    if (!parsedEpub || !printIframeRef.current) return

    const iframe = printIframeRef.current
    const activeChapters = parsedEpub.chapters.filter((c) => selectedChapterIds.has(c.id))

    const chaptersHtml = activeChapters
      .map(
        (ch, idx) => `
        <article class="chapter-sheet ${idx > 0 ? 'page-break' : ''}">
          <header class="chapter-header">
            <span class="chapter-num">Chapter ${idx + 1}</span>
            <h1 class="chapter-title">${ch.title}</h1>
          </header>
          <div class="chapter-body">
            ${ch.contentHtml}
          </div>
        </article>
      `
      )
      .join('\n')

    const printDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${customTitle || 'E-Book'}</title>
        <style>
          @page {
            size: ${pageFormat === 'trade' ? '6in 9in' : pageFormat === 'a5' ? 'A5' : pageFormat === 'letter' ? 'letter' : 'A4'};
            margin: 20mm;
          }
          body {
            font-family: ${currentTheme.fontFamily};
            color: ${currentTheme.color};
            background: #ffffff;
            font-size: ${currentTheme.bodySize};
            line-height: ${currentTheme.lineHeight};
            text-align: ${currentTheme.textAlign};
            margin: 0;
            padding: 0;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }
          .chapter-sheet {
            padding: 10mm 0;
          }
          .chapter-num {
            display: block;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #64748b;
            margin-bottom: 4px;
          }
          .chapter-title {
            margin-top: 0;
            margin-bottom: 24px;
            font-size: 1.8em;
            color: #0f172a;
          }
          p {
            text-indent: ${currentTheme.indent};
            margin-top: 0;
            margin-bottom: ${currentTheme.paraMargin};
          }
          p.lead, h1 + p, h2 + p { text-indent: 0; }
          blockquote {
            margin: 1.5em 0;
            padding: 0.5em 1.2em;
            border-left: 3px solid #6366f1;
            font-style: italic;
          }
          table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 10px; }
          img { max-width: 100%; height: auto; display: block; margin: 1.5em auto; }
        </style>
      </head>
      <body>
        ${chaptersHtml}
      </body>
      </html>
    `

    iframe.srcdoc = printDoc
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      }, 250)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,application/epub+zip"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hidden Render Container for High-Res Canvas Rendering */}
      <div
        ref={renderContainerRef}
        className="fixed -left-[9999px] -top-[9999px] pointer-events-none"
        style={{ display: 'none' }}
      />

      {/* Hidden Iframe for Browser Printing */}
      <iframe ref={printIframeRef} className="hidden" title="Print Frame" />

      {/* Top Banner Toolbar */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Left Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || isExporting}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
          >
            <Upload size={14} />
            <span>Open .epub File</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            disabled={isProcessing || isExporting}
            className="px-3.5 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Load Sample E-Book</span>
          </button>

          {parsedEpub && (
            <button
              type="button"
              onClick={() => {
                setParsedEpub(null)
                setFile(null)
                setPdfBlobUrl(null)
                setError(null)
              }}
              className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Right Info Badges */}
        {parsedEpub && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
            <span className="flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
              <BookOpen size={13} className="text-indigo-600" />
              <span>{parsedEpub.chapters.length} Chapters</span>
            </span>
            <span className="flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
              <Hash size={13} className="text-zinc-600" />
              <span>{parsedEpub.totalWords.toLocaleString()} Words</span>
            </span>
            <span className="flex items-center gap-1 bg-zinc-100 px-2.5 py-1 rounded-lg">
              <Clock size={13} className="text-emerald-600" />
              <span>~{Math.max(1, Math.round(parsedEpub.totalWords / 200))} min read</span>
            </span>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 text-red-700 text-xs animate-in fade-in">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold">Conversion Error:</strong> {error}
          </div>
          <button onClick={() => setError(null)} className="hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading Progress State */}
      {(isProcessing || isExporting) && (
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3 text-indigo-900 text-xs animate-in fade-in">
          <Loader2 size={16} className="animate-spin text-indigo-600 shrink-0" />
          <span className="font-medium">{progressText || 'Working on your e-book…'}</span>
        </div>
      )}

      {/* Empty State / Dropzone */}
      {!parsedEpub && !isProcessing && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
              : 'border-zinc-200 hover:border-zinc-300 bg-white/75 hover:bg-zinc-50/50'
          }`}
        >
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
              <BookOpen size={30} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-zinc-900">
                Drop your EPUB e-book here, or browse
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Convert standard EPUB 2 & EPUB 3 e-books into clean, beautifully formatted, paginated PDFs with custom typography, chapters, and covers.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                <Check size={12} className="text-emerald-500" /> Reflowable Chapters
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                <Check size={12} className="text-emerald-500" /> Embedded Illustrations
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                <Check size={12} className="text-emerald-500" /> 100% In-Browser Privacy
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace when EPUB is loaded */}
      {parsedEpub && (
        <div className="space-y-6">
          {/* Book Header Card */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row gap-5 items-start">
            {/* Book Cover Thumbnail */}
            <div className="w-24 h-32 md:w-28 md:h-38 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-sm shrink-0 flex items-center justify-center relative">
              {parsedEpub.metadata.coverDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={parsedEpub.metadata.coverDataUrl}
                  alt={customTitle || 'Book Cover'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="p-3 text-center flex flex-col items-center justify-center space-y-1.5 text-zinc-400">
                  <BookMarked size={28} className="text-indigo-400" />
                  <span className="text-[10px] font-semibold text-zinc-600 line-clamp-2">
                    {customTitle || 'E-Book'}
                  </span>
                </div>
              )}
            </div>

            {/* Book Details */}
            <div className="flex-1 space-y-2">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
                  {customTitle || 'Untitled E-Book'}
                </h2>
                <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                  <User size={13} className="text-zinc-400" />
                  <span className="font-medium text-zinc-800">{customAuthor || 'Unknown Author'}</span>
                  {customPublisher && <span>• {customPublisher}</span>}
                </p>
              </div>

              {parsedEpub.metadata.description && (
                <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                  {parsedEpub.metadata.description}
                </p>
              )}

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 text-[11px] font-semibold truncate max-w-[200px]" title={file?.name || parsedEpub.fileName}>
                  {file?.name || parsedEpub.fileName}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 text-[11px] font-semibold">
                  Language: {parsedEpub.metadata.language?.toUpperCase() || 'EN'}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold">
                  Selected: {selectedChapterIds.size} of {parsedEpub.chapters.length} Chapters
                </span>
              </div>
            </div>

            {/* Quick Export Button */}
            <div className="w-full md:w-auto shrink-0 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExporting}
                className="w-full px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow disabled:opacity-50"
              >
                {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                <span>Export as PDF</span>
              </button>

              <button
                type="button"
                onClick={handleNativePrint}
                disabled={isExporting}
                className="w-full px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Printer size={14} />
                <span>Print / Browser PDF</span>
              </button>
            </div>
          </div>

          {/* Configuration Settings Panel */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <Sliders size={16} className="text-indigo-600" />
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                PDF Layout & Typography Options
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Page Format */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Page Dimensions</label>
                <select
                  value={pageFormat}
                  onChange={(e) => setPageFormat(e.target.value as PageFormat)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="trade">Trade Paperback (6 × 9 in)</option>
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="letter">US Letter (8.5 × 11 in)</option>
                  <option value="a5">A5 Digest (148 × 210 mm)</option>
                </select>
              </div>

              {/* Typography Theme */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Typography Theme</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as ThemeStyle)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="classic">Classic Literary Serif (Georgia)</option>
                  <option value="editorial">Warm Editorial (Palatino & Cream)</option>
                  <option value="modern">Modern Clean Sans (Geist / Inter)</option>
                  <option value="compact">High Density Reader</option>
                </select>
              </div>

              {/* Font Size */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Font Scale</label>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value as FontSize)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="small">Small (12px / 9pt)</option>
                  <option value="medium">Medium (14px / 10.5pt - Standard)</option>
                  <option value="large">Large (16px / 12pt - Accessible)</option>
                  <option value="xl">Extra Large (18px / 13.5pt)</option>
                </select>
              </div>

              {/* Structural Toggles */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-zinc-700 block">Elements to Include</label>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCover}
                      onChange={(e) => setIncludeCover(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Include Cover Sheet</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeToc}
                      onChange={(e) => setIncludeToc(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Include Table of Contents</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeHeaderFooter}
                      onChange={(e) => setIncludeHeaderFooter(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Running Headers & Folios</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Result Banner if already generated */}
          {pdfBlobUrl && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-900 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">PDF Document Ready!</h4>
                  <p className="text-xs text-emerald-700">
                    Compiled {pdfPageCount} pages ({((pdfFileSize || 0) / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={pdfBlobUrl}
                  download={`${(customTitle || 'ebook').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}.pdf`}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download size={14} />
                  <span>Download Again</span>
                </a>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('reader')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'reader'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <BookOpen size={14} />
                <span>Live Reader & Preview</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('chapters')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'chapters'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <ListOrdered size={14} />
                <span>Select Chapters ({selectedChapterIds.size})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('metadata')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'metadata'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Settings2 size={14} />
                <span>Edit Metadata</span>
              </button>
            </div>

            {activeTab === 'reader' && (
              <div className="flex items-center gap-1 text-xs text-zinc-500 font-medium">
                <button
                  type="button"
                  onClick={() => setActiveChapterIndex(Math.max(0, activeChapterIndex - 1))}
                  disabled={activeChapterIndex === 0}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30"
                  title="Previous Chapter"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2">
                  Chapter {activeChapterIndex + 1} of {parsedEpub.chapters.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setActiveChapterIndex(
                      Math.min(parsedEpub.chapters.length - 1, activeChapterIndex + 1)
                    )
                  }
                  disabled={activeChapterIndex === parsedEpub.chapters.length - 1}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30"
                  title="Next Chapter"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: Live Book Reader & Preview */}
          {activeTab === 'reader' && (
            <div className="bg-zinc-100/70 border border-zinc-200/80 rounded-2xl p-6 flex justify-center">
              {parsedEpub.chapters[activeChapterIndex] ? (
                <div
                  className="bg-white rounded-xl shadow-md border border-zinc-200/60 p-8 md:p-12 transition-all max-w-2xl w-full"
                  style={{
                    backgroundColor: currentTheme.bg,
                    color: currentTheme.color,
                    fontFamily: currentTheme.fontFamily,
                    fontSize: currentTheme.bodySize,
                    lineHeight: currentTheme.lineHeight,
                    textAlign: currentTheme.textAlign,
                  }}
                >
                  {/* Chapter Header */}
                  <div className="text-center mb-8 pb-4 border-b border-zinc-200/60">
                    <span className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase block mb-1">
                      Chapter {activeChapterIndex + 1}
                    </span>
                    <h2
                      className="text-xl md:text-2xl font-bold tracking-tight"
                      style={{ color: currentTheme.headingColor }}
                    >
                      {parsedEpub.chapters[activeChapterIndex].title}
                    </h2>
                  </div>

                  {/* Chapter HTML Body */}
                  <div
                    className="prose prose-zinc max-w-none prose-headings:font-semibold prose-img:rounded-lg prose-img:mx-auto"
                    dangerouslySetInnerHTML={{
                      __html: parsedEpub.chapters[activeChapterIndex].contentHtml,
                    }}
                  />

                  {/* Chapter Bottom Navigation */}
                  <div className="mt-12 pt-6 border-t border-zinc-200/60 flex items-center justify-between text-xs font-semibold text-zinc-500">
                    <button
                      type="button"
                      onClick={() => setActiveChapterIndex(Math.max(0, activeChapterIndex - 1))}
                      disabled={activeChapterIndex === 0}
                      className="flex items-center gap-1 hover:text-zinc-900 disabled:opacity-30"
                    >
                      <ChevronLeft size={14} /> Previous Chapter
                    </button>
                    <span>
                      {parsedEpub.chapters[activeChapterIndex].wordCount.toLocaleString()} words
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveChapterIndex(
                          Math.min(parsedEpub.chapters.length - 1, activeChapterIndex + 1)
                        )
                      }
                      disabled={activeChapterIndex === parsedEpub.chapters.length - 1}
                      className="flex items-center gap-1 hover:text-zinc-900 disabled:opacity-30"
                    >
                      Next Chapter <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-zinc-500">
                  Select a chapter to read.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Chapters & TOC Selection */}
          {activeTab === 'chapters' && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              {/* Filter & Selection Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search chapters…"
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllChapters}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium flex items-center gap-1.5"
                  >
                    <CheckSquare size={13} />
                    <span>Select All</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearAllChapters}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium flex items-center gap-1.5"
                  >
                    <Square size={13} />
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              {/* Chapters List */}
              <div className="divide-y divide-zinc-100 max-h-[480px] overflow-y-auto pr-1">
                {filteredChapters.map((ch) => {
                  const isChecked = selectedChapterIds.has(ch.id)
                  return (
                    <div
                      key={ch.id}
                      className="py-3 px-2 flex items-center justify-between hover:bg-zinc-50/80 rounded-xl transition-colors cursor-pointer group"
                      onClick={() => toggleChapter(ch.id)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-800 group-hover:text-indigo-600 transition-colors">
                            {ch.title}
                          </h4>
                          <p className="text-[11px] text-zinc-400">
                            {ch.wordCount.toLocaleString()} words • ~{Math.max(1, Math.round(ch.wordCount / 200))} min
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const originalIdx = parsedEpub.chapters.findIndex((c) => c.id === ch.id)
                          if (originalIdx >= 0) {
                            setActiveChapterIndex(originalIdx)
                            setActiveTab('reader')
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg border border-zinc-200 hover:bg-white text-zinc-600 text-[11px] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye size={12} />
                        <span>Read</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Metadata Editor */}
          {activeTab === 'metadata' && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs max-w-xl mx-auto space-y-4">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Customize Book Information
              </h3>
              <p className="text-xs text-zinc-500">
                These values will appear on the generated PDF cover, running headers, and table of contents.
              </p>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700">Book Title</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700">Author Name</label>
                  <input
                    type="text"
                    value={customAuthor}
                    onChange={(e) => setCustomAuthor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700">Publisher</label>
                  <input
                    type="text"
                    value={customPublisher}
                    onChange={(e) => setCustomPublisher(e.target.value)}
                    placeholder="e.g. Docuzy Press"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
