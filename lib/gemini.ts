import { GoogleGenAI } from "@google/genai"

const DEFAULT_MODEL = "gemini-3.6-flash"

const EXTRACTION_PROMPT = `You are a precise document transcription engine.
Transcribe the attached document faithfully into clean Markdown.

Rules:
- Transcribe every field as a "Label: value" pair. Any caption or heading printed next to or above a value must be included verbatim as its label. Never drop labels.
- Preserve every table as a proper Markdown table with its header row and all rows and columns exactly as shown.
- Describe non-text visual elements in square brackets on their own line, with their position when identifiable: photographs or portraits, handwritten signatures, stamps and seals, logos, barcodes, QR codes, watermarks, and any other graphics. Example: [Photograph: passport-style portrait, top-right]
- Keep every number, name, date, and value verbatim. Never round, reorder, or "correct" values.
- Do not summarize, interpret, translate, or add information that is not present.
- Preserve the original language, headings, and reading order.
- Write [unreadable] only after making a genuine attempt to read a region; never skip a region silently.
- Output ONLY the transcription, with no preamble or commentary.`

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured")
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

const IMAGE_DESCRIPTION_PROMPT = `This image is a region cropped from a document.
First transcribe any visible text verbatim.
Then identify factually what is shown, such as: photograph of a person, handwritten
signature, official stamp or seal, logo, barcode, QR code, diagram, chart, or illustration.
Do not speculate about identities and do not invent details that are not visible.
Output one concise block.`

export async function transcribeDocument(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const response = await getClient().models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    config: {
      temperature: 0,
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: EXTRACTION_PROMPT },
          {
            inlineData: {
              mimeType,
              data: buffer.toString("base64"),
            },
          },
        ],
      },
    ],
  })

  const text = response.text?.trim()
  if (!text) {
    throw new Error("Empty transcription returned by Gemini")
  }
  return text
}

export async function describeImage(
  buffer: Buffer,
  mimeType = "image/png"
): Promise<string> {
  const response = await getClient().models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    config: {
      temperature: 0,
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: IMAGE_DESCRIPTION_PROMPT },
          {
            inlineData: {
              mimeType,
              data: buffer.toString("base64"),
            },
          },
        ],
      },
    ],
  })

  const text = response.text?.trim()
  if (!text) {
    throw new Error("Empty image description returned by Gemini")
  }
  return text.replace(/\s*\n+\s*/g, "; ")
}
