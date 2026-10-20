'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument, degrees } from 'pdf-lib'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Download,
  FileText,
  GripVertical,
  Loader2,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

/** Rendered thumbnail width in device pixels (the card is displayed smaller). */
const THUMB_WIDTH = 320

interface PageItem {
  /** Stable id for sorting and selection. */
  id: string
  /** Zero-based index of the page in the source document. */
  sourceIndex: number
  /** Extra rotation applied by the user, in degrees (0/90/180/270). */
  rotation: number
  /** Removed pages stay in the grid (dimmed) so they can be restored. */
  removed: boolean
}

interface OrganizeResult {
  bytes: Uint8Array
  originalSize: number
  newSize: number
  kept: number
  removed: number
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Copy a byte view into a plain ArrayBuffer so Blob accepts it reliably. */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

export default function OrganizePdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<OrganizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const keptPages = useMemo(() => pages.filter((page) => !page.removed), [pages])

  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')
    setSelected([])
    setPages([])
    setPdfDoc(null)
    setSourceBuffer(null)

    try {
      // The original bytes are kept intact for pdf-lib. pdfjs detaches the
      // buffer it is given, so it always receives a copy.
      const buffer = await selectedFile.arrayBuffer()
      setSourceBuffer(buffer)

      const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise
      setPdfDoc(doc)

      const items: PageItem[] = Array.from({ length: doc.numPages }, (_, index) => ({
        id: `page-${index}`,
        sourceIndex: index,
        rotation: 0,
        removed: false,
      }))
      setPages(items)
      setFile(selectedFile)
    } catch (err) {
      console.error(err)
      setError(
        'This PDF could not be opened. It may be password protected or damaged — try unlocking it first.'
      )
      setFile(null)
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

  const resetAll = () => {
    setPages((prev) =>
      [...prev]
        .sort((a, b) => a.sourceIndex - b.sourceIndex)
        .map((page) => ({ ...page, rotation: 0, removed: false }))
    )
    setSelected([])
    setResult(null)
    setPhase('idle')
  }

  const startOver = () => {
    setFile(null)
    setSourceBuffer(null)
    setPdfDoc(null)
    setPages([])
    setSelected([])
    setResult(null)
    setPhase('idle')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPages((prev) => {
      const oldIndex = prev.findIndex((page) => page.id === active.id)
      const newIndex = prev.findIndex((page) => page.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const rotate = (ids: string[], amount: number) => {
    const targets = new Set(ids)
    setPages((prev) =>
      prev.map((page) =>
        targets.has(page.id)
          ? { ...page, rotation: (((page.rotation + amount) % 360) + 360) % 360 }
          : page
      )
    )
  }

  const setRemoved = (ids: string[], removed: boolean) => {
    const targets = new Set(ids)
    setPages((prev) => prev.map((page) => (targets.has(page.id) ? { ...page, removed } : page)))
  }

  const toggleSelected = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  const selectAll = () => setSelected(pages.map((page) => page.id))
  const clearSelection = () => setSelected([])

  const reverseOrder = () => {
    setPages((prev) => [...prev].reverse())
  }

  const rotateAll = () => {
    rotate(pages.map((page) => page.id), 90)
  }

  const applyChanges = async () => {
    if (!file || !sourceBuffer || keptPages.length === 0) return
    setPhase('working')
    setError(null)

    try {
      const source = await PDFDocument.load(sourceBuffer.slice(0), {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      })
      const output = await PDFDocument.create()

      const copied = await output.copyPages(
        source,
        keptPages.map((page) => page.sourceIndex)
      )

      copied.forEach((page, index) => {
        const item = keptPages[index]
        // Rotation is added to whatever the page already had, so an already
        // rotated page keeps its orientation instead of being flattened.
        const base = source.getPage(item.sourceIndex).getRotation().angle
        page.setRotation(degrees((base + item.rotation) % 360))
        output.addPage(page)
      })

      const bytes = await output.save()
      setResult({
        bytes,
        originalSize: file.size,
        newSize: bytes.byteLength,
        kept: keptPages.length,
        removed: pages.length - keptPages.length,
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
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `organized-${file.name}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectionCount = selected.length

  if (phase === 'done' && result) {
    return (
      <div className="bg-white border border-zinc-100 rounded-2xl p-8 shadow-sm">
        <div className="mb-6">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <Check size={22} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">Your PDF is organized</h3>
          <p className="text-xs text-zinc-400 mt-1">
            {result.kept} page{result.kept === 1 ? '' : 's'} kept
            {result.removed > 0 ? ` · ${result.removed} removed` : ''}
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
            Download organized PDF
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
            <p className="text-sm font-semibold text-zinc-900">Select a PDF to organize</p>
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
              {pages.length} page{pages.length === 1 ? '' : 's'} · {formatSize(file.size)}
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

      {/* Toolbar */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mr-1">
            {selectionCount > 0 ? `${selectionCount} selected` : 'Select pages'}
          </span>

          <ToolbarButton
            onClick={selectAll}
            disabled={pages.length === 0}
            icon={<Check size={14} />}
            label="Select all"
          />
          <ToolbarButton
            onClick={clearSelection}
            disabled={selectionCount === 0}
            icon={<X size={14} />}
            label="Clear"
          />

          <span className="w-px h-5 bg-zinc-200 mx-1" />

          <ToolbarButton
            onClick={() => rotate(selected, -90)}
            disabled={selectionCount === 0}
            icon={<RotateCcw size={14} />}
            label="Rotate left"
          />
          <ToolbarButton
            onClick={() => rotate(selected, 90)}
            disabled={selectionCount === 0}
            icon={<RotateCw size={14} />}
            label="Rotate right"
          />
          <ToolbarButton
            onClick={() => setRemoved(selected, true)}
            disabled={selectionCount === 0}
            icon={<Trash2 size={14} />}
            label="Delete"
          />
          <ToolbarButton
            onClick={() => setRemoved(selected, false)}
            disabled={selectionCount === 0}
            icon={<Undo2 size={14} />}
            label="Restore"
          />

          <span className="w-px h-5 bg-zinc-200 mx-1" />

          <ToolbarButton onClick={rotateAll} disabled={pages.length === 0} icon={<RotateCw size={14} />} label="Rotate all" />
          <ToolbarButton onClick={reverseOrder} disabled={pages.length < 2} icon={<ArrowLeftRight size={14} />} label="Reverse" />
          <ToolbarButton onClick={resetAll} disabled={pages.length === 0} icon={<Undo2 size={14} />} label="Reset" />
        </div>
      </div>

      {/* Page grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((page) => page.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {pages.map((page, index) => (
              <SortablePageCard
                key={page.id}
                item={page}
                position={keptPages.findIndex((kept) => kept.id === page.id) + 1}
                order={index}
                pdfDoc={pdfDoc}
                selected={selected.includes(page.id)}
                onToggleSelect={() => toggleSelected(page.id)}
                onRotate={(amount) => rotate([page.id], amount)}
                onToggleRemove={() => setRemoved([page.id], !page.removed)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Apply bar */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-xs text-zinc-400 flex-1">
          {keptPages.length} of {pages.length} page{pages.length === 1 ? '' : 's'} will be kept. Removed pages
          stay visible until you apply, so you can always restore them.
        </p>
        <button
          onClick={applyChanges}
          disabled={phase === 'working' || keptPages.length === 0}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {phase === 'working' ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Building PDF…
            </>
          ) : (
            'Apply changes'
          )}
        </button>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void
  disabled?: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-50 disabled:hover:text-zinc-600"
    >
      {icon}
      {label}
    </button>
  )
}

function SortablePageCard({
  item,
  position,
  order,
  pdfDoc,
  selected,
  onToggleSelect,
  onRotate,
  onToggleRemove,
}: {
  item: PageItem
  /** Position among the kept pages, or 0 when the page is removed. */
  position: number
  /** Index in the current grid order. */
  order: number
  pdfDoc: pdfjs.PDFDocumentProxy | null
  selected: boolean
  onToggleSelect: () => void
  onRotate: (amount: number) => void
  onToggleRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const [visible, setVisible] = useState(false)
  const [thumb, setThumb] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Only render a thumbnail once the card is close to the viewport — long
  // documents stay responsive because pages are drawn lazily.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '250px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !pdfDoc) return
    let cancelled = false

    const draw = async () => {
      try {
        const page = await pdfDoc.getPage(item.sourceIndex + 1)
        if (cancelled) return

        // pdfjs replaces the page rotation instead of adding to it, so the
        // user's extra rotation is applied on top of the page's own /Rotate.
        const targetRotation = ((((page.rotate || 0) + item.rotation) % 360) + 360) % 360
        const unscaled = page.getViewport({ scale: 1, rotation: targetRotation })
        const scale = THUMB_WIDTH / Math.max(1, unscaled.width)
        const viewport = page.getViewport({ scale, rotation: targetRotation })

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const context = canvas.getContext('2d')
        if (!context) return

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({ canvasContext: context, viewport, canvas }).promise
        if (cancelled) return

        setThumb(canvas.toDataURL('image/jpeg', 0.82))
      } catch (err) {
        console.warn('Thumbnail failed', err)
      }
    }

    draw()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, visible, item.sourceIndex, item.rotation])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  }

  // The whole card is the drag target. The inner controls stop the drag from
  // starting so buttons stay clickable.
  const keepClicks = (event: React.SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="group"
      aria-label={`Page ${item.sourceIndex + 1}, position ${position || order + 1}. Drag to reorder.`}
      className={`cursor-grab active:cursor-grabbing touch-none select-none ${
        isDragging ? 'opacity-80' : ''
      }`}
    >
      <div
        className={`relative bg-white rounded-xl border overflow-hidden shadow-sm transition-all ${
          selected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-zinc-200'
        } ${item.removed ? 'opacity-40' : ''}`}
      >
        <div ref={containerRef} className="relative aspect-[3/4] bg-zinc-50 flex items-center justify-center">
          {thumb ? (
            <img src={thumb} alt={`Page ${item.sourceIndex + 1}`} className="max-h-full max-w-full object-contain" />
          ) : (
            <Loader2 size={18} className="animate-spin text-zinc-300" />
          )}

          <span className="absolute top-1.5 left-1.5 bg-zinc-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md pointer-events-none">
            {item.sourceIndex + 1}
          </span>

          <button
            onClick={onToggleSelect}
            onPointerDown={keepClicks}
            onMouseDown={keepClicks}
            onTouchStart={keepClicks}
            aria-label={selected ? 'Deselect page' : 'Select page'}
            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
              selected ? 'bg-indigo-600 text-white' : 'bg-white/90 text-zinc-300 hover:text-zinc-600 border border-zinc-200'
            }`}
          >
            {selected && <Check size={14} />}
          </button>

          {item.removed && (
            <div className="absolute inset-x-0 bottom-0 bg-zinc-900/80 text-white text-[10px] font-bold text-center py-1 pointer-events-none">
              Removed
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-2 py-1.5 border-t border-zinc-100">
          <span className="p-1 text-zinc-300 pointer-events-none" aria-hidden="true">
            <GripVertical size={14} />
          </span>

          <span className="text-[10px] font-bold text-zinc-400">
            {item.removed ? `#${order + 1}` : position > 0 ? `#${position}` : `#${order + 1}`}
          </span>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onRotate(-90)}
              onPointerDown={keepClicks}
              onMouseDown={keepClicks}
              onTouchStart={keepClicks}
              aria-label="Rotate left"
              className="p-1 text-zinc-300 hover:text-zinc-700 transition-colors"
            >
              <RotateCcw size={13} />
            </button>
            <button
              onClick={() => onRotate(90)}
              onPointerDown={keepClicks}
              onMouseDown={keepClicks}
              onTouchStart={keepClicks}
              aria-label="Rotate right"
              className="p-1 text-zinc-300 hover:text-zinc-700 transition-colors"
            >
              <RotateCw size={13} />
            </button>
            {item.removed ? (
              <button
                onClick={onToggleRemove}
                onPointerDown={keepClicks}
                onMouseDown={keepClicks}
                onTouchStart={keepClicks}
                aria-label="Restore page"
                className="p-1 text-zinc-400 hover:text-indigo-600 transition-colors"
              >
                <Undo2 size={13} />
              </button>
            ) : (
              <button
                onClick={onToggleRemove}
                onPointerDown={keepClicks}
                onMouseDown={keepClicks}
                onTouchStart={keepClicks}
                aria-label="Remove page"
                className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
