'use client'

import React, { useCallback, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { encryptPDF, AlreadyEncryptedError } from '@/lib/pdf/encrypt-native'
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

const calculatePasswordStrength = (pass: string): { score: number; label: string; color: string } => {
  if (!pass) return { score: 0, label: 'Empty', color: 'bg-zinc-200' }
  let score = 0
  if (pass.length >= 6) score += 1
  if (pass.length >= 10) score += 1
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1
  if (/[0-9]/.test(pass)) score += 1
  if (/[^A-Za-z0-9]/.test(pass)) score += 1

  if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' }
  if (score <= 3) return { score: 2, label: 'Moderate', color: 'bg-amber-500' }
  if (score <= 4) return { score: 3, label: 'Strong', color: 'bg-emerald-500' }
  return { score: 4, label: 'Very Strong', color: 'bg-emerald-600' }
}

export default function EncryptPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceBuffer, setSourceBuffer] = useState<ArrayBuffer | null>(null)
  const [pageCount, setPageCount] = useState(0)

  // Passwords
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [ownerPassword, setOwnerPassword] = useState('')
  const [allowPrinting, setAllowPrinting] = useState(true)
  const [allowCopying, setAllowCopying] = useState(false)
  const [allowModifying, setAllowModifying] = useState(false)
  const [allowAnnotating, setAllowAnnotating] = useState(true)

  // Status & Export
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<{
    bytes: Uint8Array
    originalSize: number
    newSize: number
    algorithmUsed: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const passwordStrength = calculatePasswordStrength(password)

  const loadFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setPhase('idle')
    setPassword('')
    setConfirmPassword('')

    try {
      const buffer = await selectedFile.arrayBuffer()
      // Check if PDF is already encrypted
      try {
        const testDoc = await PDFDocument.load(buffer.slice(0))
        setPageCount(testDoc.getPageCount())
      } catch (err: any) {
        if (err?.message?.includes('encrypted')) {
          setError('This PDF is already password-protected. Please unlock it first.')
          return
        }
      }

      setSourceBuffer(buffer)
      setFile(selectedFile)
    } catch (err) {
      console.error(err)
      setError('Could not open this PDF. It may be corrupted or unreadable.')
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
    setPassword('')
    setConfirmPassword('')
    setOwnerPassword('')
    setPhase('idle')
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Execute Encryption
  const handleEncrypt = async () => {
    if (!file || !sourceBuffer) return

    if (!password) {
      setError('Please enter a password to protect your PDF.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.')
      return
    }

    setPhase('working')
    setError(null)

    try {
      const inputBytes = new Uint8Array(sourceBuffer)

      const encrypted = await encryptPDF(inputBytes, password, {
        ownerPassword: ownerPassword.trim() || undefined,
        allowPrinting,
        allowCopying,
        allowModifying,
        allowAnnotating,
        allowHighQualityPrint: allowPrinting,
      })

      setResult({
        bytes: encrypted,
        originalSize: file.size,
        newSize: encrypted.byteLength,
        algorithmUsed: 'AES-256',
      })
      setPhase('done')
    } catch (err: any) {
      console.error(err)
      if (err instanceof AlreadyEncryptedError) {
        setError('This PDF is already encrypted.')
      } else {
        setError(err?.message || 'Could not encrypt PDF. Please try a different password.')
      }
      setPhase('idle')
    }
  }

  const downloadResult = () => {
    if (!result || !file) return
    const blob = new Blob([toArrayBuffer(result.bytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `protected-${file.name}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Done phase
  if (phase === 'done' && result) {
    return (
      <div className="bg-white border border-zinc-100 rounded-3xl p-8 shadow-sm max-w-xl mx-auto">
        <div className="mb-6 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100/60">
            <Check size={28} className="text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">PDF Successfully Encrypted!</h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            Protected with {result.algorithmUsed} encryption. The password is now required to open the document.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Original Size</p>
            <p className="text-base font-semibold text-zinc-600 tabular-nums">{formatSize(result.originalSize)}</p>
          </div>
          <div className="p-4 bg-zinc-50/70 rounded-2xl border border-zinc-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mb-1">Protected PDF</p>
            <p className="text-base font-bold text-zinc-900 tabular-nums">{formatSize(result.newSize)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={downloadResult}
            className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Download Protected PDF
          </button>
          <button
            onClick={startOver}
            className="w-full py-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={14} />
            Protect Another File
          </button>
        </div>
      </div>
    )
  }

  // Initial file upload state
  if (!file) {
    return (
      <div className="max-w-xl mx-auto">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDraggingFile(true)
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-3xl p-16 text-center transition-all cursor-pointer group ${
            isDraggingFile ? 'border-indigo-500 bg-indigo-50/40' : 'border-zinc-200 hover:border-zinc-400 bg-white'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelection}
            accept="application/pdf"
            className="hidden"
          />
          <div className="space-y-4 max-w-sm mx-auto">
            <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto text-zinc-500 group-hover:scale-110 transition-transform">
              <Lock size={24} />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">Select a PDF to encrypt with password</p>
              <p className="text-xs text-zinc-400 mt-1">
                Protect sensitive documents with military-grade AES-256 encryption
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 rounded-full text-[11px] font-medium text-zinc-500">
              <Sparkles size={12} className="text-indigo-600" />
              100% private &amp; encrypted directly in your browser
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* File summary banner */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 text-indigo-600">
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
          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Choose different PDF"
        >
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {/* Main Password & Encryption Settings Card */}
      <div className="bg-white border border-zinc-100 rounded-3xl p-6 lg:p-7 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-bold text-zinc-900">Set Document Password</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Recipients will need this password to open and view the document
          </p>
        </div>

        <div className="space-y-4">
          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="enc-pass" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
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
                id="enc-pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password…"
                className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-zinc-900 outline-none"
              />
            </div>

            {/* Password strength bar */}
            {password && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-zinc-400 uppercase tracking-wider">Strength</span>
                  <span className="text-zinc-700">{passwordStrength.label}</span>
                </div>
                <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden flex gap-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-full flex-1 transition-all ${
                        passwordStrength.score >= step ? passwordStrength.color : 'bg-zinc-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label htmlFor="enc-confirm" className="text-[10px] font-bold uppercase text-zinc-400 ml-1">
              Confirm Password
            </label>
            <input
              id="enc-confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password…"
              className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-zinc-900 outline-none"
            />
          </div>
        </div>

        {/* Advanced Permissions & Encryption Mode */}
        <div className="pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="text-xs font-bold text-zinc-600 hover:text-zinc-900 flex items-center justify-between w-full py-1"
          >
            <span>Advanced Security &amp; Permissions</span>
            <span className="text-zinc-400">{showAdvanced ? '▲ Hide' : '▼ Customize'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 pt-2">
              {/* Standard Security Banner */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">Standard AES-256 (ISO 32000-2)</p>
                    <p className="text-[10px] text-zinc-500">Hardware-accelerated native Web Crypto encryption (R=6)</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Native 256-bit
                </span>
              </div>

              {/* Permissions Checkboxes */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Permissions Allowed</span>

                <div className="space-y-2">
                  <label className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-semibold text-zinc-800 flex items-center gap-2">
                      <Printer size={14} className="text-zinc-500" />
                      Allow Printing
                    </span>
                    <input
                      type="checkbox"
                      checked={allowPrinting}
                      onChange={(e) => setAllowPrinting(e.target.checked)}
                      className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900 cursor-pointer"
                    />
                  </label>

                  <label className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-semibold text-zinc-800 flex items-center gap-2">
                      <Copy size={14} className="text-zinc-500" />
                      Allow Copying Text &amp; Graphics
                    </span>
                    <input
                      type="checkbox"
                      checked={allowCopying}
                      onChange={(e) => setAllowCopying(e.target.checked)}
                      className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900 cursor-pointer"
                    />
                  </label>

                  <label className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-semibold text-zinc-800 flex items-center gap-2">
                      <Edit3 size={14} className="text-zinc-500" />
                      Allow Modifying Contents
                    </span>
                    <input
                      type="checkbox"
                      checked={allowModifying}
                      onChange={(e) => setAllowModifying(e.target.checked)}
                      className="w-4 h-4 rounded text-zinc-900 border-zinc-300 focus:ring-zinc-900 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Action */}
        <button
          type="button"
          onClick={handleEncrypt}
          disabled={phase === 'working' || !password || !confirmPassword}
          className="w-full py-4 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {phase === 'working' ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Encrypting PDF…
            </>
          ) : (
            <>
              <Lock size={16} />
              Encrypt PDF with Password
            </>
          )}
        </button>
      </div>
    </div>
  )
}
