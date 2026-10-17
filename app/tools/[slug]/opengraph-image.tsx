import { ImageResponse } from "next/og"
import { findTool } from "@/lib/tools-catalog"

export const alt = "Docuzy tool"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Catalog-driven social card for every tool page.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tool = findTool(slug)
  const title = tool?.seo?.title ?? tool?.name ?? "Docuzy Tools"
  const subtitle =
    tool?.seo?.description ?? "PDF & image tools for everyday file tasks — all processed in your browser."

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FAFAFA",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", width: 56, height: 56, borderRadius: 16, background: "#4F46E5" }} />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#18181B" }}>Docuzy</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: "#18181B", lineHeight: 1.1 }}>
            {title}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#52525B", marginTop: 20, lineHeight: 1.35 }}>
            {subtitle}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#A1A1AA" }}>docuzy.app</div>
      </div>
    ),
    { ...size }
  )
}
