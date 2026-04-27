import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://docuzy.vercel.app"),
  title: "Docuzy | Your Organized & AI-Powered Workspace",
  description: "Every editing tool you need, in one place. Organize your files, share your work, and let our AI handle the heavy lifting.",
  openGraph: {
    type: "website",
    url: "https://docuzy.vercel.app/",
    title: "Docuzy | Your Organized & AI-Powered Workspace",
    description:
      "Every editing tool you need, in one place. Organize your files, share your work, and let our AI handle the heavy lifting.",
    images: [
      {
        url: "https://docuzy.vercel.app/Homepage.png",
        width: 1200,
        height: 630,
        alt: "Docuzy Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Docuzy | Your Organized & AI-Powered Workspace",
    description:
      "Every editing tool you need, in one place. Organize your files, share your work, and let our AI handle the heavy lifting.",
    images: ["https://docuzy.vercel.app/Homepage.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50">
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.GA_ID}`}
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.GA_ID}');
          `}
        </Script>
        {children}
        <Analytics />
      </body>
    </html>
  );
}