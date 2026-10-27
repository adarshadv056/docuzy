/**
 * Pure In-House Native Document Scanner Filters
 * 100% In-house, zero external dependencies.
 *
 * Implements high-performance pixel processing for document enhancement:
 * - Magic Color (background whitening + text deepening + color preservation)
 * - Crisp B&W Binarization (monochrome text scan, zero background shadows)
 * - Grayscale (smooth document gradient)
 * - Rotation and canvas transformations
 */

export type ScanFilterType = 'magic' | 'bw' | 'grayscale' | 'original'

export interface FilterOptions {
  filter: ScanFilterType
  brightness?: number // -100 to 100 (default 0)
  contrast?: number // -100 to 100 (default 0)
  rotation?: number // 0, 90, 180, 270
}

/**
 * Applies document enhancement filters and rotation to an image source.
 * Returns a high-quality data URL (JPEG).
 */
export async function processScannedImage(
  imageSource: HTMLImageElement | HTMLCanvasElement | string,
  options: FilterOptions
): Promise<{ dataUrl: string; width: number; height: number; blob: Blob }> {
  let sourceWidth: number
  let sourceHeight: number
  let drawSource: CanvasImageSource

  if (typeof imageSource === 'string') {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image scan'))
      img.src = imageSource
      if (img.complete && img.naturalWidth > 0) {
        resolve()
      }
    })
    sourceWidth = img.naturalWidth || img.width
    sourceHeight = img.naturalHeight || img.height
    drawSource = img
  } else if (imageSource instanceof HTMLImageElement) {
    sourceWidth = imageSource.naturalWidth || imageSource.width
    sourceHeight = imageSource.naturalHeight || imageSource.height
    drawSource = imageSource
  } else {
    sourceWidth = imageSource.width
    sourceHeight = imageSource.height
    drawSource = imageSource
  }

  const rotation = (options.rotation || 0) % 360
  const isQuarterTurn = rotation === 90 || rotation === 270

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable.')
  }

  canvas.width = isQuarterTurn ? sourceHeight : sourceWidth
  canvas.height = isQuarterTurn ? sourceWidth : sourceHeight

  // Apply rotation transformation
  ctx.save()
  if (rotation === 90) {
    ctx.translate(canvas.width, 0)
    ctx.rotate((90 * Math.PI) / 180)
  } else if (rotation === 180) {
    ctx.translate(canvas.width, canvas.height)
    ctx.rotate((180 * Math.PI) / 180)
  } else if (rotation === 270) {
    ctx.translate(0, canvas.height)
    ctx.rotate((270 * Math.PI) / 180)
  }

  // Draw initial image onto rotated canvas
  ctx.drawImage(drawSource, 0, 0, sourceWidth, sourceHeight)
  ctx.restore()

  // Pixel manipulation
  const width = canvas.width
  const height = canvas.height
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data

  const filter = options.filter || 'magic'
  const userBrightness = options.brightness || 0
  const userContrast = options.contrast || 0

  // Base contrast and brightness adjustment factors
  const contrastFactor = (259 * (userContrast + 255)) / (255 * (259 - userContrast))
  const brightnessOffset = userBrightness * 2.55

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // Calculate luminance (Rec. 601)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b

    if (filter === 'magic') {
      // Magic Color Document Filter:
      // Whitens paper background while deepening dark text and preserving signature/stamp colors
      if (luminance > 175) {
        // High luminance paper background: push aggressively to crisp white
        const boost = (luminance - 175) / 80 // 0 to 1
        r = r + (255 - r) * Math.min(1, boost * 1.35)
        g = g + (255 - g) * Math.min(1, boost * 1.35)
        b = b + (255 - b) * Math.min(1, boost * 1.35)
      } else if (luminance < 110) {
        // Ink / dark strokes: deepen and increase contrast
        r = r * 0.82
        g = g * 0.82
        b = b * 0.82
      } else {
        // Midtones: gently boost contrast
        const midFactor = 1.15
        r = midFactor * (r - 128) + 128
        g = midFactor * (g - 128) + 128
        b = midFactor * (b - 128) + 128
      }
    } else if (filter === 'bw') {
      // Crisp 1-bit style B&W Document Scan
      // Clean high-contrast thresholding with subtle edge preservation
      const threshold = 150 + userBrightness * 0.8
      const val = luminance < threshold ? 0 : 255
      r = val
      g = val
      b = val
    } else if (filter === 'grayscale') {
      // Grayscale Document
      // Removes color cast from ambient room lighting
      let gray = luminance
      // Auto-level stretch
      gray = (gray - 20) * (255 / (240 - 20))
      r = gray
      g = gray
      b = gray
    }

    // Apply user brightness offset
    if (userBrightness !== 0 && filter !== 'bw') {
      r += brightnessOffset
      g += brightnessOffset
      b += brightnessOffset
    }

    // Apply user contrast factor
    if (userContrast !== 0 && filter !== 'bw') {
      r = contrastFactor * (r - 128) + 128
      g = contrastFactor * (g - 128) + 128
      b = contrastFactor * (b - 128) + 128
    }

    // Clamp values to [0, 255]
    data[i] = Math.max(0, Math.min(255, r))
    data[i + 1] = Math.max(0, Math.min(255, g))
    data[i + 2] = Math.max(0, Math.min(255, b))
  }

  ctx.putImageData(imgData, 0, 0)

  // Convert to high-quality JPEG
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9)

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.9)
  })

  return {
    dataUrl,
    width,
    height,
    blob,
  }
}

/**
 * Creates synthetic sample document scans for one-click testing without a camera.
 */
export async function createSampleScans(): Promise<
  Array<{ name: string; dataUrl: string; filter: ScanFilterType }>
> {
  const samples = [
    {
      title: 'BUSINESS INVOICE & RECEIPT',
      subtitle: 'Official Statement of Work #INV-2026-884',
      date: 'October 24, 2026',
      total: '$1,450.00',
      items: [
        { desc: 'Document Security Consultation', qty: '1', price: '$850.00' },
        { desc: 'In-House Cryptography Audit', qty: '1', price: '$400.00' },
        { desc: 'ISO 32000-2 AES-256 PDF Setup', qty: '1', price: '$200.00' },
      ],
      filter: 'magic' as ScanFilterType,
    },
    {
      title: 'NON-DISCLOSURE AGREEMENT',
      subtitle: 'Mutual Proprietary Information Protocol',
      date: 'October 20, 2026',
      total: 'EXECUTED',
      items: [
        { desc: 'Clause 1: Zero External Server Transmission', qty: 'Verified', price: 'Active' },
        { desc: 'Clause 2: Native In-Browser Client Execution', qty: 'Verified', price: 'Active' },
        { desc: 'Clause 3: Complete Hardware Sovereignty', qty: 'Verified', price: 'Active' },
      ],
      filter: 'bw' as ScanFilterType,
    },
  ]

  const results: Array<{ name: string; dataUrl: string; filter: ScanFilterType }> = []

  for (let s = 0; s < samples.length; s++) {
    const item = samples[s]
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 1600
    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    // Simulate paper background with slight gradient
    const grad = ctx.createLinearGradient(0, 0, 1200, 1600)
    grad.addColorStop(0, '#fbfaf8')
    grad.addColorStop(1, '#f5f3ef')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1200, 1600)

    // Document border
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 4
    ctx.strokeRect(60, 60, 1080, 1480)

    // Header banner
    ctx.fillStyle = '#1e1b4b'
    ctx.font = 'bold 38px Georgia, serif'
    ctx.fillText(item.title, 100, 160)

    ctx.fillStyle = '#64748b'
    ctx.font = '22px system-ui, sans-serif'
    ctx.fillText(item.subtitle, 100, 210)
    ctx.fillText(`Date: ${item.date}`, 100, 250)

    // Dividing rule
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(100, 280)
    ctx.lineTo(1100, 280)
    ctx.stroke()

    // Items table header
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(100, 330, 1000, 60)

    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 22px system-ui, sans-serif'
    ctx.fillText('Description', 130, 368)
    ctx.fillText('Quantity', 700, 368)
    ctx.fillText('Status / Price', 920, 368)

    // Items rows
    let currentY = 440
    for (const row of item.items) {
      ctx.fillStyle = '#334155'
      ctx.font = '22px system-ui, sans-serif'
      ctx.fillText(row.desc, 130, currentY)
      ctx.fillText(row.qty, 700, currentY)
      ctx.fillText(row.price, 920, currentY)

      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(100, currentY + 25)
      ctx.lineTo(1100, currentY + 25)
      ctx.stroke()

      currentY += 80
    }

    // Total / Summary
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 28px system-ui, sans-serif'
    ctx.fillText(`Total / Result: ${item.total}`, 750, currentY + 60)

    // Stamp simulation
    ctx.save()
    ctx.translate(300, currentY + 180)
    ctx.rotate((-12 * Math.PI) / 180)
    ctx.strokeStyle = '#4338ca'
    ctx.lineWidth = 5
    ctx.strokeRect(-180, -50, 360, 100)
    ctx.fillStyle = '#4338ca'
    ctx.font = 'bold 32px system-ui, sans-serif'
    ctx.fillText('DOCUZY VERIFIED', -160, 10)
    ctx.restore()

    // Footer note
    ctx.fillStyle = '#94a3b8'
    ctx.font = '18px system-ui, sans-serif'
    ctx.fillText('Processed locally with Docuzy in-browser camera document scanner.', 100, 1500)

    results.push({
      name: `page-${s + 1}.jpg`,
      dataUrl: canvas.toDataURL('image/jpeg', 0.88),
      filter: item.filter,
    })
  }

  return results
}
