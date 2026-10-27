'use client'

import React, { useState, useRef, useMemo } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  Table as TableIcon,
  Upload,
  X,
} from 'lucide-react'

const SAMPLE_EXCEL_DATA = `Department,Employee Name,Role,Quarterly Sales,Target,Achievement
Enterprise,Alexander Wright,Senior Account Director,$485000,$400000,121%
Enterprise,Sophia Martinez,Enterprise Lead,$520000,$450000,115%
Commercial,David Chen,Solutions Engineer,$310000,$300000,103%
Commercial,Emma Watson,Account Executive,$290000,$280000,104%
Public Sector,Marcus Johnson,Regional Director,$640000,$600000,107%
Public Sector,Elena Rostova,Partner Manager,$410000,$400000,102.5%
Strategic,Liam O'Connor,Global VP Sales,$890000,$800000,111%`

function parseSpreadsheetText(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  return lines.map((line) => {
    // Check delimiter (tab, comma, or semicolon)
    let delimiter = ','
    if (line.includes('\t')) delimiter = '\t'
    else if (line.includes(';') && !line.includes(',')) delimiter = ';'

    return line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''))
  })
}

export default function ExcelToPdf() {
  const [spreadsheetText, setSpreadsheetText] = useState(SAMPLE_EXCEL_DATA)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape')
  const [theme, setTheme] = useState<'emerald' | 'indigo' | 'slate'>('emerald')
  const [documentTitle, setDocumentTitle] = useState('sales-report.pdf')
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const parsedRows = useMemo(() => parseSpreadsheetText(spreadsheetText), [spreadsheetText])
  const headers = parsedRows[0] || []
  const dataRows = parsedRows.slice(1)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const baseName = file.name.replace(/\.[^/.]+$/, '')
    setDocumentTitle(`${baseName}.pdf`)
    setError(null)

    try {
      const text = await file.text()
      // If it contains XML tags (raw XLSX unzipped), extract cell strings
      if (text.includes('<worksheet') || text.includes('<sheetData>')) {
        const matches = text.match(/<t[^>]*>(.*?)<\/t>/g) || []
        const words = matches.map((m) => m.replace(/<[^>]+>/g, ''))
        // Chunk into rows of 6
        const rows: string[] = []
        for (let i = 0; i < words.length; i += 6) {
          rows.push(words.slice(i, i + 6).join(','))
        }
        setSpreadsheetText(rows.join('\n') || text)
      } else {
        setSpreadsheetText(text)
      }
    } catch {
      setError('Could not read spreadsheet file.')
    }
  }

  const handleExportPdf = async () => {
    if (parsedRows.length === 0) return
    setIsExporting(true)
    setError(null)

    try {
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      const isLandscape = orientation === 'landscape'
      const pageWidth = isLandscape ? 841.89 : 595.28
      const pageHeight = isLandscape ? 595.28 : 841.89
      const margin = 36
      const availableWidth = pageWidth - margin * 2

      const colCount = Math.max(...parsedRows.map((r) => r.length), 1)
      const colLengths = new Array(colCount).fill(0)

      for (const row of parsedRows) {
        for (let c = 0; c < colCount; c++) {
          const val = row[c] || ''
          colLengths[c] = Math.max(colLengths[c], Math.min(val.length, 30))
        }
      }

      const totalLengths = colLengths.reduce((a, b) => a + b, 0) || 1
      const colWidths = colLengths.map((len) => Math.max((len / totalLengths) * availableWidth, 40))

      const themeColors = {
        emerald: {
          headerBg: rgb(0.02, 0.53, 0.38),
          headerText: rgb(1, 1, 1),
          stripeBg: rgb(0.95, 0.98, 0.96),
          border: rgb(0.85, 0.92, 0.88),
        },
        indigo: {
          headerBg: rgb(0.31, 0.27, 0.9),
          headerText: rgb(1, 1, 1),
          stripeBg: rgb(0.96, 0.97, 1),
          border: rgb(0.88, 0.9, 0.96),
        },
        slate: {
          headerBg: rgb(0.18, 0.2, 0.25),
          headerText: rgb(1, 1, 1),
          stripeBg: rgb(0.96, 0.96, 0.97),
          border: rgb(0.85, 0.85, 0.88),
        },
      }[theme]

      const rowHeight = 22
      const fontSize = 8.5
      let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      let currentY = pageHeight - margin - 30

      // Title
      currentPage.drawText(documentTitle.replace(/\.pdf$/i, '').toUpperCase(), {
        x: margin,
        y: pageHeight - margin - 10,
        size: 13,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })

      const drawRow = (page: any, cells: string[], y: number, isHeader: boolean, isStripe: boolean) => {
        if (isHeader) {
          page.drawRectangle({
            x: margin,
            y,
            width: availableWidth,
            height: rowHeight,
            color: themeColors.headerBg,
          })
        } else if (isStripe) {
          page.drawRectangle({
            x: margin,
            y,
            width: availableWidth,
            height: rowHeight,
            color: themeColors.stripeBg,
          })
        }

        let curX = margin
        for (let c = 0; c < colCount; c++) {
          const w = colWidths[c]
          let cellText = cells[c] || ''
          while (
            (isHeader ? fontBold : font).widthOfTextAtSize(cellText, fontSize) > w - 10 &&
            cellText.length > 3
          ) {
            cellText = cellText.slice(0, -4) + '…'
          }

          page.drawText(cellText, {
            x: curX + 5,
            y: y + 6,
            size: fontSize,
            font: isHeader ? fontBold : font,
            color: isHeader ? themeColors.headerText : rgb(0.15, 0.15, 0.15),
          })
          curX += w
        }

        page.drawLine({
          start: { x: margin, y },
          end: { x: margin + availableWidth, y },
          thickness: 0.5,
          color: themeColors.border,
        })
      }

      // Draw header
      drawRow(currentPage, headers, currentY, true, false)
      currentY -= rowHeight

      // Draw data rows
      for (let r = 0; r < dataRows.length; r++) {
        if (currentY - rowHeight < margin + 20) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight])
          currentY = pageHeight - margin - 20
          drawRow(currentPage, headers, currentY, true, false)
          currentY -= rowHeight
        }
        drawRow(currentPage, dataRows[r], currentY, false, r % 2 === 1)
        currentY -= rowHeight
      }

      const totalPages = pdfDoc.getPageCount()
      for (let p = 0; p < totalPages; p++) {
        const page = pdfDoc.getPage(p)
        const pageStr = `Page ${p + 1} of ${totalPages}`
        const textWidth = font.widthOfTextAtSize(pageStr, 8)
        page.drawText(pageStr, {
          x: (pageWidth - textWidth) / 2,
          y: margin - 15,
          size: 8,
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
      setError(err?.message || 'Could not export Excel data to PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.tsv,.txt"
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
            <span>Open Spreadsheet</span>
          </button>

          <button
            type="button"
            onClick={() => setSpreadsheetText(SAMPLE_EXCEL_DATA)}
            className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Load Sample</span>
          </button>

          <button
            type="button"
            onClick={() => setSpreadsheetText('')}
            className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={14} />
            <span>Clear</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl text-xs font-semibold text-zinc-600">
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                orientation === 'landscape' ? 'bg-white text-zinc-900 shadow-xs' : 'hover:text-zinc-900'
              }`}
            >
              Landscape
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                orientation === 'portrait' ? 'bg-white text-zinc-900 shadow-xs' : 'hover:text-zinc-900'
              }`}
            >
              Portrait
            </button>
          </div>

          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none cursor-pointer"
          >
            <option value="emerald">Excel Emerald</option>
            <option value="indigo">Corporate Indigo</option>
            <option value="slate">Monochrome Slate</option>
          </select>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting || parsedRows.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Exporting…</span>
              </>
            ) : (
              <>
                <Download size={14} />
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

      {/* Editor & Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>Spreadsheet Input</span>
            </div>
            <span className="text-[11px] text-zinc-400">
              {headers.length} columns &bull; {dataRows.length} rows
            </span>
          </div>

          <textarea
            value={spreadsheetText}
            onChange={(e) => setSpreadsheetText(e.target.value)}
            placeholder="Paste tabular spreadsheet data here…"
            className="flex-1 w-full p-4 bg-zinc-50/70 border border-zinc-100 rounded-2xl font-mono text-xs leading-relaxed text-zinc-800 resize-none focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none min-h-[450px]"
          />
        </div>

        <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm flex flex-col space-y-3 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
              <TableIcon size={15} className="text-emerald-600" />
              <span>Live PDF Table Preview</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto max-h-[500px] rounded-xl border border-zinc-100">
            {parsedRows.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400">
                Paste spreadsheet data to view table preview…
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-emerald-700 text-white">
                    {headers.map((h, i) => (
                      <th key={i} className="p-2.5 font-bold border-b border-zinc-200 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={`border-b border-zinc-100 transition-colors ${
                        rIdx % 2 === 1 ? 'bg-zinc-50/70' : 'bg-white'
                      }`}
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2.5 text-zinc-700 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
