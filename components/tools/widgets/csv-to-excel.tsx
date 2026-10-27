'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, FileSpreadsheet, Loader2, Table2, Upload, X } from 'lucide-react'
import { createXlsx, parseCsv } from '@/lib/office/openxml-native'

export default function CsvToExcel() {
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<string[][]>([])
  const [sheetName, setSheetName] = useState('Sheet1')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (selectedFile: File) => {
    setError(null)
    setFile(selectedFile)

    try {
      const text = await selectedFile.text()
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        throw new Error('CSV file appears to be empty.')
      }

      setRows(parsed)
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '').slice(0, 31)
      setSheetName(baseName || 'Sheet1')
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not read CSV file.')
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

  const handleDownload = async () => {
    if (!file || rows.length === 0) return
    setIsProcessing(true)
    setError(null)

    try {
      const xlsxBuffer = await createXlsx(rows, sheetName)
      const blob = new Blob([xlsxBuffer as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const downloadUrl = URL.createObjectURL(blob)
      const baseName = file.name.replace(/\.[^/.]+$/, '')

      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${baseName}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err: unknown) {
      console.error(err)
      setError('Failed to generate Excel workbook.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setRows([])
    setSheetName('Sheet1')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const previewHeaders = rows[0] || []
  const previewRows = rows.slice(1, 6)
  const totalColumns = Math.max(...rows.map((r) => r.length), 0)

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/plain"
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
                  Select a CSV file to convert
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Convert CSV or TSV spreadsheets into standard Microsoft Excel (.xlsx) workbooks.
                </p>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <span className="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-600 text-[11px] font-semibold uppercase">
                  CSV
                </span>
                <span className="text-zinc-400 text-xs self-center">→</span>
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold uppercase">
                  XLSX
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
                    {(file.size / 1024).toFixed(1)} KB • {rows.length.toLocaleString()} rows • {totalColumns} columns
                  </p>
                </div>
              </div>

              {/* Table Preview */}
              <div className="mt-5 border border-zinc-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="px-4 py-2.5 bg-zinc-100/70 border-b border-zinc-200/80 flex items-center justify-between text-xs text-zinc-600 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Table2 size={14} className="text-zinc-500" />
                    <span>Data Preview (First {previewRows.length + 1} rows)</span>
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

            {/* Workbook Options */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider block">
                  Sheet Name
                </span>
                <p className="text-xs text-zinc-500 mt-0.5">
                  The label displayed on the worksheet tab in Excel
                </p>
              </div>

              <input
                type="text"
                value={sheetName}
                maxLength={31}
                onChange={(e) => setSheetName(e.target.value)}
                className="w-full sm:w-60 px-3.5 py-2 rounded-xl border border-zinc-200 focus:border-zinc-400 text-xs font-semibold text-zinc-800 outline-none"
                placeholder="Sheet1"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isProcessing || rows.length === 0}
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Building Excel workbook…</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Download Excel Workbook (.xlsx)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="w-full text-center text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              Convert another CSV
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
