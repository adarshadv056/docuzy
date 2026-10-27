'use client'

import React, { useState, useRef, useCallback, useMemo } from 'react'
import * as pdfjs from 'pdfjs-dist'
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  Settings2,
  Table as TableIcon,
  Upload,
  X,
} from 'lucide-react'

// Ensure pdfjs worker is configured
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

/**
 * Intelligent Table Extractor from PDF text coordinates
 */
function extractTableFromPageItems(items: any[]): string[][] {
  const textItems = items.filter((item) => item.str && item.str.trim().length > 0)
  if (textItems.length === 0) return []

  // Group items by line Y coordinate (within 4 points)
  const rowMap = new Map<number, any[]>()
  for (const item of textItems) {
    const y = Math.round(item.transform?.[5] || 0)
    let foundY = Array.from(rowMap.keys()).find((ky) => Math.abs(ky - y) <= 4)
    if (foundY === undefined) {
      foundY = y
      rowMap.set(y, [])
    }
    rowMap.get(foundY)!.push(item)
  }

  // Sort rows top-to-bottom
  const sortedY = Array.from(rowMap.keys()).sort((a, b) => b - a)

  // Find column boundaries by collecting all X coordinates
  const allX: number[] = []
  for (const item of textItems) {
    allX.push(Math.round(item.transform?.[4] || 0))
  }
  allX.sort((a, b) => a - b)

  // Cluster X coordinates into distinct columns
  const columnCenters: number[] = []
  for (const x of allX) {
    const existing = columnCenters.find((c) => Math.abs(c - x) <= 24)
    if (existing === undefined) {
      columnCenters.push(x)
    }
  }
  columnCenters.sort((a, b) => a - b)

  // Build grid
  const grid: string[][] = []

  for (const y of sortedY) {
    const rowItems = rowMap.get(y)!
    const rowCells = new Array(columnCenters.length).fill('')

    for (const item of rowItems) {
      const x = Math.round(item.transform?.[4] || 0)
      // Find closest column center
      let closestCol = 0
      let minDiff = Infinity
      for (let c = 0; c < columnCenters.length; c++) {
        const diff = Math.abs(columnCenters[c] - x)
        if (diff < minDiff) {
          minDiff = diff
          closestCol = c
        }
      }

      const existing = rowCells[closestCol]
      rowCells[closestCol] = existing ? `${existing} ${item.str.trim()}` : item.str.trim()
    }

    // Only add row if it contains at least one non-empty cell
    if (rowCells.some((c) => c.length > 0)) {
      grid.push(rowCells)
    }
  }

  return grid
}

function formatAsCSV(grid: string[][], delimiter: string): string {
  return grid
    .map((row) =>
      row
        .map((cell) => {
          let val = (cell || '').trim()
          if (val.includes(delimiter) || val.includes('"') || val.includes('\n')) {
            val = `"${val.replace(/"/g, '""')}"`
          }
          return val
        })
        .join(delimiter)
    )
    .join('\n')
}

export default function PdfToCsv() {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'done'>('idle')
  const [progressText, setProgressText] = useState('')
  const [tableData, setTableData] = useState<string[][]>([])
  const [delimiter, setDelimiter] = useState<',' | '\t' | ';'>(';')
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processPdf = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setPhase('parsing')
    setError(null)
    setTableData([])

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        useWorkerFetch: false,
        disableFontFace: true,
      })

      const pdf = await loadingTask.promise
      const totalPages = pdf.numPages
      const fullGrid: string[][] = []

      for (let p = 1; p <= totalPages; p++) {
        setProgressText(`Extracting tables from page ${p} of ${totalPages}…`)
        const page = await pdf.getPage(p)
        const textContent = await page.getTextContent()

        const pageGrid = extractTableFromPageItems(textContent.items)
        for (const row of pageGrid) {
          fullGrid.push(row)
        }
      }

      setTableData(fullGrid)
      setPhase('done')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Could not extract tabular data from this PDF.')
      setPhase('idle')
    }
  }, [])

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

  const csvString = useMemo(() => formatAsCSV(tableData, delimiter), [tableData, delimiter])

  const handleCopy = () => {
    if (!csvString) return
    navigator.clipboard.writeText(csvString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!csvString || !file) return
    const ext = delimiter === '\t' ? 'tsv' : 'csv'
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    a.download = `${baseName}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const startOver = () => {
    setFile(null)
    setTableData([])
    setPhase('idle')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
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
            <FileSpreadsheet size={28} />
          </div>

          <h3 className="text-base font-bold text-zinc-900 mb-1">
            Choose a PDF to extract tables into CSV
          </h3>
          <p className="text-xs text-zinc-400 mb-5">
            Auto-detects rows, columns, and numeric tables, exporting directly to Excel-ready CSV
          </p>

          <span className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors">
            <Upload size={14} />
            Browse Files
          </span>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-6 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <TableIcon size={14} className="text-emerald-500" />
              Smart Coordinate Alignment
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-indigo-500" />
              Excel &amp; Google Sheets Ready
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-amber-500" />
              100% In-Browser Privacy
            </span>
          </div>
        </div>
      )}

      {/* Parsing Progress */}
      {phase === 'parsing' && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-10 text-center space-y-4 shadow-sm">
          <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-900">Analyzing Document Structure</h3>
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
                  {tableData.length} rows extracted · {tableData[0]?.length || 0} columns detected
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Delimiter Selector */}
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as any)}
                className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none cursor-pointer"
              >
                <option value=";">Semicolon (;)</option>
                <option value=",">Comma (,)</option>
                <option value="&#9;">Tab (TSV)</option>
              </select>

              {/* View Toggle */}
              <div className="flex items-center bg-zinc-100 p-1 rounded-xl text-xs font-semibold text-zinc-600">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                    viewMode === 'table' ? 'bg-white text-zinc-900 shadow-xs' : 'hover:text-zinc-900'
                  }`}
                >
                  <TableIcon size={13} />
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('raw')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                    viewMode === 'raw' ? 'bg-white text-zinc-900 shadow-xs' : 'hover:text-zinc-900'
                  }`}
                >
                  <FileSpreadsheet size={13} />
                  <span>CSV Text</span>
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
                <span>Download CSV</span>
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

          {/* Table / Raw View Sheet */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm min-h-[450px]">
            {tableData.length === 0 ? (
              <div className="p-16 text-center text-xs text-zinc-400">
                No tabular data could be identified in this PDF.
              </div>
            ) : viewMode === 'table' ? (
              <div className="overflow-x-auto rounded-xl border border-zinc-100 max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-900 text-white">
                      {tableData[0].map((h, i) => (
                        <th key={i} className="p-2.5 font-bold border-b border-zinc-700 whitespace-nowrap">
                          {h || `Col ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.slice(1).map((row, rIdx) => (
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
              </div>
            ) : (
              <textarea
                readOnly
                value={csvString}
                className="w-full h-[550px] p-4 bg-zinc-50/70 border border-zinc-100 rounded-2xl font-mono text-xs leading-relaxed text-zinc-800 resize-none outline-none"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
