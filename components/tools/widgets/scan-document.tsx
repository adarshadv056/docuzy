'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import {
  processScannedImage,
  createSampleScans,
  type ScanFilterType,
} from '@/lib/scanner/scanner-filters'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Contrast,
  Download,
  FileText,
  FlipHorizontal,
  Layers,
  Loader2,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  ScanLine,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  VideoOff,
  X,
} from 'lucide-react'

export interface ScannedPageItem {
  id: string
  originalDataUrl: string
  processedDataUrl: string
  filter: ScanFilterType
  brightness: number
  contrast: number
  rotation: number
  width: number
  height: number
}

type PageLayoutSize = 'fit' | 'a4' | 'letter'
type QualityTier = 'high' | 'standard' | 'compact'

export default function ScanDocument() {
  const [pages, setPages] = useState<ScannedPageItem[]>([])
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0)

  // Camera State
  const [cameraActive, setCameraActive] = useState<boolean>(false)
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isShutterFlashing, setIsShutterFlashing] = useState<boolean>(false)

  // PDF Export Settings
  const [pageLayout, setPageLayout] = useState<PageLayoutSize>('a4')
  const [qualityTier, setQualityTier] = useState<QualityTier>('high')
  const [pdfTitle, setPdfTitle] = useState<string>(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `Scan_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
  })

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportProgress, setExportProgress] = useState<string>('')
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pdfFileSize, setPdfFileSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Show detailed adjustments
  const [showAdjustments, setShowAdjustments] = useState<boolean>(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)

  // Revoke previous blob URLs
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    }
  }, [pdfBlobUrl])

  // Stop camera media stream safely
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  // Start camera stream
  const startCamera = useCallback(
    async (facing: 'environment' | 'user' = cameraFacing) => {
      stopCameraStream()
      setCameraError(null)

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported by your browser or environment.')
        return
      }

      if (
        typeof window !== 'undefined' &&
        !window.isSecureContext &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        setCameraError(
          'Camera access requires a secure connection (HTTPS). You can upload photos/scans directly instead.'
        )
        return
      }

      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          })
        } catch {
          // Fallback to basic video constraints
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facing } },
            audio: false,
          })
        }

        streamRef.current = stream
        setCameraFacing(facing)
        setCameraActive(true)

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          try {
            await videoRef.current.play()
          } catch (e) {
            console.warn('Autoplay error:', e)
          }
        }
      } catch (err: unknown) {
        console.error(err)
        const msg = err instanceof Error ? err.message : 'Could not access camera.'
        setCameraError(
          msg.includes('NotAllowedError') || msg.includes('Permission')
            ? 'Camera permission was denied. Please allow camera access in your browser settings, or upload photo files directly.'
            : 'Camera could not be started. Make sure no other application is using it.'
        )
        setCameraActive(false)
      }
    },
    [cameraFacing, stopCameraStream]
  )

  // Attach stream whenever cameraActive or stream changes
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
        videoRef.current.play().catch((err) => console.warn('Video play error:', err))
      }
    }
  }, [cameraActive])

  // Stop stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [stopCameraStream])

  // Toggle front/rear camera
  const switchCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment'
    startCamera(nextFacing)
  }

  // Add new scanned page
  const addScannedPage = async (dataUrl: string, initialFilter: ScanFilterType = 'magic') => {
    try {
      const processed = await processScannedImage(dataUrl, {
        filter: initialFilter,
        brightness: 0,
        contrast: 0,
        rotation: 0,
      })

      const newPage: ScannedPageItem = {
        id: Math.random().toString(36).slice(2, 10),
        originalDataUrl: dataUrl,
        processedDataUrl: processed.dataUrl,
        filter: initialFilter,
        brightness: 0,
        contrast: 0,
        rotation: 0,
        width: processed.width,
        height: processed.height,
      }

      setPages((prev) => {
        const updated = [...prev, newPage]
        setSelectedPageIndex(updated.length - 1)
        return updated
      })

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
        setPdfBlobUrl(null)
      }
    } catch (err: unknown) {
      console.error(err)
      setError('Failed to process image scan.')
    }
  }

  // Capture frame from live video
  const handleCapture = async () => {
    if (!videoRef.current) return

    const video = videoRef.current
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera video is still initializing. Please wait a moment.')
      return
    }

    const vWidth = video.videoWidth
    const vHeight = video.videoHeight

    const canvas = captureCanvasRef.current || document.createElement('canvas')
    canvas.width = vWidth
    canvas.height = vHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, vWidth, vHeight)
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95)

    // Trigger visual screen flash and haptic feedback
    setIsShutterFlashing(true)
    setTimeout(() => setIsShutterFlashing(false), 140)

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(40)
    }

    // Process and append page
    await addScannedPage(rawDataUrl, 'magic')
  }

  // Handle file uploads (from gallery, scanner, or local files)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setError(null)
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(f)
      })

      await addScannedPage(dataUrl, 'magic')
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Load built-in sample document scans
  const handleLoadSample = async () => {
    setError(null)
    try {
      const samples = await createSampleScans()
      for (const sample of samples) {
        await addScannedPage(sample.dataUrl, sample.filter)
      }
    } catch (err: unknown) {
      console.error(err)
      setError('Could not generate sample document scans.')
    }
  }

  // Update filter or adjustments for a specific page
  const updatePage = async (
    index: number,
    updates: Partial<Omit<ScannedPageItem, 'id' | 'originalDataUrl' | 'width' | 'height' | 'processedDataUrl'>>
  ) => {
    const target = pages[index]
    if (!target) return

    const newFilter = updates.filter ?? target.filter
    const newBrightness = updates.brightness ?? target.brightness
    const newContrast = updates.contrast ?? target.contrast
    const newRotation = updates.rotation !== undefined ? (updates.rotation % 360) : target.rotation

    try {
      const processed = await processScannedImage(target.originalDataUrl, {
        filter: newFilter,
        brightness: newBrightness,
        contrast: newContrast,
        rotation: newRotation,
      })

      setPages((prev) => {
        const next = [...prev]
        next[index] = {
          ...target,
          filter: newFilter,
          brightness: newBrightness,
          contrast: newContrast,
          rotation: newRotation,
          processedDataUrl: processed.dataUrl,
          width: processed.width,
          height: processed.height,
        }
        return next
      })

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
        setPdfBlobUrl(null)
      }
    } catch (err: unknown) {
      console.error(err)
    }
  }

  // Apply filter to all pages
  const applyFilterToAll = async (filter: ScanFilterType) => {
    for (let i = 0; i < pages.length; i++) {
      await updatePage(i, { filter })
    }
  }

  // Rotate current page 90 degrees clockwise
  const rotateCurrentPage = () => {
    const current = pages[selectedPageIndex]
    if (!current) return
    const nextRot = (current.rotation + 90) % 360
    updatePage(selectedPageIndex, { rotation: nextRot })
  }

  // Delete page
  const deletePage = (index: number) => {
    setPages((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (selectedPageIndex >= next.length) {
        setSelectedPageIndex(Math.max(0, next.length - 1))
      }
      return next
    })
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl)
      setPdfBlobUrl(null)
    }
  }

  // Move page position in list
  const movePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return
    setPages((prev) => {
      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      return next
    })
    setSelectedPageIndex(toIndex)
  }

  // Export as Multi-Page PDF
  const handleExportPdf = async () => {
    if (pages.length === 0) {
      setError('Please scan or upload at least one page.')
      return
    }

    setIsExporting(true)
    setError(null)
    setExportProgress('Creating PDF document…')

    try {
      const pdfDoc = await PDFDocument.create()
      const totalPages = pages.length

      for (let i = 0; i < totalPages; i++) {
        setExportProgress(`Compiling Page ${i + 1} of ${totalPages}…`)
        const pageItem = pages[i]

        // Fetch image bytes
        const res = await fetch(pageItem.processedDataUrl)
        const bytes = await res.arrayBuffer()
        let embeddedImg
        try {
          embeddedImg = await pdfDoc.embedJpg(bytes)
        } catch {
          embeddedImg = await pdfDoc.embedPng(bytes)
        }

        const imgW = embeddedImg.width
        const imgH = embeddedImg.height

        if (pageLayout === 'fit') {
          // Auto-Fit: Page matches scanned dimensions exactly (in 72 DPI points)
          const pageW = (imgW * 72) / 150
          const pageH = (imgH * 72) / 150
          const page = pdfDoc.addPage([pageW, pageH])
          page.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: pageW,
            height: pageH,
          })
        } else {
          // Standard A4 or US Letter Page
          const isA4 = pageLayout === 'a4'
          const pageW = isA4 ? 595.28 : 612.0
          const pageH = isA4 ? 841.89 : 792.0
          const margin = 24

          const availW = pageW - margin * 2
          const availH = pageH - margin * 2

          const scaleRatio = Math.min(availW / imgW, availH / imgH)
          const drawW = imgW * scaleRatio
          const drawH = imgH * scaleRatio

          const posX = (pageW - drawW) / 2
          const posY = (pageH - drawH) / 2

          const page = pdfDoc.addPage([pageW, pageH])
          page.drawImage(embeddedImg, {
            x: posX,
            y: posY,
            width: drawW,
            height: drawH,
          })
        }
      }

      setExportProgress('Finalizing PDF package…')
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      setPdfBlobUrl(url)
      setPdfFileSize(blob.size)

      // Direct download trigger
      const a = document.createElement('a')
      a.href = url
      const safeFilename = (pdfTitle.trim() || 'Scanned_Document').replace(/[^a-zA-Z0-9_-]/g, '_')
      a.download = `${safeFilename}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Could not generate PDF.'
      setError(msg)
    } finally {
      setIsExporting(false)
      setExportProgress('')
    }
  }

  // Print via standard browser print
  const handlePrint = () => {
    if (pages.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const imagesHtml = pages
      .map(
        (p, idx) => `
        <div style="page-break-after: ${idx < pages.length - 1 ? 'always' : 'auto'}; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh;">
          <img src="${p.processedDataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
        </div>
      `
      )
      .join('\n')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${pdfTitle || 'Scanned Document'}</title>
        <style>
          @page { margin: 0; size: auto; }
          body { margin: 0; padding: 0; background: #ffffff; }
        </style>
      </head>
      <body>
        ${imagesHtml}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            window.close();
          };
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const activePage = pages[selectedPageIndex]

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Hidden Canvas for Video Capture Frame Staging */}
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* Main Action Bar */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Left Actions: Camera & File Upload */}
        <div className="flex items-center gap-2">
          {!cameraActive ? (
            <button
              type="button"
              onClick={() => startCamera()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs"
            >
              <Camera size={15} />
              <span>Start Camera Scanner</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCameraStream}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <VideoOff size={14} />
              <span>Close Camera</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Upload size={14} />
            <span>Upload Photos / Scans</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            className="px-3.5 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Load Sample Scans</span>
          </button>

          {pages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setPages([])
                setSelectedPageIndex(0)
                setPdfBlobUrl(null)
                setError(null)
              }}
              className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={14} />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* Right Info: Page Counter Badge */}
        {pages.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <ScanLine size={14} />
              <span>
                {pages.length} {pages.length === 1 ? 'Page' : 'Pages'} Scanned
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {(error || cameraError) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 text-red-700 text-xs animate-in fade-in">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold">Notice:</strong> {error || cameraError}
          </div>
          <button
            onClick={() => {
              setError(null)
              setCameraError(null)
            }}
            className="hover:opacity-75"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Live Camera Viewfinder */}
      {cameraActive && (
        <div className="relative bg-zinc-950 rounded-3xl overflow-hidden shadow-lg border border-zinc-800 flex flex-col items-center justify-center p-3 animate-in fade-in">
          {/* Shutter Flash Animation */}
          {isShutterFlashing && (
            <div className="absolute inset-0 bg-white z-50 pointer-events-none animate-out fade-out duration-150" />
          )}

          {/* Viewfinder Video Container */}
          <div className="relative w-full max-w-2xl aspect-[4/3] rounded-2xl overflow-hidden bg-black flex items-center justify-center">
            <video
              ref={(node) => {
                videoRef.current = node
                if (node && streamRef.current && node.srcObject !== streamRef.current) {
                  node.srcObject = streamRef.current
                  node.play().catch((err) => console.warn('Video play error:', err))
                }
              }}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Document Alignment Frame Overlay */}
            <div className="absolute inset-6 md:inset-10 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex flex-col justify-between p-3">
              <div className="flex justify-between items-start">
                <span className="w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-sm" />
                <span className="w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-sm" />
              </div>
              <div className="text-center">
                <span className="bg-black/60 backdrop-blur-xs text-white/90 text-[11px] font-medium px-3 py-1 rounded-full border border-white/10 shadow-sm">
                  Align paper document within guides
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-sm" />
                <span className="w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-sm" />
              </div>
            </div>

            {/* Top Camera Controls */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <button
                type="button"
                onClick={switchCamera}
                className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all shadow-md active:scale-95"
                title="Switch Camera (Front/Rear)"
              >
                <FlipHorizontal size={16} />
              </button>
              <button
                type="button"
                onClick={stopCameraStream}
                className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all shadow-md active:scale-95"
                title="Close Camera"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Bottom Shutter Controls */}
          <div className="py-4 flex items-center justify-center gap-6 z-10">
            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleCapture}
              className="w-18 h-18 rounded-full border-4 border-white bg-indigo-600 hover:bg-indigo-500 active:scale-90 flex items-center justify-center shadow-lg transition-transform focus:outline-none"
              title="Capture Page (Shutter)"
            >
              <span className="w-13 h-13 rounded-full bg-white flex items-center justify-center text-indigo-700 shadow-inner">
                <Camera size={26} />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State when no pages and camera not open */}
      {pages.length === 0 && !cameraActive && (
        <div
          onClick={() => startCamera()}
          className="border-2 border-dashed border-zinc-200 hover:border-indigo-400 bg-white/70 hover:bg-indigo-50/20 rounded-3xl p-12 text-center transition-all cursor-pointer"
        >
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
              <Camera size={30} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-zinc-900">
                Start camera scanner, or drop photos
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Capture single or multi-page documents directly with your camera. Includes automatic background whitening, crisp B&W binarization, rotation, and multi-page PDF compilation.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                <Check size={12} className="text-emerald-500" /> Magic Color Whitening
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                <Check size={12} className="text-emerald-500" /> Crisp B&W Document
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                <Check size={12} className="text-emerald-500" /> Zero Cloud Uploads
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Scanned Pages Workspace */}
      {pages.length > 0 && (
        <div className="space-y-6">
          {/* Main Focused Preview & Per-Page Controls */}
          {activePage && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              {/* Toolbar above preview */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-900">
                    Page {selectedPageIndex + 1} of {pages.length}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    ({activePage.width} × {activePage.height}px)
                  </span>
                </div>

                {/* Filter Selector for Active Page */}
                <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => updatePage(selectedPageIndex, { filter: 'magic' })}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      activePage.filter === 'magic'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Magic Color
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePage(selectedPageIndex, { filter: 'bw' })}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      activePage.filter === 'bw'
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    B&W Clean
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePage(selectedPageIndex, { filter: 'grayscale' })}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      activePage.filter === 'grayscale'
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Grayscale
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePage(selectedPageIndex, { filter: 'original' })}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      activePage.filter === 'original'
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Original Photo
                  </button>
                </div>

                {/* Quick Page Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={rotateCurrentPage}
                    className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium flex items-center gap-1"
                    title="Rotate 90° Clockwise"
                  >
                    <RotateCw size={14} />
                    <span>Rotate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAdjustments(!showAdjustments)}
                    className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1 transition-colors ${
                      showAdjustments
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                    title="Adjust Brightness & Contrast"
                  >
                    <Sliders size={14} />
                    <span>Adjust</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyFilterToAll(activePage.filter)}
                    className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-xs font-medium"
                    title="Apply current filter to all pages"
                  >
                    Apply to All
                  </button>

                  <button
                    type="button"
                    onClick={() => deletePage(selectedPageIndex)}
                    className="p-2 rounded-xl border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-500 text-xs"
                    title="Delete Page"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Collapsible Fine-Tuning Sliders */}
              {showAdjustments && (
                <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-zinc-700">
                      <span className="flex items-center gap-1">
                        <Sun size={13} /> Brightness
                      </span>
                      <span>{activePage.brightness}</span>
                    </div>
                    <input
                      type="range"
                      min="-60"
                      max="60"
                      value={activePage.brightness}
                      onChange={(e) =>
                        updatePage(selectedPageIndex, { brightness: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-zinc-700">
                      <span className="flex items-center gap-1">
                        <Contrast size={13} /> Contrast
                      </span>
                      <span>{activePage.contrast}</span>
                    </div>
                    <input
                      type="range"
                      min="-60"
                      max="60"
                      value={activePage.contrast}
                      onChange={(e) =>
                        updatePage(selectedPageIndex, { contrast: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Main Image View */}
              <div className="bg-zinc-100/60 border border-zinc-200/70 rounded-xl p-4 flex items-center justify-center min-h-[360px] max-h-[580px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePage.processedDataUrl}
                  alt={`Scanned Page ${selectedPageIndex + 1}`}
                  className="max-h-[520px] max-w-full object-contain rounded-lg shadow-sm border border-zinc-200 bg-white"
                />
              </div>
            </div>
          )}

          {/* Bottom Filmstrip / Multi-Page Tray */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-600" />
                <span>Pages Tray ({pages.length})</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus size={13} />
                  <span>Scan Next Page</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Upload size={13} />
                  <span>Add File</span>
                </button>
              </div>
            </div>

            {/* Thumbnail Carousel */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1">
              {pages.map((p, idx) => {
                const isSelected = idx === selectedPageIndex
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPageIndex(idx)}
                    className={`group relative shrink-0 w-28 h-36 rounded-xl overflow-hidden border-2 cursor-pointer transition-all flex flex-col justify-between p-1 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-sm scale-102'
                        : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                    }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="w-full h-24 overflow-hidden rounded-lg bg-white flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.processedDataUrl}
                        alt={`Page ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Footer bar with page number and reorder */}
                    <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-zinc-600">
                      <span>P. {idx + 1}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            movePage(idx, idx - 1)
                          }}
                          disabled={idx === 0}
                          className="hover:text-zinc-900 disabled:opacity-20"
                          title="Move Left"
                        >
                          <ArrowLeft size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            movePage(idx, idx + 1)
                          }}
                          disabled={idx === pages.length - 1}
                          className="hover:text-zinc-900 disabled:opacity-20"
                          title="Move Right"
                        >
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Export Settings & PDF Assembly Section */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <FileText size={16} className="text-indigo-600" />
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                PDF Document Export Settings
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Document Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Document Filename</label>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Scanned_Document"
                />
              </div>

              {/* Page Geometry Layout */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Page Dimensions</label>
                <select
                  value={pageLayout}
                  onChange={(e) => setPageLayout(e.target.value as PageLayoutSize)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="a4">Standard A4 (210 × 297 mm)</option>
                  <option value="letter">US Letter (8.5 × 11 in)</option>
                  <option value="fit">Auto-Fit (Match Scan Dimensions)</option>
                </select>
              </div>

              {/* Image Quality Tier */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Output Quality</label>
                <select
                  value={qualityTier}
                  onChange={(e) => setQualityTier(e.target.value as QualityTier)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="high">High Resolution (Crisp Text)</option>
                  <option value="standard">Standard Balanced</option>
                  <option value="compact">Compact / Small File Size</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExporting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
                >
                  {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  <span>Save as PDF ({pages.length} Pages)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isExporting}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Printer size={14} />
                  <span>Print Document</span>
                </button>
              </div>

              {isExporting && (
                <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
                  <Loader2 size={14} className="animate-spin" />
                  <span>{exportProgress}</span>
                </div>
              )}
            </div>
          </div>

          {/* Success Banner if exported */}
          {pdfBlobUrl && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-900 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">Document Scanned & Compiled!</h4>
                  <p className="text-xs text-emerald-700">
                    {pages.length} Pages • {((pdfFileSize || 0) / (1024 * 1024)).toFixed(2)} MB PDF
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={pdfBlobUrl}
                  download={`${(pdfTitle || 'Scanned_Document').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download size={14} />
                  <span>Download PDF</span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
