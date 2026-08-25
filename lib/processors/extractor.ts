import sharp from "sharp"
import { transcribeDocument, describeImage } from "@/lib/gemini"
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse"

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]
const TEXT_EXTENSIONS = [".txt", ".md", ".markdown"]
const MIN_CHARS_PER_PAGE = 200
const MIN_IMAGE_DIMENSION = 32
const MAX_IMAGES_PER_DOC = 50
const IMAGE_WAIT_TIMEOUT_MS = 3000
const IMAGE_COVERAGE_THRESHOLD = 1.0
const FRAGMENTED_MIN_ITEMS = 40
const FRAGMENTED_MAX_AVG_LEN = 6

export type ExtractionMethod =
  | "pages"
  | "native-text"
  | "vision"
  | "plain-text"

interface RawImageData {
  width: number
  height: number
  kind?: number
  data?: Uint8Array | Uint8ClampedArray
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".")
  return idx === -1 ? "" : name.slice(idx).toLowerCase()
}

function isTextFile(file: File): boolean {
  if (file.type === "text/plain" || file.type === "text/markdown") return true
  return TEXT_EXTENSIONS.includes(getExtension(file.name))
}

function isImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type)
}

async function extractNativePdfText(buffer: Buffer): Promise<string | null> {
  try {
    const data = await pdfParse(buffer)
    const text = (data.text || "").trim()
    const pages = Math.max(1, data.numpages || 1)
    if (text.length / pages >= MIN_CHARS_PER_PAGE) {
      return text
    }
    return null
  } catch {
    return null
  }
}

async function getPageText(
    page: any
): Promise<{ text: string; itemCount: number }> {
    const tc = await page.getTextContent()
    let text = ""
    let itemCount = 0
    let lastY: number | null = null
    for (const item of tc.items) {
        if (typeof item.str !== "string") continue
        itemCount++
        const y = Array.isArray(item.transform) ? item.transform[5] : null
        if (
            y !== null &&
            lastY !== null &&
            Math.abs(y - lastY) > 2 &&
            !text.endsWith("\n")
        ) {
            text += "\n"
        }
        text += item.str
        if (item.hasEOL) text += "\n"
        if (y !== null) lastY = y
    }
    return {
        text: text.replace(/[ \t]+\n/g, "\n").trim(),
        itemCount,
    }
}

function waitForImage(page: any, objId: string): Promise<RawImageData | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), IMAGE_WAIT_TIMEOUT_MS)
    try {
      page.objs.get(objId, (img: RawImageData | null) => {
        clearTimeout(timer)
        resolve(img ?? null)
      })
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

async function encodeRawToPng(img: RawImageData): Promise<Buffer | null> {
  const { width, height, kind, data } = img
  if (
    !width ||
    !height ||
    !data ||
    width < MIN_IMAGE_DIMENSION ||
    height < MIN_IMAGE_DIMENSION
  ) {
    return null
  }

  try {
    if (kind === 1) {
      const rowBytes = Math.ceil(width / 8)
      const gray = Buffer.alloc(width * height)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const bit =
            (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1
          gray[y * width + x] = bit ? 255 : 0
        }
      }
      return await sharp(gray, {
        raw: { width, height, channels: 1 },
      })
        .png()
        .toBuffer()
    }

    if (kind === 2 || kind === 3) {
      const channels = kind === 2 ? 3 : 4
      const expected = width * height * channels
      const buf = Buffer.from(
        data.buffer,
        data.byteOffset,
        data.byteLength
      )
      if (buf.length < expected) return null
      return await sharp(buf.subarray(0, expected), {
        raw: { width, height, channels },
      })
        .png()
        .toBuffer()
    }
  } catch {
    return null
  }
  return null
}

interface CollectedImage {
    png: Buffer
    pixelArea: number
}

async function collectPageImages(
    page: any,
    OPS: Record<string, number>
): Promise<CollectedImage[]> {
    const ops = await page.getOperatorList()
    const collected: CollectedImage[] = []

    for (let i = 0; i < ops.fnArray.length; i++) {
        if (collected.length >= MAX_IMAGES_PER_DOC) break
        const fn = ops.fnArray[i]
    if (
      fn !== OPS.paintImageXObject &&
      fn !== OPS.paintImageXObjectRepeat &&
      fn !== OPS.paintInlineImageXObject &&
      fn !== OPS.paintJpegXObject
    ) {
      continue
    }

    const arg = ops.argsArray[i][0]
    let img: RawImageData | null = null

    if (typeof arg === "string") {
      img = await waitForImage(page, arg)
    } else if (arg && typeof arg === "object") {
      img = arg as RawImageData
    }

        if (!img || !img.data) {
            console.warn(
                "[extractor] skipped image op without pixel data",
                img ? Object.keys(img) : "unresolved"
            )
            continue
        }
        const png = await encodeRawToPng(img)
        if (png) {
            collected.push({
                png,
                pixelArea: (img.width ?? 0) * (img.height ?? 0),
            })
        }
    }

    return collected
}

type PerPageResult =
    | { kind: "pages"; text: string }
    | { kind: "visual" }

async function extractPdfPerPage(buffer: Buffer): Promise<PerPageResult | null> {
  let doc: any = null
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const OPS = pdfjsLib.OPS

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      disableFontFace: true,
    })
    doc = await loadingTask.promise

    const sections: string[] = []
    let imagesUsed = 0

        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p)
            const { text, itemCount } = await getPageText(page)
            const viewport = page.getViewport({ scale: 1 })
            const images = await collectPageImages(page, OPS)

            const chars = text.length
            const avgItemLen = itemCount > 0 ? chars / itemCount : 0
            const pageArea =
                (viewport.width || 0) * (viewport.height || 0) || 1
            const imageCoverage =
                images.reduce((sum, img) => sum + img.pixelArea, 0) / pageArea

            const flags: string[] = []
            if (chars < MIN_CHARS_PER_PAGE) flags.push("SPARSE")
            if (imageCoverage >= IMAGE_COVERAGE_THRESHOLD)
                flags.push("IMG_HEAVY")
            if (
                itemCount >= FRAGMENTED_MIN_ITEMS &&
                avgItemLen < FRAGMENTED_MAX_AVG_LEN
            )
                flags.push("FRAGMENTED")

            console.log(
                `[extractor] page ${p}: chars=${chars} items=${itemCount} ` +
                    `images=${images.length} imgCov=${(imageCoverage * 100).toFixed(0)}% ` +
                    `flags=[${flags.join(",")}]`
            )

            if (flags.includes("IMG_HEAVY")) {
                console.log(
                    `[extractor] page ${p} is image-dominant -> routing whole document to Gemini vision`
                )
                return { kind: "visual" }
            }

            let section = `--- Page ${p} ---\n${text}`

            for (const image of images) {
                if (imagesUsed >= MAX_IMAGES_PER_DOC) break
                imagesUsed++
                let description = "could not be analyzed"
                try {
                    description = await describeImage(image.png)
                } catch (e) {
                    console.error(`[extractor] describeImage failed on page ${p}:`, e)
                }
                section += `\n[Image on page ${p}: ${description}]`
            }

            sections.push(section)
            page.cleanup()
        }

    if (sections.length === 0) return null
    const joined = sections.join("\n\n").trim()
    return joined ? { kind: "pages", text: joined } : null
  } catch (e) {
    console.error("[extractor] per-page pdf pipeline failed, will fall back:", e)
    return null
  } finally {
    try {
      await doc?.destroy()
    } catch { }
  }
}

export async function extractDocumentContent(
  file: File
): Promise<{ text: string; method: ExtractionMethod }> {
  const buffer = Buffer.from(await file.arrayBuffer())

  if (file.type === "application/pdf") {
    const perPage = await extractPdfPerPage(buffer)

    if (perPage?.kind === "visual") {
      const text = await transcribeDocument(buffer, file.type)
      return { text, method: "vision" }
    }

    if (perPage?.kind === "pages") {
      return { text: perPage.text, method: "pages" }
    }

    const nativeText = await extractNativePdfText(buffer)
    if (nativeText !== null) {
      return { text: nativeText, method: "native-text" }
    }

    const text = await transcribeDocument(buffer, file.type)
    return { text, method: "vision" }
  }

  if (isImageFile(file)) {
    const text = await transcribeDocument(buffer, file.type)
    return { text, method: "vision" }
  }

  if (isTextFile(file)) {
    return { text: buffer.toString("utf8").trim(), method: "plain-text" }
  }

  throw new Error(
    `Unsupported file type: ${file.type || getExtension(file.name) || "unknown"}`
  )
}
