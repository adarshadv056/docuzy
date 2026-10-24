'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactCrop, { type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument, type PDFPage } from 'pdf-lib'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Crop as CropIcon,
  Download,
  FileText,
  Loader2,
  Scissors,
  Upload,
  X,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type Unit = 'mm' | 'pt' | 'in'
type Mode = 'crop' | 'resize'

const PT_PER_MM = 72 / 25.4
const PT_PER_IN = 72

const toPoints = (value: number, unit: Unit) =>
  unit === 'mm' ? value * PT_PER_MM : unit === 'in' ? value * PT_PER_IN : value

const fromPoints = (points: number, unit: Unit) =>
  unit === 'mm' ? points / PT_PER_MM : unit === 'in' ? points / PT_PER_IN : points

const round = (value: number) => Number(value.toFixed(3)).toString()

/** A rectangle in PDF user space (y grows upwards). */
interface UserRect {
  x: number
  y: number
  width: number
  height: number
}

/** A rectangle on the visible page, in points, origin at the bottom-left. */
interface DisplayRect {
  left: number
  bottom: number
  width: number
  height: number
}

interface Margins {
  left: number
  right: number
  top: number
  bottom: number
}

const SIZE_PRESETS = [
  { key: 'a4', label: 'A4', width: 595.28, height: 841.89 },
  { key: 'a5', label: 'A5', width: 419.53, height: 595.28 },
  { key: 'letter', label: 'Letter', width: 612, height: 792 },
  { key: 'legal', label: 'Legal', width: 612, height: 1008 },
  { key: 'tabloid', label: 'Tabloid', width: 792, height: 1224 },
]

/** The visible area of a page: the crop box intersected with the media box. */
function visibleBox(page: PDFPage): UserRect {
  const media = page.getMediaBox()
  const crop = page.getCropBox()
  const x0 = Math.max(media.x, crop.x)
  const y0 = Math.max(media.y, crop.y)
  const x1 = Math.min(media.x + media.width, crop.x + crop.width)
  const y1 = Math.min(media.y + media.height, crop.y + crop.height)
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) }
}

const rotationOf = (page: PDFPage) => ((page.getRotation().angle % 360) + 360) % 360

/** Size of the page as the reader sees it (a quarter turn swaps the axes). */
function displaySize(box: UserRect, rotation: number) {
  return rotation === 90 || rotation === 270
    ? { width: box.height, height: box.width }
    : { width: box.width, height: box.height }
}

/** Map a point on the visible page back into PDF user space. */
function displayToUser(box: UserRect, rotation: number, xd: number, yd: number): [number, number] {
  switch (rotation) {
    case 90:
      return [box.x + box.width - yd, box.y + xd]
    case 180:
      return [box.x + box.width - xd, box.y + box.height - yd]
    case 270:
      return [box.x + yd, box.y + box.height - xd]
    default:
      return [box.x + xd, box.y + yd]
  }
}

/** Map a rectangle on the visible page into PDF user space. */
function displayRectToUser(box: UserRect, rotation: number, rect: DisplayRect): UserRect {
  const [x1, y1] = displayToUser(box, rotation, rect.left, rect.bottom)
  const [x2, y2] = displayToUser(box, rotation, rect.left + rect.width, rect.bottom + rect.height)
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  return { x, y, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
}

/** Wrap a page's content in a transformation matrix without touching it. */
function wrapWithMatrix(page: PDFPage, matrix: [number, number, number, number, number, number]) {
  const context = page.doc.context
  const start = context.register(context.flateStream(`q\n${matrix.map(round).join(' ')} cm\n`))
  const end = context.register(context.flateStream('Q\n'))
  page.node.wrapContentStreams(start, end)
}

/** Crop a page by trimming the given margins off its visible area. */
function cropPage(page: PDFPage, margins: Margins) {
  const box = visibleBox(page)
  const rotation = rotationOf(page)
  const size = displaySize(box, rotation)

  const left = Math.max(0, Math.min(margins.left, size.width))
  const right = Math.max(0, Math.min(margins.right, size.width - left))
  const bottom = Math.max(0, Math.min(margins.bottom, size.height))
  const top = Math.max(0, Math.min(margins.top, size.height - bottom))

  const rect = displayRectToUser(box, rotation, {
    left,
    bottom,
    width: size.width - left - right,
    height: size.height - bottom - top,
  })

  page.setMediaBox(rect.x, rect.y, rect.width, rect.height)
  page.setCropBox(rect.x, rect.y, rect.width, rect.height)
}

/**
 * Transform that fits the visible page into a target page size.
 *
 * The page keeps its `/Rotate`, so the matrix only needs a uniform scale and
 * a translation: composing the visible-space scale with the page's rotation
 * and back again cancels the rotation terms out. That matters because PDF
 * renderers mis-handle a `cm` matrix that carries rotation terms.
 *
 * Returns the matrix plus the new user-space box (swapped for a quarter
 * turn, so the page still reads as the target size on screen).
 */
function fitMatrix(box: UserRect, rotation: number, targetWidth: number, targetHeight: number) {
  const quarterTurn = rotation === 90 || rotation === 270
  const size = displaySize(box, rotation)
  const scale = Math.min(targetWidth / size.width, targetHeight / size.height)
  const tx = (targetWidth - scale * size.width) / 2
  const ty = (targetHeight - scale * size.height) / 2

  const x0 = box.x
  const y0 = box.y
  const x1 = box.x + box.width
  const y1 = box.y + box.height

  let e: number
  let f: number
  switch (rotation) {
    case 90:
      e = targetHeight - scale * x1 - ty
      f = tx - scale * y0
      break
    case 180:
      e = targetWidth - scale * x1 - tx
      f = targetHeight - scale * y1 - ty
      break
    case 270:
      e = ty - scale * x0
      f = targetWidth - scale * y1 - tx
      break
    default:
      e = tx - scale * x0
      f = ty - scale * y0
      break
  }

  return {
    matrix: [scale, 0, 0, scale, e, f] as [number, number, number, number, number, number],
    newUserWidth: quarterTurn ? targetHeight : targetWidth,
    newUserHeight: quarterTurn ? targetWidth : targetHeight,
  }
}

/** Resize a page, optionally scaling the content into the new page. */
function resizePage(page: PDFPage, targetWidth: number, targetHeight: number, fitContent: boolean) {
  const box = visibleBox(page)
  const rotation = rotationOf(page)

  if (!fitContent) {
    // Keep the content where it is; only the page box changes. A quarter
    // turn swaps the axes, so the user-space box is swapped to match.
    const quarterTurn = rotation === 90 || rotation === 270
    const width = quarterTurn ? targetHeight : targetWidth
    const height = quarterTurn ? targetWidth : targetHeight
    page.setMediaBox(box.x, box.y, width, height)
    page.setCropBox(box.x, box.y, width, height)
    return
  }

  const { matrix, newUserWidth, newUserHeight } = fitMatrix(box, rotation, targetWidth, targetHeight)
  wrapWithMatrix(page, matrix)

  page.setMediaBox(0, 0, newUserWidth, newUserHeight)
  page.setCropBox(0, 0, newUserWidth, newUserHeight)
  // `/Rotate` stays untouched: the page keeps its orientation and the content
  // is scaled into it, upright.
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * The drag-first selection is the single source of truth: the percent crop is
 * what `react-image-crop` moves, and margins, point values and the applied
 * CropBox are all derived from it (never the other way around).
 *
 * Seeded once per page so the border, its 8 handles and the dimmed surround are
 * visible before the user touches anything.
 */
const DEFAULT_CROP: PercentCrop = { unit: '%', x: 5, y: 5, width: 90, height: 90 }
const FULL_PAGE_CROP: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 }

/** Pointer drags cannot shrink the selection below this many rendered pixels. */
const MIN_SELECTION_PX = 24
/** Typed margins always leave at least this fraction of the page. */
const MIN_SELECTION_FRACTION = 0.01

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

const formatMeasure = (value: number) =>
  value >= 100 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, '')

export default function CropPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [mode, setMode] = useState<Mode>('crop')

  // Preview state
  const [previewPage, setPreviewPage] = useState(1)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null)
  const [previewRotation, setPreviewRotation] = useState(0)
  const [isRendering, setIsRendering] = useState(false)

  // Crop state — the percent selection is the single source of truth
  const [crop, setCrop] = useState<PercentCrop | null>(null)
  const [unit, setUnit] = useState<Unit>('mm')
  const [isTrimming, setIsTrimming] = useState(false)

  // Resize state
  const [presetKey, setPresetKey] = useState('a4')
  const [customWidth, setCustomWidth] = useState(210)
  const [customHeight, setCustomHeight] = useState(297)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [fitContent, setFitContent] = useState(true)

  // Output / scope
  const [scope, setScope] = useState<'all' | 'range'>('all')
  const [fromPage, setFromPage] = useState(1)
  const [toPage, setToPage] = useState(1)
  const [output, setOutput] = useState<Uint8Array | null>(null)
  const [outputKey, setOutputKey] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{ bytes: Uint8Array; originalSize: number; newSize: number; affected: number } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Identity (file + page) of the page the selection was last seeded for. */
  const cropSeedRef = useRef<string | null>(null)

  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')
    setPreviewUrl(null)
    setOutput(null)
    setOutputKey(null)
    setCrop(null)
    cropSeedRef.current = null
    setPageCount(0)
    setFile(null)

    try {
      const buffer = await selectedFile.arrayBuffer()
      // pdfjs detaches the buffer it is given, so it always gets a copy and
      // the original bytes stay intact for pdf-lib.
      const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise
      setSourceBuffer(buffer)
      setPageCount(doc.numPages)
      setFromPage(1)
      setToPage(doc.numPages)
      setPreviewPage(1)
      setFile(selectedFile)
    } catch (err) {
      console.error(err)
      setError(
        'This PDF could not be opened. It may be password protected or damaged — try unlocking it first.'
      )
    }
  }, [])

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      loadFile(selectedFile)
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped && dropped.type === 'application/pdf') {
      loadFile(dropped)
    }
  }

  const startOver = () => {
    setFile(null)
    setSourceBuffer(null)
    setOutput(null)
    setOutputKey(null)
    setPreviewUrl(null)
    setResult(null)
    setPhase('idle')
    setError(null)
    setPageCount(0)
    setCrop(null)
    cropSeedRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const affectedFrom = scope === 'all' ? 1 : Math.min(fromPage, toPage)
  const affectedTo = scope === 'all' ? pageCount : Math.max(fromPage, toPage)
  const affectedCount = Math.max(0, Math.min(affectedTo, pageCount) - Math.max(1, affectedFrom) + 1)

  // --- target page size (resize mode) --------------------------------------
  const targetSize = useMemo(() => {
    if (presetKey !== 'custom') {
      const preset = SIZE_PRESETS.find((p) => p.key === presetKey)!
      return orientation === 'portrait'
        ? { width: preset.width, height: preset.height }
        : { width: preset.height, height: preset.width }
    }
    const width = toPoints(customWidth, unit)
    const height = toPoints(customHeight, unit)
    return orientation === 'portrait' ? { width, height } : { width: height, height: width }
  }, [presetKey, orientation, customWidth, customHeight, unit])

  // --- crop selection on the visible page, in points -----------------------
  // The percent crop is authored by dragging; everything below derives from it.
  const cropRect = useMemo<DisplayRect | null>(() => {
    if (!crop || !previewSize) return null
    const left = (crop.x / 100) * previewSize.width
    const width = (crop.width / 100) * previewSize.width
    const height = (crop.height / 100) * previewSize.height
    const top = (crop.y / 100) * previewSize.height
    if (width <= 0 || height <= 0) return null
    return { left, bottom: previewSize.height - top - height, width, height }
  }, [crop, previewSize])

  /** Margins between the selection and the visible page, in points. */
  const cropMargins = useMemo<Margins | null>(() => {
    if (!cropRect || !previewSize) return null
    return {
      left: cropRect.left,
      right: Math.max(0, previewSize.width - cropRect.left - cropRect.width),
      top: Math.max(0, previewSize.height - cropRect.bottom - cropRect.height),
      bottom: cropRect.bottom,
    }
  }, [cropRect, previewSize])

  /** The same margins in the unit the user is reading them in. */
  const margins = useMemo<Margins>(
    () => ({
      left: fromPoints(cropMargins?.left ?? 0, unit),
      right: fromPoints(cropMargins?.right ?? 0, unit),
      top: fromPoints(cropMargins?.top ?? 0, unit),
      bottom: fromPoints(cropMargins?.bottom ?? 0, unit),
    }),
    [cropMargins, unit]
  )

  const selectionSize = useMemo(
    () => (cropRect ? { width: fromPoints(cropRect.width, unit), height: fromPoints(cropRect.height, unit) } : null),
    [cropRect, unit]
  )

  /** A full-page selection means there is nothing to trim. */
  const isFullPageCrop =
    cropMargins !== null &&
    cropMargins.left < 0.01 &&
    cropMargins.right < 0.01 &&
    cropMargins.top < 0.01 &&
    cropMargins.bottom < 0.01

  // --- build the output document -------------------------------------------
  const settingsKey = useMemo(() => {
    if (mode === 'crop') {
      // The crop only affects the output on Apply, so preview work stays keyed
      // to the scope alone.
      return `crop|${affectedFrom}|${affectedTo}`
    }
    return `resize|${affectedFrom}|${affectedTo}|${presetKey}|${customWidth}|${customHeight}|${orientation}|${fitContent}|${unit}`
  }, [mode, affectedFrom, affectedTo, presetKey, customWidth, customHeight, orientation, fitContent, unit])

  useEffect(() => {
    if (!sourceBuffer || !file || mode !== 'resize') return
    let cancelled = false

    const build = async () => {
      try {
        const doc = await PDFDocument.load(sourceBuffer.slice(0), {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
        })
        doc.getPages().forEach((page, index) => {
          const pageNumber = index + 1
          if (pageNumber < affectedFrom || pageNumber > affectedTo) return
          resizePage(page, targetSize.width, targetSize.height, fitContent)
        })
        const bytes = await doc.save()
        if (cancelled) return
        setOutput(bytes)
        setOutputKey(settingsKey)
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setError('Could not resize this PDF. Try a different file.')
      }
    }

    build()
    return () => {
      cancelled = true
    }
  }, [sourceBuffer, file, mode, affectedFrom, affectedTo, targetSize, fitContent, settingsKey])

  // --- preview --------------------------------------------------------------
  useEffect(() => {
    if (!file) return
    let cancelled = false

    const draw = async () => {
      setIsRendering(true)
      try {
        const source =
          mode === 'resize' && output && outputKey === settingsKey
            ? await pdfjs.getDocument({ data: output.slice(0) }).promise
            : await pdfjs.getDocument({ data: (sourceBuffer as ArrayBuffer).slice(0) }).promise

        const page = await source.getPage(Math.min(previewPage, source.numPages))
        if (cancelled) return

        const viewport = page.getViewport({ scale: 1 })
        setPreviewSize({ width: viewport.width, height: viewport.height })
        setPreviewRotation(page.rotate || 0)

        // Seed a centred selection once per file/page so there is a border and
        // visible handles to grab immediately (and the surround is dimmed).
        if (mode === 'crop') {
          const seedKey = `${file.name}|${file.size}|${file.lastModified}|${previewPage}|${viewport.width}x${viewport.height}`
          if (cropSeedRef.current !== seedKey) {
            cropSeedRef.current = seedKey
            setCrop({ ...DEFAULT_CROP })
          }
        }

        const scaled = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(scaled.width))
        canvas.height = Math.max(1, Math.floor(scaled.height))
        const context = canvas.getContext('2d')
        if (!context) return

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({ canvasContext: context, viewport: scaled, canvas }).promise
        if (cancelled) return

        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.88))
      } catch (err) {
        console.warn('Preview failed', err)
      } finally {
        if (!cancelled) setIsRendering(false)
      }
    }

    draw()
    return () => {
      cancelled = true
    }
  }, [file, mode, output, outputKey, settingsKey, previewPage, sourceBuffer])

  // --- crop selection <-> margins ------------------------------------------
  /** Typed margins update the crop (the single source of truth). */
  const setCropFromMargins = (next: Margins) => {
    if (!previewSize) return
    const pageWidth = previewSize.width
    const pageHeight = previewSize.height
    const minWidth = pageWidth * MIN_SELECTION_FRACTION
    const minHeight = pageHeight * MIN_SELECTION_FRACTION

    const left = clamp(toPoints(next.left, unit), 0, pageWidth - minWidth)
    const right = clamp(toPoints(next.right, unit), 0, pageWidth - left - minWidth)
    const top = clamp(toPoints(next.top, unit), 0, pageHeight - minHeight)
    const bottom = clamp(toPoints(next.bottom, unit), 0, pageHeight - top - minHeight)

    setCrop({
      unit: '%',
      x: (left / pageWidth) * 100,
      y: (top / pageHeight) * 100,
      width: ((pageWidth - left - right) / pageWidth) * 100,
      height: ((pageHeight - top - bottom) / pageHeight) * 100,
    })
  }

  const resetCrop = () => setCrop({ ...FULL_PAGE_CROP })

  /** Detect the ink bounding box of the page and crop to it. */
  const trimWhiteMargins = async () => {
    if (!sourceBuffer || !previewSize) return
    setIsTrimming(true)
    try {
      const doc = await pdfjs.getDocument({ data: sourceBuffer.slice(0) }).promise
      const page = await doc.getPage(previewPage)
      const viewport = page.getViewport({ scale: 1 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: context, viewport, canvas }).promise

      const data = context.getImageData(0, 0, canvas.width, canvas.height).data
      let minX = canvas.width
      let minY = canvas.height
      let maxX = -1
      let maxY = -1

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4
          // Anything that is not near-white counts as content.
          if (data[index] > 245 && data[index + 1] > 245 && data[index + 2] > 245) continue
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }

      if (maxX < 0 || maxY < 0) {
        setError('This page looks blank — there is nothing to trim.')
        return
      }

      // Leave a small breathing room around the content.
      const padding = 6
      const scaleX = previewSize.width / canvas.width
      const scaleY = previewSize.height / canvas.height
      const left = Math.max(0, (minX - padding) * scaleX)
      const right = Math.max(0, (canvas.width - maxX - 1 - padding) * scaleX)
      const top = Math.max(0, (minY - padding) * scaleY)
      const bottom = Math.max(0, (canvas.height - maxY - 1 - padding) * scaleY)

      setCrop({
        unit: '%',
        x: (left / previewSize.width) * 100,
        y: (top / previewSize.height) * 100,
        width: ((previewSize.width - left - right) / previewSize.width) * 100,
        height: ((previewSize.height - top - bottom) / previewSize.height) * 100,
      })
    } catch (err) {
      console.error(err)
      setError('Could not detect the page margins. Try a different file.')
    } finally {
      setIsTrimming(false)
    }
  }

  // --- apply ----------------------------------------------------------------
  const applyChanges = async () => {
    if (!file || !sourceBuffer || affectedCount === 0) return
    if (mode === 'crop' && !cropMargins) return
    setPhase('working')
    setError(null)

    try {
      const doc = await PDFDocument.load(sourceBuffer.slice(0), {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      })

      doc.getPages().forEach((page, index) => {
        const pageNumber = index + 1
        if (pageNumber < affectedFrom || pageNumber > affectedTo) return
        if (mode === 'crop') {
          if (cropMargins) cropPage(page, cropMargins)
        } else {
          resizePage(page, targetSize.width, targetSize.height, fitContent)
        }
      })

      const bytes = await doc.save()
      setResult({
        bytes,
        originalSize: file.size,
        newSize: bytes.byteLength,
        affected: affectedCount,
      })
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Could not build the new PDF. Try a different file.')
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([result.bytes.slice().buffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mode === 'crop' ? 'cropped' : 'resized'}-${file.name}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const canApply =
    affectedCount > 0 && (mode === 'resize' ? outputKey === settingsKey : cropMargins !== null)

  if (phase === 'done' && result) {
    return (
      <div className="bg-white border border-zinc-100 rounded-2xl p-8 shadow-sm">
        <div className="mb-6">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            {mode === 'crop' ? <CropIcon size={22} className="text-emerald-600" /> : <Scissors size={22} className="text-emerald-600" />}
          </div>
          <h3 className="text-lg font-bold text-zinc-900">
            {mode === 'crop' ? 'Your PDF is cropped' : 'Your PDF is resized'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {result.affected} page{result.affected === 1 ? '' : 's'} {mode === 'crop' ? 'cropped' : 'resized'}
            {mode === 'resize' ? ` to ${Math.round(targetSize.width)} × ${Math.round(targetSize.height)} pt` : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Original</p>
            <p className="text-lg font-bold text-zinc-500">{formatSize(result.originalSize)}</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">New file</p>
            <p className="text-lg font-bold text-zinc-900">{formatSize(result.newSize)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={downloadResult}
            className="w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download {mode === 'crop' ? 'cropped' : 'resized'} PDF
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setPhase('idle')}
              className="flex-1 py-3 text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Back to editing
            </button>
            <button
              onClick={startOver}
              className="flex-1 py-3 text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!file) {
    return (
      <div>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDraggingFile(true)
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer group ${
            isDraggingFile ? 'border-indigo-400 bg-indigo-50/40' : 'border-zinc-200 hover:border-zinc-400 bg-white'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelection}
            accept="application/pdf"
            className="hidden"
          />
          <div className="space-y-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-500 group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <p className="text-sm font-semibold text-zinc-900">Select a PDF to crop or resize</p>
            <p className="text-xs text-zinc-400">Drag and drop it here, or click to browse</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* File header */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0 text-zinc-400">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate">{file.name}</p>
            <p className="text-xs text-zinc-400">
              {pageCount} page{pageCount === 1 ? '' : 's'} · {formatSize(file.size)}
            </p>
          </div>
        </div>
        <button
          onClick={startOver}
          className="shrink-0 p-2 text-zinc-300 hover:text-red-500 transition-colors"
          aria-label="Remove file"
        >
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-2 bg-zinc-50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setMode('crop')}
          className={`px-5 py-2.5 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-2 ${
            mode === 'crop' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <CropIcon size={14} />
          Crop
        </button>
        <button
          onClick={() => setMode('resize')}
          className={`px-5 py-2.5 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-2 ${
            mode === 'resize' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <Scissors size={14} />
          Resize
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6 order-2 lg:order-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 flex items-center gap-2">
              Preview
              {isRendering && <Loader2 size={12} className="animate-spin text-zinc-400" />}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                disabled={previewPage <= 1}
                className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ArrowLeft size={14} />
              </button>
              <span className="text-[10px] font-bold text-zinc-500 tabular-nums">
                {previewPage} / {pageCount}
              </span>
              <button
                onClick={() => setPreviewPage((p) => Math.min(pageCount, p + 1))}
                disabled={previewPage >= pageCount}
                className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm flex items-center justify-center p-4 min-h-[380px]">
            {previewUrl ? (
              mode === 'crop' ? (
                <ReactCrop
                  crop={crop ?? undefined}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  keepSelection
                  minWidth={MIN_SELECTION_PX}
                  minHeight={MIN_SELECTION_PX}
                  className="max-h-[460px] [&_.ReactCrop__selection-addon]:pointer-events-none"
                  renderSelectionAddon={() =>
                    selectionSize && (
                      <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums shadow-sm">
                        {formatMeasure(selectionSize.width)} × {formatMeasure(selectionSize.height)} {unit}
                      </div>
                    )
                  }
                >
                  <img src={previewUrl} alt={`Page ${previewPage}`} className="max-h-[460px] max-w-full object-contain" />
                </ReactCrop>
              ) : (
                <img
                  src={previewUrl}
                  alt={`Page ${previewPage}`}
                  className="max-h-[460px] max-w-full object-contain"
                />
              )
            ) : (
              <Loader2 size={20} className="animate-spin text-zinc-300" />
            )}
          </div>

          {previewSize && (
            <p className="mt-3 text-[11px] text-zinc-400 text-center">
              Page {previewPage} · {Math.round(previewSize.width)} × {Math.round(previewSize.height)} pt
              {previewRotation !== 0 ? ` · turned ${previewRotation}°` : ''}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm space-y-7 h-fit order-1 lg:order-2">
          {mode === 'crop' ? (
            <>
              <div className="space-y-3">
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Crop area</h3>

                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Drag the box to move it, or grab a handle to resize. The selection updates as you drag.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={trimWhiteMargins}
                    disabled={isTrimming}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {isTrimming ? <Loader2 size={14} className="animate-spin" /> : <CropIcon size={14} />}
                    Trim white margins
                  </button>
                  <button
                    onClick={resetCrop}
                    disabled={isFullPageCrop}
                    title="Reset to the full page"
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reset
                  </button>
                </div>

                <details className="group rounded-xl bg-zinc-50 px-3 py-2.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-zinc-600 [&::-webkit-details-marker]:hidden">
                    Exact margins
                    <span className="text-[10px] font-bold uppercase text-zinc-400">{unit}</span>
                  </summary>

                  <div className="space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Unit</span>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value as Unit)}
                        className="text-[10px] font-bold uppercase bg-white border border-zinc-200 rounded-lg px-2 py-1 outline-none"
                      >
                        <option value="mm">mm</option>
                        <option value="pt">pt</option>
                        <option value="in">in</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          ['left', 'Left'],
                          ['right', 'Right'],
                          ['top', 'Top'],
                          ['bottom', 'Bottom'],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">{label}</label>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={Number(margins[key].toFixed(2))}
                            onChange={(e) =>
                              setCropFromMargins({
                                ...margins,
                                [key]: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-full p-3 bg-white border-none rounded-xl font-mono font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] leading-relaxed text-zinc-400">
                      Typed margins move the border and always match the selection. They clamp so a sliver of the page
                      always remains.
                    </p>
                  </div>
                </details>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Page size</h3>
                <div className="grid grid-cols-3 gap-2">
                  {SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => setPresetKey(preset.key)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        presetKey === preset.key
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setPresetKey('custom')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all col-span-3 ${
                      presetKey === 'custom'
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    Custom size
                  </button>
                </div>

                {presetKey === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Width ({unit})</label>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full p-3 bg-zinc-50 border-none rounded-xl font-mono font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Height ({unit})</label>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full p-3 bg-zinc-50 border-none rounded-xl font-mono font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 bg-zinc-50 p-1 rounded-xl">
                  <button
                    onClick={() => setOrientation('portrait')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                      orientation === 'portrait' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    Portrait
                  </button>
                  <button
                    onClick={() => setOrientation('landscape')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                      orientation === 'landscape' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    Landscape
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFitContent(true)}
                    className={`py-3 rounded-xl text-xs font-bold border transition-all text-left px-3 ${
                      fitContent
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    Fit content
                    <span className={`block text-[10px] font-bold ${fitContent ? 'text-zinc-400' : 'text-zinc-400'}`}>
                      Scale into the page
                    </span>
                  </button>
                  <button
                    onClick={() => setFitContent(false)}
                    className={`py-3 rounded-xl text-xs font-bold border transition-all text-left px-3 ${
                      !fitContent
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    Page only
                    <span className="block text-[10px] font-bold text-zinc-400">Keep content in place</span>
                  </button>
                </div>

                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Target size: {Math.round(targetSize.width)} × {Math.round(targetSize.height)} pt.
                  {fitContent
                    ? ' Content is scaled proportionally, so text stays sharp and selectable.'
                    : ' Only the page dimensions change — the content stays where it is.'}
                </p>
              </div>
            </>
          )}

          {/* Scope */}
          <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Apply to</h3>
            <div className="flex gap-2 bg-zinc-50 p-1 rounded-xl">
              <button
                onClick={() => setScope('all')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                  scope === 'all' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                All pages
              </button>
              <button
                onClick={() => setScope('range')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                  scope === 'range' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Page range
              </button>
            </div>

            {scope === 'range' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">From</label>
                  <input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={fromPage}
                    onChange={(e) => setFromPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))}
                    className="w-full p-3 bg-zinc-50 border-none rounded-xl font-mono font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">To</label>
                  <input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={toPage}
                    onChange={(e) => setToPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))}
                    className="w-full p-3 bg-zinc-50 border-none rounded-xl font-mono font-bold focus:ring-2 focus:ring-zinc-900 outline-none"
                  />
                </div>
              </div>
            )}

            <p className="text-[11px] text-zinc-400">
              {affectedCount} of {pageCount} page{pageCount === 1 ? '' : 's'} will be changed.
            </p>
          </div>

          <button
            onClick={applyChanges}
            disabled={phase === 'working' || !canApply}
            className="w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {phase === 'working' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Building PDF…
              </>
            ) : (
              <>
                {mode === 'crop' ? <CropIcon size={16} /> : <Scissors size={16} />}
                {mode === 'crop' ? 'Crop PDF' : 'Resize PDF'}
              </>
            )}
          </button>

          <p className="text-[11px] leading-relaxed text-zinc-400">
            {mode === 'crop'
              ? 'Cropping hides the area outside the selection — it does not delete it from the file. Annotations and form fields are left as they are.'
              : 'Pages are resized without re-rendering, so text and vectors stay sharp and selectable.'}
          </p>
        </div>
      </div>
    </div>
  )
}
