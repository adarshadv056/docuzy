'use client'

import React, { useState, useRef, useCallback } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { createXlsx } from '@/lib/office/openxml-native'
import {
  Check,
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

if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

function extractTableFromPageItems(items: any[]): string[][] {
  const textItems = items.filter((item) => item.str && item.str.trim().length > 0)
  if (textItems.length === 0) return []

  // Group by Y
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

  const sortedY = Array.from(rowMap.keys()).sort((a, b) => b - a)

  // Cluster X coordinates
  const allX: number[] = []
  for (const item of textItems) {
    allX.push(Math.round(item.transform?.[4] || 0))
  }
  allX.sort((a, b) => a - b)

  const columnCenters: number[] = []
  for (const x of allX) {
    const existing = columnCenters.find((c) => Math.abs(c - x) <= 24)
    if (existing === undefined) {
      columnCenters.push(x)
    }
  }
  columnCenters.sort((a, b) => a - b)

  const grid: string[][] = []

  for (const y of sortedY) {
    const rowItems = rowMap.get(y)!
    const rowCells = new Array(columnCenters.length).fill('')

    for (const item of rowItems) {
      const x = Math.round(item.transform?.[4] || 0)
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

    if (rowCells.some((c) => c.length > 0)) {
      grid.push(rowCells)
    }
  }

  return grid
}

export default function PdfToExcel() {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'converting' | 'done'>('idle')
  const [progressText, setProgressText] = useState('')
  const [xlsxBytes, setXlsxBytes] = useState<Uint8Array | null>(null)
  const [extractedRows, setExtractedRows] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processPdf = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setPhase('converting')
    setError(null)
    setXlsxBytes(null)

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

      if (fullGrid.length === 0) {
        fullGrid.push(['No structured tabular data detected in PDF.'])
      }

      setExtractedRows(fullGrid.length)
      setProgressText('Packaging into OpenXML Excel (.xlsx)…')

      const xlsx = await createXlsx(fullGrid)
      setXlsxBytes(xlsx)
      setPhase('done')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Could not convert this PDF to Excel.')
      setPhase('idle')
    }
  }, [])

  const handleDownload = () => {
    if (!xlsxBytes || !file) return
    const blob = new Blob([xlsxBytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    a.download = `${baseName}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const startOver = () => {
    setFile(null)
    setXlsxBytes(null)
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
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) processPdf(f)
        }}
        className="hidden"
      />

      {phase === 'idle' && (
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
            if (dropped && dropped.type === 'application/pdf') processPdf(dropped)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 lg:p-14 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-600 bg-indigo-50/50 scale-[0.99]'
              : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
          }`}
        >
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            <FileSpreadsheet size={28} />
          </div>

          <h3 className="text-base font-bold text-zinc-900 mb-1">
            Choose a PDF to convert to Excel (.xlsx)
          </h3>
          <p className="text-xs text-zinc-400 mb-5">
            Extract tables, rows, and numbers directly into an editable Microsoft Excel spreadsheet
          </p>

          <span className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors">
            <Upload size={14} />
            Browse Files
          </span>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-6 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              Standard OpenXML (.xlsx)
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-500" />
              Microsoft Excel &amp; Google Sheets Compatible
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-indigo-500" />
              100% In-House &amp; Private
            </span>
          </div>
        </div>
      )}

      {phase === 'converting' && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-10 text-center space-y-4 shadow-sm">
          <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-900">Extracting Tables to Excel</h3>
            <p className="text-xs text-zinc-400">{progressText}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <X size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {phase === 'done' && xlsxBytes && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Conversion Completed</h3>
              <p className="text-xs text-zinc-400">
                {extractedRows} rows extracted and formatted into Microsoft Excel (.xlsx) workbook
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <TableIcon size={16} className="text-zinc-500" />
              <span className="font-semibold text-zinc-800">
                {file?.name.replace(/\.[^/.]+$/, '')}.xlsx
              </span>
            </div>
            <span className="text-emerald-700 font-semibold">Ready to open in Excel</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <Download size={15} />
              <span>Download Excel Spreadsheet (.xlsx)</span>
            </button>
            <button
              onClick={startOver}
              className="py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw size={15} />
              <span>Convert Another</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
