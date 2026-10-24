'use client'

import React, { useCallback, useRef, useState } from 'react'
import {
  unlockPDF,
  inspectPDFEncryption,
  EncryptionInspection,
  IncorrectPasswordError,
  NotEncryptedError,
} from '@/lib/pdf/unlock-native'
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Unlock,
  Upload,
  X,
} from 'lucide-react'

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function UnlockPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [inspection, setInspection] = useState<EncryptionInspection | null>(null)

  // Password state
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Status & Export
  const [phase, setPhase] = useState<'idle' | 'inspecting' | 'ready' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{
    bytes: Uint8Array
    originalSize: number
    newSize: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPassword('')
    setPhase('inspecting')

    try {
      const buffer = await selectedFile.arrayBuffer()
      const bytes = new Uint8Array(buffer)

      // Inspect encryption status
      const insp = await inspectPDFEncryption(bytes)
      setInspection(insp)
      setSourceBuffer(buffer)
      setFile(selectedFile)
      setPhase('ready')
    } catch (err) {
      console.error(err)
      setError('Could not inspect this PDF. It may be corrupted or unreadable.')
      setPhase('idle')
    }
  }, [])

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) loadFile(selectedFile)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingFile(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingFile(false)
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
    setInspection(null)
    setPassword('')
    setPhase('idle')
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Execute Unlock
  const handleUnlock = async () => {
    if (!file || !sourceBuffer) return

    if (inspection?.requiresPassword && !password.trim()) {
      setError('Please enter the password to unlock this document.')
      return
    }

    setPhase('working')
    setError(null)

    try {
      const inputBytes = new Uint8Array(sourceBuffer)
      const unlocked = await unlockPDF(inputBytes, password)

      setResult({
        bytes: unlocked,
        originalSize: file.size,
        newSize: unlocked.byteLength,
      })
      setPhase('done')
    } catch (err: any) {
      console.error(err)
      if (err instanceof IncorrectPasswordError) {
        setError('Incorrect password. Please verify the password and try again.')
      } else if (err instanceof NotEncryptedError) {
        setError('This PDF is not password-protected.')
      } else {
        setError(err?.message || 'Could not unlock this PDF. Please check the password.')
      }
      setPhase('ready')
    }
  }

  const handleDownload = () => {
    if (!result || !file) return
    const blob = new Blob([result.bytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const originalName = file.name.replace(/\.[^/.]+$/, '')
    a.download = `${originalName}-unlocked.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Upload Dropzone */}
      {!file && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 lg:p-14 text-center cursor-pointer transition-all ${
            isDraggingFile
              ? 'border-indigo-600 bg-indigo-50/50 scale-[0.99]'
              : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileSelection}
            className="hidden"
          />

          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Unlock size={28} />
          </div>

          <h3 className="text-base font-bold text-zinc-900 mb-1">
            Choose a protected PDF file
          </h3>
          <p className="text-xs text-zinc-400 mb-5">
            or drag &amp; drop your password-protected PDF here
          </p>

          <span className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors">
            <Upload size={14} />
            Browse Files
          </span>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-6 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              100% In-House Decryption
            </span>
            <span className="flex items-center gap-1.5">
              <KeyRound size={14} className="text-indigo-500" />
              AES-256 Supported
            </span>
            <span className="flex items-center gap-1.5">
              <Lock size={14} className="text-amber-500" />
              Permissions Unlocking
            </span>
          </div>
        </div>
      )}

      {/* Selected File Card */}
      {file && (
        <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-zinc-900 truncate">{file.name}</p>
              <p className="text-xs text-zinc-400">{formatSize(file.size)}</p>
            </div>
          </div>
          <button
            onClick={startOver}
            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Choose different PDF"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {/* Inspecting Spinner */}
      {phase === 'inspecting' && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-8 text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs font-semibold text-zinc-600">
            Inspecting document encryption status…
          </p>
        </div>
      )}

      {/* Unlock Workspace */}
      {(phase === 'ready' || phase === 'working') && inspection && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-6">
          {!inspection.isEncrypted ? (
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
              <div className="flex items-center gap-2 text-zinc-800 font-bold text-xs">
                <ShieldCheck size={16} className="text-emerald-600" />
                This document is not encrypted
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This PDF has no password protection or usage restrictions applied. It is already fully open.
              </p>
            </div>
          ) : inspection.permissionsRestricted && !inspection.requiresPassword ? (
            /* Permissions Only (No Open Password Required) */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-emerald-950">
                    Permissions restrictions detected
                  </p>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    This PDF does not require a password to view, but has permissions locks (e.g. copying text or printing is restricted). We can remove all restrictions with 1 click.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUnlock}
                disabled={phase === 'working'}
                className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {phase === 'working' ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Removing Restrictions…</span>
                  </>
                ) : (
                  <>
                    <Unlock size={15} />
                    <span>Remove Restrictions &amp; Unlock</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Document Open Password Required */
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900">Enter Document Password</h3>
                <p className="text-xs text-zinc-400">
                  This PDF is password-protected ({inspection.algorithm || 'AES-256'}). Enter the password to permanently unlock it.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="unlock-pass" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="unlock-pass"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUnlock()
                    }}
                    placeholder="Enter document password…"
                    className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-zinc-900 outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleUnlock}
                disabled={phase === 'working' || !password.trim()}
                className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {phase === 'working' ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Decrypting &amp; Unlocking…</span>
                  </>
                ) : (
                  <>
                    <Unlock size={15} />
                    <span>Unlock PDF</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Result Card */}
      {phase === 'done' && result && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Check size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">PDF Successfully Unlocked</h3>
              <p className="text-xs text-zinc-400">
                Password protection and usage restrictions have been permanently removed
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-xs">
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-bold">Original Size</p>
              <p className="font-semibold text-zinc-700 mt-0.5">{formatSize(result.originalSize)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-bold">Unlocked Size</p>
              <p className="font-semibold text-zinc-700 mt-0.5">{formatSize(result.newSize)}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <Download size={15} />
              <span>Download Unlocked PDF</span>
            </button>
            <button
              onClick={startOver}
              className="py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw size={15} />
              <span>Unlock Another</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
