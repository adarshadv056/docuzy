"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react"
import { getWaitlistCount, joinWaitlist } from "@/actions/waitlist"

interface WaitlistFormProps {
  initialCount?: number
  showAvatars?: boolean
}

const avatars = [
  "/images/avatars/avatar-1.jpg",
  "/images/avatars/avatar-2.jpg",
  "/images/avatars/avatar-3.jpg",
]

export default function WaitlistForm({
  initialCount = 14,
  showAvatars = true,
}: WaitlistFormProps) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [count, setCount] = useState<number>(initialCount)

  useEffect(() => {
    getWaitlistCount().then((realCount) => {
      if (realCount > 0) {
        setCount(realCount + 10)
      }
    }).catch(() => {})
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || status === "loading") return

    setStatus("loading")
    setMessage("")

    try {
      const result = await joinWaitlist(email)
      if (result.success) {
        setStatus("success")
        setEmail("")
        setCount((prev) => prev + 1)
      } else {
        setStatus("error")
        setMessage(result.message || "Failed to join. Please try again.")
      }
    } catch {
      setStatus("error")
      setMessage("An unexpected error occurred. Please try again.")
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center p-2 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3 rounded-xl font-medium shadow-xs text-xs sm:text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>You&apos;re on the early access list! We&apos;ll be in touch soon.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <form
        onSubmit={onSubmit}
        className="flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl border border-slate-200/90 bg-white shadow-xs focus-within:border-indigo-600 focus-within:ring-3 focus-within:ring-indigo-100 transition-all"
      >
        <input
          type="email"
          required
          aria-label="Email address for waitlist"
          placeholder="Enter your email address..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
          className="w-full flex-1 h-11 px-4 bg-transparent text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full sm:w-auto h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 active:scale-98"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Joining...</span>
            </>
          ) : (
            <>
              <span>Join Waitlist</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </form>

      {status === "error" && (
        <p className="mt-2 text-xs text-rose-600 font-medium text-center">
          {message}
        </p>
      )}

      {showAvatars && (
        <div className="mt-4 flex items-center justify-center gap-2.5">
          <div className="flex -space-x-2 overflow-hidden">
            {avatars.map((src, i) => (
              <div key={src} className="relative h-6 w-6 rounded-full ring-2 ring-white overflow-hidden shadow-2xs">
                <Image
                  src={src}
                  alt={`Student waitlist member ${i + 1}`}
                  fill
                  sizes="24px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Join, <span className="font-semibold text-slate-800">{count}+ people</span> waiting for early access.
          </p>
        </div>
      )}
    </div>
  )
}