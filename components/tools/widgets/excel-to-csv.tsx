'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Download, FileSpreadsheet, Loader2, Table2, Upload, X } from 'lucide-react'
import { parseXlsx, rowsToCsv, XlsxSheet } from '@/lib/office/openxml-native'

type DelimiterType = ',' | ';' | '\t'

export default function ExcelToCsv() {
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<XlsxSheet[]>([])
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0)
  const [delimiter, setDelimiter] = useState<DelimiterType>(',')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (selectedFile: File) => {
    setError(null)
    setFile(selectedFile)
    setIsProcessing(true)

    try {
      const buffer = await selectedFile.arrayBuffer()
      const parsedSheets = await parseXlsx(new Uint8Array(buffer))

      if (parsedSheets.length === 0 || parsedSheets.every((s) => s.rows.length === 0)) {
        throw new Error('No worksheets or table data found in this Excel workbook.')
      }

      setSheets(parsedSheets)
      setSelectedSheetIndex(0)
    } catch (err: unknown) {
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : 'Could not read Excel file. Please ensure it is a valid .xlsx workbook.'
      )
      setSheets([])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFileSelect(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) handleFileSelect(f)
  }

  const activeSheet = sheets[selectedSheetIndex] || sheets[0]
  const rows = activeSheet?.rows || []
  const previewHeaders = rows[0] || []
  const previewRows = rows.slice(1, 6)
  const totalColumns = Math.max(...rows.map((r) => r.length), 0)

  const handleDownload = () => {
    if (!file || rows.length === 0) return

    try {
      const csvContent = rowsToCsv(rows, delimiter)
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const downloadUrl = URL.createObjectURL(blob)

      const baseName = file.name.replace(/\.[^/.]+$/, '')
      const sheetSuffix = sheets.length > 1 ? `-${activeSheet.name.replace(/[^a-zA-Z0-9_-]/g, '_')}` : ''
      const ext = delimiter === '\t' ? 'tsv' : 'csv'

      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${baseName}${sheetSuffix}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err: unknown) {
      console.error(err)
      setError('Failed to generate CSV file.')
    }
  }

  const handleClear = () => {
    setFile(null)
    setSheets([])
    setSelectedSheetIndex(0)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleInputChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-zinc-200 hover:border-zinc-300 bg-white/70 hover:bg-zinc-50/50 rounded-3xl p-16 text-center cursor-pointer transition-all"
          >
            <div className="max-w-sm mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-500">
                <Upload size={28} />
              </div>

              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Select an Excel file to convert
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Convert Microsoft Excel (.xlsx) workbooks into lightweight, universal CSV files.
                </p>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold uppercase">
                  XLSX
                </span>
                <span className="text-zinc-400 text-xs self-center">→</span>
                <span className="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-600 text-[11px] font-semibold uppercase">
                  CSV
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="workspace"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Summary Card */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-3xl p-6 relative">
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-500 border border-zinc-200 shadow-xs transition-colors"
                title="Clear file"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 truncate max-w-sm">
                    {file.name}
                  </h4>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB • {sheets.length} sheet{sheets.length !== 1 ? 's' : ''} •{' '}
                    {rows.length.toLocaleString()} rows in active sheet
                  </p>
                </div>
              </div>

              {/* Sheet Switcher if multiple sheets */}
              {sheets.length > 1 && (
                <div className="mt-4 pt-4 border-t border-zinc-200/60">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                    Select Sheet to Export
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {sheets.map((sheet, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => setSelectedSheetIndex(sIdx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          selectedSheetIndex === sIdx
                            ? 'bg-zinc-900 text-white shadow-xs'
                            : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        {sheet.name} ({sheet.rows.length} rows)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Preview */}
              <div className="mt-5 border border-zinc-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="px-4 py-2.5 bg-zinc-100/70 border-b border-zinc-200/80 flex items-center justify-between text-xs text-zinc-600 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Table2 size={14} className="text-zinc-500" />
                    <span>Preview: {activeSheet?.name || 'Sheet'}</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-normal">
                    {rows.length > 6 ? `+${rows.length - 6} more rows` : ''}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        {previewHeaders.map((h, i) => (
                          <th key={i} className="px-3.5 py-2 font-bold text-zinc-800 whitespace-nowrap">
                            {h || `Col ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {previewRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-zinc-50/50">
                          {Array.from({ length: totalColumns }).map((_, cIdx) => (
                            <td key={cIdx} className="px-3.5 py-1.5 text-zinc-600 whitespace-nowrap">
                              {row[cIdx] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Delimiter Options */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider block">
                  CSV Delimiter
                </span>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Choose field separator for the exported spreadsheet
                </p>
              </div>

              <div className="flex items-center gap-2">
                {[
                  { id: ',' as DelimiterType, label: 'Comma (,)' },
                  { id: ';' as DelimiterType, label: 'Semicolon (;)' },
                  { id: '\t' as DelimiterType, label: 'Tab (TSV)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDelimiter(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      delimiter === opt.id
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {delimiter === opt.id && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isProcessing || rows.length === 0}
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing workbook…</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>
                    Download {delimiter === '\t' ? 'TSV' : 'CSV'} ({rows.length.toLocaleString()} rows)
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="w-full text-center text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              Convert another Excel file
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
