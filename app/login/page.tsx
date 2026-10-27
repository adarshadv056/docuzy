import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { FileText } from "lucide-react"
import { auth, signIn } from "@/auth"

// Account screens must not be indexed (CONTENT.md §5).
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Docuzy AI document workspace.",
  robots: { index: false, follow: false },
}

// USER-FLOWS.md §7 — "Make errors, next steps, and return paths clear."
const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already linked to a different sign-in method. Try another account.",
  OAuthSignin: "We couldn't start the Google sign-in. Please try again.",
  OAuthCallback: "Something went wrong during sign-in. Please try again.",
  AccessDenied: "Access was denied. Try signing in with a different Google account.",
  Verification: "That sign-in link has expired. Please try again.",
  Configuration: "Sign-in is temporarily unavailable. Please try again shortly.",
  Default: "We couldn't sign you in. Please try again.",
}

// USER-FLOWS.md §7 — "Validate return destinations to prevent unsafe external
// redirects." Only same-site absolute paths are allowed; anything else falls
// back to the dashboard.
function safeRedirect(target?: string) {
  if (!target) return "/dashboard"
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return "/dashboard"
  }
  // Reject control characters / newlines (header-injection hygiene).
  if (/[^\x20-\x7E]/.test(target)) return "/dashboard"
  // Prevent redirect loops and useless post-login destinations.
  if (target === "/login" || target.startsWith("/login/") || target.startsWith("/login?")) {
    return "/dashboard"
  }
  if (target === "/api" || target.startsWith("/api/")) return "/dashboard"
  return target
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}) {
  const session = await auth()
  const params = await searchParams
  const redirectTo = safeRedirect(params.callbackUrl)

  // Already authenticated — send them straight to the intended destination.
  if (session) redirect(redirectTo)

  const errorMessage = params.error
    ? (errorMessages[params.error] ?? errorMessages.Default)
    : null

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FAFAFA] px-6 py-16 font-sans text-zinc-900">
      {/* Gentle indigo halo — the shared brand accent (DESIGN.md §10). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/20 blur-[110px] md:h-[520px] md:w-[520px]"
      />

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_20px_60px_rgba(24,24,27,0.10)]">
          <Link
            href="/"
            aria-label="Docuzy home"
            className="mx-auto mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <FileText className="h-5 w-5" />
          </Link>

          <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
            Welcome to Docuzy
          </h1>
          <p className="mt-2 text-center text-sm text-zinc-500">
            Sign in to access your AI-powered workspace.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <form
            className="mt-6"
            action={async () => {
              "use server"
              await signIn("google", { redirectTo })
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-zinc-400">
            {"You'll be redirected to Google to complete sign-in."}
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link
            href="/"
            className="font-medium text-zinc-700 transition-colors hover:text-zinc-900"
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}
