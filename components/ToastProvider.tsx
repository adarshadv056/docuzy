"use client"

import { createContext, useCallback, useContext, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, XCircle } from "lucide-react"

type Toast = { id: number; message: string; type: "success" | "error" }
type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>")
  return ctx
}

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: Toast["type"], message: string) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => remove(id), 4000)
    },
    [remove]
  )

  const success = useCallback((m: string) => push("success", m), [push])
  const error = useCallback((m: string) => push("error", m), [push])

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              className={`pointer-events-auto flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${
                t.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {t.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}