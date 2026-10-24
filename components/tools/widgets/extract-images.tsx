'use client'

import React, { useState, useRef, useCallback } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { createZip, ZipEntry } from '@/lib/zip/zip-native'
import {
  Download,
  Upload,
  Loader2,
  FileText,
  Image as ImageIcon,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  Archive,
} from 'lucide-react'
import Link from 'next/link'

// Ensure pdfjs worker is configured
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

export interface ExtractedImage {
  id: string
  name: string
  blob: Blob
  dataUrl: string
  width: number
  height: number
  pageNumber: number
  format: 'jpg' | 'png'
  size: number
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function resolveImageObj(page: any, objId: string): Promise<any> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 3000)
    try {
      const isCommon = objId.startsWith('g_')
      const targetPool = isCommon ? page.commonObjs : page.objs
      targetPool.get(objId, (img: any) => {
        clearTimeout(timer)
        resolve(img ?? null)
      })
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

async function convertImageObjToBlob(
  img: any
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; format: 'jpg' | 'png' } | null> {
  // If it's already an ImageBitmap or HTMLImageElement
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    const width = img.width
    const height = img.height
    if (width < 8 || height < 8) return null

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null)
        const dataUrl = canvas.toDataURL('image/png')
        resolve({ blob, dataUrl, width, height, format: 'png' })
      }, 'image/png')
    })
  }

  // Check raw data buffer
  const width = img.width || 0
  const height = img.height || 0
  const data = img.data

  if (!width || !height || !data || width < 8 || height < 8) return null

  // Check if data is already a valid JPEG byte stream (starts with 0xFF 0xD8 0xFF)
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    const blob = new Blob([data], { type: 'image/jpeg' })
    const dataUrl = URL.createObjectURL(blob)
    return { blob, dataUrl, width, height, format: 'jpg' }
  }

  // Paint into Canvas to produce PNG
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const imgData = ctx.createImageData(width, height)

  // Grayscale (kind 1)
  if (img.kind === 1) {
    for (let p = 0; p < width * height; p++) {
      const v = data[p]
      imgData.data[p * 4] = v
      imgData.data[p * 4 + 1] = v
      imgData.data[p * 4 + 2] = v
      imgData.data[p * 4 + 3] = 255
    }
  } else if (img.kind === 2) {
    // RGB (kind 2)
    for (let p = 0; p < width * height; p++) {
      imgData.data[p * 4] = data[p * 3]
      imgData.data[p * 4 + 1] = data[p * 3 + 1]
      imgData.data[p * 4 + 2] = data[p * 3 + 2]
      imgData.data[p * 4 + 3] = 255
    }
  } else {
    // RGBA (kind 3) or raw 4 channels
    if (data.length >= width * height * 4) {
      imgData.data.set(data.subarray(0, width * height * 4))
    } else {
      // Fallback
      imgData.data.set(data)
    }
  }

  ctx.putImageData(imgData, 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null)
      const dataUrl = canvas.toDataURL('image/png')
      resolve({ blob, dataUrl, width, height, format: 'png' })
    }, 'image/png')
  })
}

export default function ExtractImages() {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [progressText, setProgressText] = useState('')
  const [images, setImages] = useState<ExtractedImage[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isZipping, setIsZipping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processPdf = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setPhase('scanning')
    setError(null)
    setImages([])
    setSelectedIds(new Set())

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        useWorkerFetch: false,
        disableFontFace: true,
      })

      const pdf = await loadingTask.promise
      const totalPages = pdf.numPages
      const extracted: ExtractedImage[] = []
      const seenIds = new Set<string>()

      for (let p = 1; p <= totalPages; p++) {
        setProgressText(`Scanning page ${p} of ${totalPages}…`)
        const page = await pdf.getPage(p)
        const ops = await page.getOperatorList()

        for (let i = 0; i < ops.fnArray.length; i++) {
          const fn = ops.fnArray[i]
          if (
            fn === pdfjs.OPS.paintImageXObject ||
            fn === pdfjs.OPS.paintInlineImageXObject ||
            fn === pdfjs.OPS.paintImageMaskXObject ||
            fn === pdfjs.OPS.paintImageXObjectRepeat ||
            fn === (pdfjs.OPS as any).paintJpegXObject
          ) {
            const arg = ops.argsArray[i][0]
            let imgObj: any = null

            if (typeof arg === 'string') {
              if (seenIds.has(arg)) continue
              seenIds.add(arg)
              imgObj = await resolveImageObj(page, arg)
            } else if (arg && typeof arg === 'object') {
              imgObj = arg
            }

            if (imgObj) {
              const converted = await convertImageObjToBlob(imgObj)
              if (converted) {
                const imgNum = extracted.length + 1
                const imgId = `img-p${p}-${imgNum}`
                const ext = converted.format
                const name = `image-p${p}-${imgNum}.${ext}`

                extracted.push({
                  id: imgId,
                  name,
                  blob: converted.blob,
                  dataUrl: converted.dataUrl,
                  width: converted.width,
                  height: converted.height,
                  pageNumber: p,
                  format: converted.format,
                  size: converted.blob.size,
                })
              }
            }
          }
        }
      }

      setImages(extracted)
      // Select all by default
      setSelectedIds(new Set(extracted.map((img) => img.id)))
      setPhase('done')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Could not extract images from this PDF.')
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(images.map((img) => img.id)))
    }
  }

  const downloadSingle = (img: ExtractedImage) => {
    const a = document.createElement('a')
    a.href = img.dataUrl
    a.download = img.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const downloadZip = async () => {
    if (images.length === 0) return
    setIsZipping(true)

    try {
      const targets = images.filter((img) => selectedIds.has(img.id))
      const entries: ZipEntry[] = []

      for (const img of targets) {
        const buffer = await img.blob.arrayBuffer()
        entries.push({
          name: img.name,
          data: new Uint8Array(buffer),
        })
      }

      const zipBytes = await createZip(entries)
      const zipBlob = new Blob([zipBytes as BlobPart], { type: 'application/zip' })
      const zipUrl = URL.createObjectURL(zipBlob)

      const a = document.createElement('a')
      a.href = zipUrl
      const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'extracted-images'
      a.download = `${baseName}-images.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(zipUrl)
    } catch (err) {
      console.error(err)
      setError('Could not generate ZIP archive.')
    } finally {
      setIsZipping(false)
    }
  }

  const startOver = () => {
    setFile(null)
    setImages([])
    setSelectedIds(new Set())
    setPhase('idle')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
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
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            <ImageIcon size={28} />
          </div>

          <h3 className="text-base font-bold text-zinc-900 mb-1">
            Choose a PDF to extract images
          </h3>
          <p className="text-xs text-zinc-400 mb-5">
            Extract all embedded photos, diagrams, and illustrations at original resolution
          </p>

          <span className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors">
            <Upload size={14} />
            Browse Files
          </span>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-6 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              Original Native Quality
            </span>
            <span className="flex items-center gap-1.5">
              <Archive size={14} className="text-indigo-500" />
              1-Click ZIP Download
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-500" />
              100% In-House Processing
            </span>
          </div>
        </div>
      )}

      {/* Scanning Indicator */}
      {phase === 'scanning' && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-10 text-center space-y-4">
          <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-900">Scanning Document for Images</h3>
            <p className="text-xs text-zinc-400">{progressText}</p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {/* Result View */}
      {phase === 'done' && (
        <div className="space-y-6">
          {/* File Header Bar */}
          <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-900 truncate">{file?.name}</p>
                <p className="text-xs text-zinc-400">
                  {images.length === 0
                    ? 'No embedded images found'
                    : `${images.length} image${images.length === 1 ? '' : 's'} extracted`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {images.length > 0 && (
                <>
                  <button
                    onClick={toggleSelectAll}
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 flex items-center gap-1.5 transition-colors"
                  >
                    {selectedIds.size === images.length ? (
                      <>
                        <CheckSquare size={14} className="text-indigo-600" />
                        <span>Deselect All</span>
                      </>
                    ) : (
                      <>
                        <Square size={14} className="text-zinc-400" />
                        <span>Select All</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={downloadZip}
                    disabled={isZipping || selectedIds.size === 0}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {isZipping ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Packaging ZIP…</span>
                      </>
                    ) : (
                      <>
                        <Archive size={13} />
                        <span>Download ZIP ({selectedIds.size})</span>
                      </>
                    )}
                  </button>
                </>
              )}

              <button
                onClick={startOver}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-colors"
                title="Upload different PDF"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Empty State: No Embedded Images */}
          {images.length === 0 && (
            <div className="bg-white border border-zinc-100 rounded-3xl p-10 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto text-zinc-400">
                <ImageIcon size={26} />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-zinc-900">
                  No Embedded Images Found
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  This PDF does not contain standalone image files (photos or raster illustrations). It appears to be composed of pure selectable vector text or forms.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/tools/pdf-to-image"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  <span>Try PDF to Image (Convert Full Pages)</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}

          {/* Images Gallery Grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img) => {
                const isSelected = selectedIds.has(img.id)
                return (
                  <div
                    key={img.id}
                    onClick={() => toggleSelect(img.id)}
                    className={`group relative bg-white border rounded-2xl overflow-hidden shadow-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-600/10'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {/* Image Thumbnail Container */}
                    <div className="relative aspect-4/3 bg-zinc-50 overflow-hidden flex items-center justify-center p-2">
                      {/* Checkerboard background for transparent PNGs */}
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage:
                            'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                          backgroundSize: '12px 12px',
                          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                        }}
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="relative max-w-full max-h-full object-contain transition-transform group-hover:scale-105"
                      />

                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelect(img.id)
                        }}
                        className={`absolute top-2.5 left-2.5 w-6 h-6 rounded-lg flex items-center justify-center transition-colors shadow-xs ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white/90 text-zinc-400 hover:text-zinc-600'
                        }`}
                      >
                        {isSelected && <Check size={14} />}
                      </button>

                      {/* Page Origin Tag */}
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-zinc-900/75 backdrop-blur-xs text-white text-[10px] font-bold">
                        Page {img.pageNumber}
                      </span>
                    </div>

                    {/* Metadata & Actions Card */}
                    <div className="p-3 space-y-2 border-t border-zinc-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-800 uppercase text-[10px] px-1.5 py-0.5 rounded-sm bg-zinc-100">
                          {img.format}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {img.width} × {img.height}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] font-medium text-zinc-500">
                          {formatSize(img.size)}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadSingle(img)
                          }}
                          className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Download Image"
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
