'use client'

import React, { useRef, useState } from 'react'
import { toPng, toJpeg } from 'html-to-image'
import { motion } from 'framer-motion'
import { Camera, Download, FileCode, Copy } from 'lucide-react'

export default function HtmlToImageConverter() {
  const elementRef = useRef<HTMLDivElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [htmlContent, setHtmlContent] = useState(
    `<div style="padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 20px; font-family: sans-serif; text-align: center;">
  <h1 style="margin: 0; font-size: 24px;">Welcome to Docuzy</h1>
  <p style="opacity: 0.9;">This HTML was turned into an image entirely in the browser.</p>
</div>`
  )

  const captureImage = async (format: 'png' | 'jpg') => {
    if (!elementRef.current) return
    setIsProcessing(true)

    try {
      const options = { cacheBust: true, pixelRatio: 2 }
      let dataUrl = ''

      if (format === 'png') {
        dataUrl = await toPng(elementRef.current, options)
      } else {
        dataUrl = await toJpeg(elementRef.current, { ...options, quality: 0.95 })
      }

      const link = document.createElement('a')
      link.download = `docuzy-capture.${format}`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Capture failed:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-16 px-6 font-sans">
      <header className="mb-10 text-left">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">HTML to Image</h1>
        <p className="text-zinc-500 mt-2">Render raw HTML snippets into high-quality visual assets.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileCode size={16} className="text-zinc-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">HTML Input</h3>
          </div>
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="w-full h-80 p-6 bg-zinc-900 text-zinc-300 font-mono text-sm rounded-3xl border border-zinc-800 focus:ring-2 focus:ring-zinc-700 outline-none transition-all resize-none"
            placeholder="Enter your HTML here..."
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Camera size={16} className="text-zinc-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Live Preview</h3>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-6 min-h-[320px] flex items-center justify-center overflow-hidden">
            <div 
              ref={elementRef}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              className="max-w-full"
            />
          </div>
        </section>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-4">
        <button
          onClick={() => captureImage('png')}
          disabled={isProcessing}
          className="py-5 bg-zinc-900 text-white rounded-2xl font-bold shadow-xl hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Download size={18} />
          {isProcessing ? 'Capturing...' : 'Download PNG'}
        </button>
        <button
          onClick={() => captureImage('jpg')}
          disabled={isProcessing}
          className="py-5 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Download size={18} />
          Download JPG
        </button>
      </div>
    </div>
  )
}