"use client"

import dynamic from "next/dynamic"
import type { ComponentType } from "react"

/**
 * Maps a tool slug to its client widget. Loaded lazily so each tool ships its
 * own chunk, and `ssr: false` for the pdfjs tools whose modules touch browser
 * APIs at import time. Add a tool by adding one line here.
 */
export const toolWidgets: Record<string, ComponentType> = {
  "merge-pdf": dynamic(() => import("./widgets/merge-pdf")),
  "split-pdf": dynamic(() => import("./widgets/split-pdf")),
  "compress-pdf": dynamic(() => import("./widgets/compress-pdf"), { ssr: false }),
  "organize-pdf": dynamic(() => import("./widgets/organize-pdf"), { ssr: false }),
  "rotate-pdf": dynamic(() => import("./widgets/rotate-pdf"), { ssr: false }),
  "add-page-numbers": dynamic(() => import("./widgets/add-page-numbers"), { ssr: false }),
  "watermark-pdf": dynamic(() => import("./widgets/watermark-pdf"), { ssr: false }),
  "sign-pdf": dynamic(() => import("./widgets/sign-pdf"), { ssr: false }),
  "image-to-pdf": dynamic(() => import("./widgets/image-to-pdf")),
  "pdf-to-image": dynamic(() => import("./widgets/pdf-to-image"), { ssr: false }),
  "compress-image": dynamic(() => import("./widgets/compress-image")),
  "resize-image": dynamic(() => import("./widgets/resize-image")),
  "crop-image": dynamic(() => import("./widgets/crop-image")),
  "watermark-image": dynamic(() => import("./widgets/watermark-image")),
  "image-to-jpg": dynamic(() => import("./widgets/image-to-jpg")),
  "jpg-to-png": dynamic(() => import("./widgets/jpg-to-png")),
  "image-to-webp": dynamic(() => import("./widgets/image-to-webp")),
  "html-to-image": dynamic(() => import("./widgets/html-to-image")),
  "json-to-csv": dynamic(() => import("./widgets/json-to-csv")),
}
