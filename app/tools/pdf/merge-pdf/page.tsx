'use client'
import React, { useState, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Pdfs = { id: string; file: File }

export default function MergePDF() {
  const [pdfs, setPdfs] = useState<Pdfs[]>([])
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor))

  const addFiles = (filesList: FileList | null) => {
    if (!filesList) return
    const pdfFiles = Array.from(filesList).filter((f) => f.type === 'application/pdf')
    const items = pdfFiles.map((file) => ({ id: Math.random().toString(), file }))
    setPdfs((prev) => [...prev, ...items])
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPdfs((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id)
      const newIndex = prev.findIndex((p) => p.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const mergePDFs = async () => {
    if (pdfs.length === 0) return
    setLoading(true)
    try {
      const mergedPdf = await PDFDocument.create()
      for (const item of pdfs) {
        const buf = await item.file.arrayBuffer()
        const pdf = await PDFDocument.load(buf)
        const copied = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        copied.forEach((p) => mergedPdf.addPage(p))
      }
      
      const bytes = await mergedPdf.save()
      const blob = new Blob([bytes.slice(0)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'merged.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error merging PDFs:', err)
    } finally {
      setLoading(false)
    }
  }

  const removeFile = (id: string) => {
    setPdfs((prev) => prev.filter((p) => p.id !== id))
  }

  function SortablePdfRow({ id, file }: { id: string; file: File }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging: rowDragging } = useSortable({ id })
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: rowDragging ? 50 : 'auto',
    }

    return (
      <div ref={setNodeRef} style={style} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="p-2 cursor-grab">
            ☰
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{file.name}</p>
            <p className="text-xs text-gray-600">{Math.round(file.size / 1024)} KB</p>
          </div>
        </div>
        <button onClick={() => removeFile(id)} className="text-red-600 hover:text-red-700 text-sm font-medium cursor-pointer">
          Remove
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Merge PDF Files</h1>
          <p className="text-lg text-gray-600">Combine multiple PDFs into one in seconds</p>
        </div>

        <div className="p-8">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
          >
            <input ref={inputRef} type="file" accept="application/pdf" multiple onChange={onChange} className="hidden" />
            <div>
              <p className="text-xl font-semibold text-gray-900 mb-1">Drag and drop files here</p>
              <p className="text-gray-600">Or click to select files</p>
            </div>
          </div>

          {pdfs.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Selected Files ({pdfs.length})</h2>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={pdfs.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {pdfs.map((p) => (
                      <SortablePdfRow key={p.id} id={p.id} file={p.file} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          <div className="mt-8 text-center">
            <button
              onClick={mergePDFs}
              disabled={loading || pdfs.length === 0}
              className={`px-8 py-3 rounded-lg font-medium transition-colors ${loading || pdfs.length === 0 ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
            >
              {loading ? 'Merging…' : 'Merge Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}