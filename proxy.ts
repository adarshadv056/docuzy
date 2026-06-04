import { auth } from "@/auth"
import type { NextRequest } from "next/server"

interface AuthRequest extends NextRequest {
  auth: any
}

export default auth((req: AuthRequest) => {
  const isLoggedIn = !!req.auth
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard")

  if (isDashboard && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl))
  }
})