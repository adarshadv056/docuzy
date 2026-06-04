"use client"

import { useState, useRef } from "react"
import { UploadCloud, FileText, Loader2 } from "lucide-react"
import { uploadDocument } from "@/actions/upload"

export default function UploadDropzone() {
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (file: File) => {
        if (!file) return
        setIsUploading(true)

        const formData = new FormData()
        formData.append("file", file)

        try {
            await uploadDocument(formData)
        } catch (error) {
            console.error("Upload failed:", error)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div
            className={`relative w-full p-12 border-2 border-dashed rounded-3xl text-center transition-all duration-300 ${isDragging
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700"
                }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const droppedFile = e.dataTransfer.files[0]
                handleFile(droppedFile)
            }}
        >
            <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => {
                    if (e.target.files) handleFile(e.target.files[0])
                }}
            />

            <div className="flex flex-col items-center justify-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isUploading ? 'bg-indigo-500/20' : 'bg-zinc-800/50'}`}>
                    {isUploading ? (
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    ) : (
                        <UploadCloud className="w-8 h-8 text-zinc-400" />
                    )}
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-zinc-200 mb-1">
                        {isUploading ? "Uploading to workspace..." : "Upload a new document"}
                    </h3>
                    <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                        Drag and drop your PDF or text file here, or <button onClick={() => fileInputRef.current?.click()} className="text-indigo-400 hover:text-indigo-300 transition-colors">browse files</button>
                    </p>
                </div>
            </div>
        </div>
    )
}