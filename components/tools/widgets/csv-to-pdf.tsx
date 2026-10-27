'use client'

import React, { useState, useRef, useMemo } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  Settings2,
  Sheet,
  Sparkles,
  Table as TableIcon,
  Upload,
} from 'lucide-react'

const SAMPLE_CSV = `Invoice ID,Client,Date,Status,Amount,Tax,Total
INV-2026-001,Acme Corporation,2026-03-15,Paid,$4500.00,$450.00,$4950.00
INV-2026-002,Global Tech Solutions,2026-03-18,Pending,$8200.00,$820.00,$9020.00
INV-2026-003,Starlight Media Group,2026-03-22,Paid,$3100.00,$310.00,$3410.00
INV-2026-004,Apex Logistics Ltd,2026-03-25,Paid,$6750.00,$675.00,$7425.00
INV-2026-005,Nexus Cloud Ventures,2026-03-29,Pending,$12400.00,$1240.00,$13640.00
INV-2026-006,Quantum Biotech Inc,2026-04-02,Paid,$5800.00,$580.00,$6380.00
INV-2026-007,Horizon Design Studio,2026-04-05,Paid,$2900.00,$290.00,$3190.00
INV-2026-008,Pacific Retail Corp,2026-04-10,Pending,$9150.00,$915.00,$10065.00`

/**
 * Pure In-house CSV Parser supporting quotes, commas, tabs, and newlines
 */
function parseCSV(text: string): string[][] {
  const lines: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  // Detect delimiter (, or \t or ;)
  const firstLine = text.split('\n')[0] || ''
  let delimiter = ','
  if (firstLine.includes('\t')) delimiter = '\t'
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';'

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++
      row.push(cell.trim())
      if (row.some((c) => c.length > 0)) {
        lines.push(row)
      }
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim())
    if (row.some((c) => c.length > 0)) lines.push(row)
  }

  return lines
}

export default function CsvToPdf() {
  const [csvText, setCsvText] = useState(SAMPLE_CSV)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape')
  const [theme, setTheme] = useState<'indigo' | 'slate' | 'emerald'>('indigo')
  const [repeatHeader, setRepeatHeader] = useState(true)
  const [zebraStriping, setZebraStriping] = useState(true)
  const [documentTitle, setDocumentTitle] = useState('spreadsheet.pdf')

  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parsedData = useMemo(() => parseCSV(csvText), [csvText])
  const headers = parsedData[0] || []
  const rows = parsedData.slice(1)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const baseName = file.name.replace(/\.[^/.]+$/, '')
    setDocumentTitle(`${baseName}.pdf`)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) setCsvText(content)
    }
    reader.readAsText(file)
  }

  const handleExportPdf = async () => {
    if (parsedData.length === 0) return
    setIsExporting(true)

    try {
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      // Page Dimensions (A4: 595.28 x 841.89 pt)
      const isLandscape = orientation === 'landscape'
      const pageWidth = isLandscape ? 841.89 : 595.28
      const pageHeight = isLandscape ? 595.28 : 841.89

      const margin = 36 // 0.5 inch margins
      const availableWidth = pageWidth - margin * 2
      const availableHeight = pageHeight - margin * 2

      // Compute column widths proportional to max content length in each column
      const colCount = Math.max(...parsedData.map((r) => r.length), 1)
      const colLengths = new Array(colCount).fill(0)

      for (const row of parsedData) {
        for (let c = 0; c < colCount; c++) {
          const val = row[c] || ''
          colLengths[c] = Math.max(colLengths[c], Math.min(val.length, 30))
        }
      }

      const totalLengths = colLengths.reduce((a, b) => a + b, 0) || 1
      const colWidths = colLengths.map((len) => Math.max((len / totalLengths) * availableWidth, 40))

      // Theme Colors
      const themeColors = {
        indigo: {
          headerBg: rgb(0.31, 0.27, 0.9), // Indigo 600
          headerText: rgb(1, 1, 1),
          stripeBg: rgb(0.96, 0.97, 1),
          borderColor: rgb(0.88, 0.9, 0.96),
        },
        slate: {
          headerBg: rgb(0.18, 0.2, 0.25),
          headerText: rgb(1, 1, 1),
          stripeBg: rgb(0.96, 0.96, 0.97),
          borderColor: rgb(0.85, 0.85, 0.88),
        },
        emerald: {
          headerBg: rgb(0.02, 0.53, 0.38),
          headerText: rgb(1, 1, 1),
          stripeBg: rgb(0.94, 0.98, 0.95),
          borderColor: rgb(0.85, 0.92, 0.88),
        },
      }[theme]

      const rowHeight = 22
      const fontSize = 8.5
      let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      let currentY = pageHeight - margin - 30

      // Draw Title on First Page
      const title = documentTitle.replace(/\.pdf$/i, '').toUpperCase()
      currentPage.drawText(title, {
        x: margin,
        y: pageHeight - margin - 10,
        size: 13,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })

      const drawRow = (
        page: any,
        rowCells: string[],
        y: number,
        isHeader: boolean,
        isStripe: boolean
      ) => {
        // Draw background
        if (isHeader) {
          page.drawRectangle({
            x: margin,
            y,
            width: availableWidth,
            height: rowHeight,
            color: themeColors.headerBg,
          })
        } else if (isStripe && zebraStriping) {
          page.drawRectangle({
            x: margin,
            y,
            width: availableWidth,
            height: rowHeight,
            color: themeColors.stripeBg,
          })
        }

        // Draw cell text
        let curX = margin
        for (let c = 0; c < colCount; c++) {
          const w = colWidths[c]
          const rawText = rowCells[c] || ''
          // Truncate to fit column
          let cellText = rawText
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

        // Draw horizontal bottom border
        page.drawLine({
          start: { x: margin, y },
          end: { x: margin + availableWidth, y },
          thickness: 0.5,
          color: themeColors.borderColor,
        })
      }

      // Draw header row
      drawRow(currentPage, headers, currentY, true, false)
      currentY -= rowHeight

      // Draw data rows
      for (let r = 0; r < rows.length; r++) {
        // Check if page wrap needed
        if (currentY - rowHeight < margin + 20) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight])
          currentY = pageHeight - margin - 20

          if (repeatHeader) {
            drawRow(currentPage, headers, currentY, true, false)
            currentY -= rowHeight
          }
        }

        drawRow(currentPage, rows[r], currentY, false, r % 2 === 1)
        currentY -= rowHeight
      }

      // Add page numbers
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
    } catch (err) {
      console.error(err)
      alert('Could not export PDF table.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Main Toolbar */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Left Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Upload size={14} />
            <span>Open CSV File</span>
          </button>

          <button
            type="button"
            onClick={() => setCsvText(SAMPLE_CSV)}
            className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Load Sample</span>
          </button>

          <button
            type="button"
            onClick={() => setCsvText('')}
            className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={14} />
            <span>Clear</span>
          </button>
        </div>

        {/* Center / Right Settings Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Orientation Selector */}
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

          {/* Table Theme Selector */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none cursor-pointer"
          >
            <option value="indigo">Corporate Indigo</option>
            <option value="slate">Monochrome Slate</option>
            <option value="emerald">Emerald Finance</option>
          </select>

          {/* Export Action */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting || parsedData.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Generating PDF…</span>
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

      {/* Editor & Table Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[550px]">
        {/* CSV Source Editor */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
              <Sheet size={15} className="text-indigo-600" />
              <span>CSV Data Input</span>
            </div>
            <span className="text-[11px] text-zinc-400">
              {headers.length} columns · {rows.length} rows
            </span>
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste CSV, TSV, or spreadsheet text here…"
            className="flex-1 w-full p-4 bg-zinc-50/70 border border-zinc-100 rounded-2xl font-mono text-xs leading-relaxed text-zinc-800 resize-none focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none min-h-[450px]"
          />
        </div>

        {/* Live Formatted Table Preview */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm flex flex-col space-y-3 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
              <TableIcon size={15} className="text-emerald-600" />
              <span>Table Preview</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-zinc-400">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={repeatHeader}
                  onChange={(e) => setRepeatHeader(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Repeat header</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={zebraStriping}
                  onChange={(e) => setZebraStriping(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Zebra stripes</span>
              </label>
            </div>
          </div>

          {/* Table Sheet Container */}
          <div className="flex-1 overflow-auto max-h-[500px] rounded-xl border border-zinc-100">
            {parsedData.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400">
                Paste or upload CSV data to view table preview…
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className={
                      theme === 'indigo'
                        ? 'bg-indigo-600 text-white'
                        : theme === 'slate'
                        ? 'bg-zinc-800 text-white'
                        : 'bg-emerald-700 text-white'
                    }
                  >
                    {headers.map((h, i) => (
                      <th key={i} className="p-2.5 font-bold border-b border-zinc-200 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={`border-b border-zinc-100 transition-colors ${
                        zebraStriping && rIdx % 2 === 1 ? 'bg-zinc-50/70' : 'bg-white'
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
