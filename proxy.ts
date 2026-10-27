import { auth } from "@/auth"
import type { NextRequest } from "next/server"

interface AuthRequest extends NextRequest {
  auth?: { user?: { id?: string | null; email?: string | null } } | null
}

export default auth((req: AuthRequest) => {
  const isLoggedIn = !!req.auth
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard")

  if (isDashboard && !isLoggedIn) {
    // Preserve the intended destination so the user returns to the page/action
    // that triggered auth (USER-FLOWS.md §7 Redirect Rules). Consumed by
    // app/login/page.tsx via safeRedirect(params.callbackUrl).
    const callbackUrl = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)
    return Response.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, req.nextUrl))
  }
})