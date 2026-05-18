'use client'

import React, { useState, useRef } from 'react'
import { jsPDF } from 'jspdf'
import { motion, AnimatePresence } from 'framer-motion'
import { FilePlus, Download, Upload, Trash2, Loader2, GripVertical, X } from 'lucide-react'

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
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type ImageItem = { id: string; file: File; preview: string }

export default function ImageToPdf() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor))

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
      }))
      setImages((prev) => [...prev, ...newFiles])
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find(img => img.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((img) => img.id !== id)
    })
  }

  const generatePdf = async () => {
    if (images.length === 0) return
    setIsProcessing(true)

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const pdfWidth = doc.internal.pageSize.getWidth()
    const pdfHeight = doc.internal.pageSize.getHeight()

    for (let i = 0; i < images.length; i++) {
      const imgData = images[i].preview
      const img = new Image()
      img.src = imgData
      
      await new Promise((resolve) => {
        img.onload = () => {
          const ratio = Math.min(pdfWidth / img.width, pdfHeight / img.height)
          const w = img.width * ratio
          const h = img.height * ratio
          if (i > 0) doc.addPage()
          doc.addImage(imgData, 'JPEG', (pdfWidth - w) / 2, (pdfHeight - h) / 2, w, h)
          resolve(null)
        }
      })
    }

    doc.save('docuzy-export.pdf')
    setIsProcessing(false)
  }

  function SortableImageCard({ item, index }: { item: ImageItem; index: number }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
    
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 50 : 'auto',
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <div ref={setNodeRef} style={style} className="relative group aspect-[3/4] bg-zinc-100 rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        <img src={item.preview} alt="Queue" className="w-full h-full object-cover" />
        
        <div {...attributes} {...listeners} className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex items-center justify-center">
          <GripVertical className="text-white drop-shadow-md" size={32} />
        </div>

        <button 
          onClick={() => removeImage(item.id)}
          className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur rounded-full text-red-500 shadow-md hover:bg-white z-20"
        >
          <X size={14} />
        </button>

        <div className="absolute bottom-2 left-2 bg-zinc-900/80 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-white z-20">
          Page {index + 1}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-16 px-6 font-sans text-zinc-900">
      <header className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight">Image to PDF</h1>
        <p className="text-zinc-500 mt-2">Drag images to reorder them into your perfect document.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-200 rounded-3xl p-12 text-center cursor-pointer hover:bg-zinc-50 hover:border-zinc-900 transition-all group"
          >
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handleFileSelection} />
            <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 group-hover:text-zinc-900">
              <FilePlus size={20} />
            </div>
            <p className="font-semibold">Click to add photos</p>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={images.map(img => img.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <AnimatePresence>
                  {images.map((img, idx) => (
                    <SortableImageCard key={img.id} item={img} index={idx} />
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-zinc-50 rounded-3xl p-8 border border-zinc-100 sticky top-10 text-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6 text-left">Pipeline</h3>
            <div className="text-4xl font-bold mb-2">{images.length}</div>
            <div className="text-xs font-bold uppercase text-zinc-400 mb-8">Selected Assets</div>

            <button
              onClick={generatePdf}
              disabled={images.length === 0 || isProcessing}
              className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <><Download size={18} /> Generate PDF</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}