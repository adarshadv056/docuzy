'use server'

import sharp from 'sharp'

export interface ConvertResult {
  success: boolean
  dataUrl?: string
  size?: number
  width?: number
  height?: number
  error?: string
}

/**
 * Server-side conversion for HEIC/HEIF files (e.g. iPhone photos)
 * since Chrome/Firefox/Edge on Windows/Linux do not decode HEIC in browser <img />.
 */
export async function convertHeic(formData: FormData): Promise<ConvertResult> {
  try {
    const file = formData.get('file') as File | null
    const quality = Number(formData.get('quality') || 92)

    if (!file) {
      return { success: false, error: 'No file uploaded.' }
    }

    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    const image = sharp(inputBuffer)
    const metadata = await image.metadata()

    // Convert to JPEG with white background for any transparency
    const outputBuffer = await image
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()

    const base64 = outputBuffer.toString('base64')
    const dataUrl = `data:image/jpeg;base64,${base64}`

    return {
      success: true,
      dataUrl,
      size: outputBuffer.length,
      width: metadata.width,
      height: metadata.height,
    }
  } catch (err: unknown) {
    console.error('HEIC conversion error:', err)
    return {
      success: false,
      error: 'Failed to convert HEIC image. Please ensure the file is a valid HEIC/HEIF photo.',
    }
  }
}

/**
 * Server-side fallback for converting images (JPG/PNG/WebP) to AVIF
 * when the client browser's HTML5 Canvas does not support canvas.toBlob('image/avif').
 */
export async function convertToAvif(formData: FormData): Promise<ConvertResult> {
  try {
    const file = formData.get('file') as File | null
    const quality = Number(formData.get('quality') || 80)

    if (!file) {
      return { success: false, error: 'No file uploaded.' }
    }

    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    const image = sharp(inputBuffer)
    const metadata = await image.metadata()

    const outputBuffer = await image
      .avif({ quality, effort: 4 })
      .toBuffer()

    const base64 = outputBuffer.toString('base64')
    const dataUrl = `data:image/avif;base64,${base64}`

    return {
      success: true,
      dataUrl,
      size: outputBuffer.length,
      width: metadata.width,
      height: metadata.height,
    }
  } catch (err: unknown) {
    console.error('AVIF encoding error:', err)
    return {
      success: false,
      error: 'Failed to encode image to AVIF.',
    }
  }
}

/**
 * Server-side fallback for decoding AVIF and converting to JPG or PNG
 * for older browsers or environments that lack native AVIF decoding.
 */
export async function convertFromAvif(formData: FormData): Promise<ConvertResult> {
  try {
    const file = formData.get('file') as File | null
    const format = (formData.get('format') as string || 'jpeg') === 'png' ? 'png' : 'jpeg'
    const quality = Number(formData.get('quality') || 92)

    if (!file) {
      return { success: false, error: 'No file uploaded.' }
    }

    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    const image = sharp(inputBuffer)
    const metadata = await image.metadata()

    let outputBuffer: Buffer
    let mime = 'image/jpeg'

    if (format === 'png') {
      outputBuffer = await image.png().toBuffer()
      mime = 'image/png'
    } else {
      outputBuffer = await image
        .flatten({ background: '#ffffff' })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()
    }

    const base64 = outputBuffer.toString('base64')
    const dataUrl = `data:${mime};base64,${base64}`

    return {
      success: true,
      dataUrl,
      size: outputBuffer.length,
      width: metadata.width,
      height: metadata.height,
    }
  } catch (err: unknown) {
    console.error('AVIF decoding error:', err)
    return {
      success: false,
      error: 'Failed to convert AVIF image.',
    }
  }
}
