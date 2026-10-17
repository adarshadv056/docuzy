import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://docuzy.app"),
  title: {
    default: "Docuzy — AI Document Workspace & PDF Tools for Students",
    // Child routes supply a bare title; the brand is appended here once.
    template: "%s — Docuzy",
  },
  description:
    "Organize your documents, use PDF and image tools, and ask AI questions about your files in one workspace built for students.",
  alternates: {
    canonical: "/",
  },
  authors: [{ name: "Docuzy" }],
  creator: "Docuzy",
  openGraph: {
    title: "Docuzy — Your Entire Workspace. Organized & AI-Powered.",
    description:
      "Store, organize, and work with your documents using built-in PDF and image tools and AI-powered document Q&A.",
    type: "website",
    locale: "en_US",
    siteName: "Docuzy",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Docuzy — Your Entire Workspace. Organized & AI-Powered.",
    description:
      "Store, organize, and work with your documents using built-in PDF and image tools and AI-powered document Q&A.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-900">
        {children}
      </body>
    </html>
  )
}