/**
 * Pure In-House Native EPUB Parser (EPUB 2 & EPUB 3)
 * 100% In-house, zero external npm dependencies.
 *
 * Reads EPUB archives via lib/zip/zip-native.ts, extracts metadata,
 * covers, navigation TOC, chapters, and inlines illustrations/images as data URLs.
 */

import { readZip, type ZipEntry } from '@/lib/zip/zip-native'

export interface EpubTocItem {
  id?: string
  title: string
  href: string
  targetPath: string
  level: number
}

export interface ParsedChapter {
  id: string
  title: string
  href: string
  fullPath: string
  contentHtml: string
  plainText: string
  wordCount: number
  characterCount: number
}

export interface ParsedEpubMetadata {
  title: string
  author: string
  publisher?: string
  language?: string
  description?: string
  date?: string
  identifier?: string
  coverDataUrl?: string
  coverMime?: string
}

export interface ParsedEpub {
  metadata: ParsedEpubMetadata
  toc: EpubTocItem[]
  chapters: ParsedChapter[]
  totalWords: number
  totalCharacters: number
  fileSizeBytes: number
  fileName: string
}

/**
 * Converts Uint8Array to base64 string in memory-safe chunks.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  const chunkSize = 0x8000 // 32KB chunking to avoid call stack limits
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len))
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  return btoa(binary)
}

/**
 * Normalizes relative paths inside a zip archive.
 */
export function resolveZipPath(baseDir: string, relPath: string): string {
  // Strip query/hash parameters
  const cleanRel = decodeURIComponent(relPath.split('#')[0].split('?')[0]).trim()
  if (cleanRel.startsWith('/')) {
    return cleanRel.replace(/^\/+/, '')
  }

  const combined = (baseDir ? baseDir.replace(/\/+$/, '') + '/' : '') + cleanRel
  const parts = combined.split('/')
  const resolved: string[] = []

  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') {
      if (resolved.length > 0) resolved.pop()
    } else {
      resolved.push(part)
    }
  }

  return resolved.join('/')
}

/**
 * Guesses MIME type from file extension.
 */
function getMimeType(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return 'image/jpeg'
}

/**
 * Parses an EPUB archive into structured metadata, chapters, and inline media.
 */
export async function parseEpub(data: Uint8Array, fileName: string = 'book.epub'): Promise<ParsedEpub> {
  const entries: ZipEntry[] = await readZip(data)
  if (entries.length === 0) {
    throw new Error('The uploaded file is empty or not a valid ZIP archive.')
  }

  // Build entry map with normalized paths
  const entryMap = new Map<string, Uint8Array>()
  for (const entry of entries) {
    const norm = entry.name.replace(/\\/g, '/').replace(/^\.?\/+/, '')
    entryMap.set(norm, entry.data)
  }

  const textDecoder = new TextDecoder('utf-8')

  // 1. Locate rootfile from META-INF/container.xml
  let opfPath = ''
  const containerData = entryMap.get('META-INF/container.xml') || entryMap.get('meta-inf/container.xml')

  if (containerData) {
    const containerXml = textDecoder.decode(containerData)
    // Look for full-path attribute in rootfile
    const rootfileMatch = containerXml.match(/<rootfile[^>]+full-path=["']([^"']+)["']/i)
    if (rootfileMatch && rootfileMatch[1]) {
      opfPath = rootfileMatch[1].replace(/^\.?\/+/, '')
    }
  }

  // Fallback: look for any .opf file in the archive
  if (!opfPath) {
    for (const [name] of entryMap.entries()) {
      if (name.toLowerCase().endsWith('.opf')) {
        opfPath = name
        break
      }
    }
  }

  if (!opfPath || !entryMap.has(opfPath)) {
    throw new Error('Invalid EPUB: Missing package document (.opf file).')
  }

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const opfContent = textDecoder.decode(entryMap.get(opfPath)!)

  // Parse OPF XML
  let domParser: DOMParser | null = null
  if (typeof DOMParser !== 'undefined') {
    domParser = new DOMParser()
  }

  let opfDoc: Document | null = null
  if (domParser) {
    try {
      opfDoc = domParser.parseFromString(opfContent, 'application/xml')
    } catch {
      opfDoc = null
    }
  }

  // Helper for text extraction from XML
  const getTagValue = (tagName: string): string => {
    if (opfDoc) {
      const el = opfDoc.getElementsByTagName(tagName)[0] || opfDoc.getElementsByTagNameNS('*', tagName)[0]
      if (el && el.textContent) return el.textContent.trim()
    }
    const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, 'i')
    const match = opfContent.match(regex)
    return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : ''
  }

  // 2. Extract Metadata
  const metadata: ParsedEpubMetadata = {
    title: getTagValue('title') || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
    author: getTagValue('creator') || 'Unknown Author',
    publisher: getTagValue('publisher') || undefined,
    language: getTagValue('language') || 'en',
    description: getTagValue('description') || undefined,
    date: getTagValue('date') || undefined,
    identifier: getTagValue('identifier') || undefined,
  }

  // 3. Extract Manifest Items
  interface ManifestItem {
    id: string
    href: string
    fullPath: string
    mediaType: string
    properties?: string
  }
  const manifest = new Map<string, ManifestItem>()
  let coverItemId: string | null = null

  if (opfDoc) {
    const itemEls = opfDoc.getElementsByTagName('item')
    for (let i = 0; i < itemEls.length; i++) {
      const el = itemEls[i]
      const id = el.getAttribute('id') || ''
      const href = el.getAttribute('href') || ''
      const mediaType = el.getAttribute('media-type') || ''
      const properties = el.getAttribute('properties') || ''

      if (id && href) {
        const fullPath = resolveZipPath(opfDir, href)
        manifest.set(id, { id, href, fullPath, mediaType, properties })

        // Check if cover image
        if (properties.includes('cover-image') || id.toLowerCase() === 'cover-image' || id.toLowerCase() === 'cover') {
          coverItemId = id
        }
      }
    }
  } else {
    // Regex fallback for manifest
    const itemRegex = /<item\s+[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*media-type=["']([^"']+)["'][^>]*>/gi
    let match
    while ((match = itemRegex.exec(opfContent)) !== null) {
      const id = match[1]
      const href = match[2]
      const mediaType = match[3]
      const fullPath = resolveZipPath(opfDir, href)
      manifest.set(id, { id, href, fullPath, mediaType })
    }
  }

  // Check <meta name="cover" content="..."/>
  if (!coverItemId) {
    const metaCoverMatch = opfContent.match(/<meta\s+[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i)
    if (metaCoverMatch && metaCoverMatch[1]) {
      coverItemId = metaCoverMatch[1]
    }
  }

  // 4. Extract Cover Image if available
  let coverDataUrl: string | undefined
  let coverMime: string | undefined

  if (coverItemId && manifest.has(coverItemId)) {
    const coverItem = manifest.get(coverItemId)!
    const coverBytes = entryMap.get(coverItem.fullPath)
    if (coverBytes && coverBytes.length > 0) {
      coverMime = coverItem.mediaType || getMimeType(coverItem.fullPath)
      coverDataUrl = `data:${coverMime};base64,${uint8ArrayToBase64(coverBytes)}`
    }
  }

  // Fallback cover search: look for image files with "cover" in their name
  if (!coverDataUrl) {
    for (const [path, bytes] of entryMap.entries()) {
      const lower = path.toLowerCase()
      if (lower.includes('cover') && (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp'))) {
        coverMime = getMimeType(path)
        coverDataUrl = `data:${coverMime};base64,${uint8ArrayToBase64(bytes)}`
        break
      }
    }
  }

  metadata.coverDataUrl = coverDataUrl
  metadata.coverMime = coverMime

  // 5. Extract Spine (Reading Order)
  const spineItemRefs: string[] = []
  if (opfDoc) {
    const itemRefs = opfDoc.getElementsByTagName('itemref')
    for (let i = 0; i < itemRefs.length; i++) {
      const idref = itemRefs[i].getAttribute('idref')
      if (idref) spineItemRefs.push(idref)
    }
  } else {
    const spineRegex = /<itemref\s+[^>]*idref=["']([^"']+)["']/gi
    let match
    while ((match = spineRegex.exec(opfContent)) !== null) {
      spineItemRefs.push(match[1])
    }
  }

  // 6. Extract Table of Contents (NCX / EPUB 3 Nav)
  const tocList: EpubTocItem[] = []
  const tocTitleMap = new Map<string, string>()

  // Try EPUB 3 Navigation Document first
  let navItem: ManifestItem | undefined
  for (const item of manifest.values()) {
    if (item.properties && item.properties.includes('nav')) {
      navItem = item
      break
    }
  }

  if (navItem && entryMap.has(navItem.fullPath) && domParser) {
    try {
      const navXml = textDecoder.decode(entryMap.get(navItem.fullPath)!)
      const navDoc = domParser.parseFromString(navXml, 'application/xhtml+xml')
      const links = navDoc.querySelectorAll('nav[epub\\:type="toc"] a, nav#toc a, nav ol a')
      links.forEach((a, idx) => {
        const text = a.textContent?.trim() || `Section ${idx + 1}`
        const href = a.getAttribute('href') || ''
        if (href) {
          const navDir = navItem!.fullPath.includes('/') ? navItem!.fullPath.slice(0, navItem!.fullPath.lastIndexOf('/') + 1) : ''
          const target = resolveZipPath(navDir, href)
          tocList.push({
            id: `toc-${idx + 1}`,
            title: text,
            href,
            targetPath: target,
            level: 1,
          })
          tocTitleMap.set(target, text)
        }
      })
    } catch {
      // Continue to NCX fallback
    }
  }

  // Fallback to EPUB 2 NCX file
  if (tocList.length === 0) {
    let ncxItem: ManifestItem | undefined
    for (const item of manifest.values()) {
      if (item.mediaType === 'application/x-dtbncx+xml' || item.id === 'ncx' || item.href.endsWith('.ncx')) {
        ncxItem = item
        break
      }
    }

    if (ncxItem && entryMap.has(ncxItem.fullPath) && domParser) {
      try {
        const ncxXml = textDecoder.decode(entryMap.get(ncxItem.fullPath)!)
        const ncxDoc = domParser.parseFromString(ncxXml, 'application/xml')
        const navPoints = ncxDoc.getElementsByTagName('navPoint')
        const ncxDir = ncxItem.fullPath.includes('/') ? ncxItem.fullPath.slice(0, ncxItem.fullPath.lastIndexOf('/') + 1) : ''

        for (let i = 0; i < navPoints.length; i++) {
          const np = navPoints[i]
          const labelEl = np.getElementsByTagName('text')[0]
          const contentEl = np.getElementsByTagName('content')[0]
          const title = labelEl?.textContent?.trim() || `Chapter ${i + 1}`
          const src = contentEl?.getAttribute('src') || ''
          if (src) {
            const target = resolveZipPath(ncxDir, src)
            tocList.push({
              id: np.getAttribute('id') || `ncx-${i + 1}`,
              title,
              href: src,
              targetPath: target,
              level: 1,
            })
            tocTitleMap.set(target, title)
          }
        }
      } catch {
        // NCX parsing failed, fallback below
      }
    }
  }

  // 7. Extract and Process Chapters from Spine
  const chapters: ParsedChapter[] = []
  let totalWords = 0
  let totalCharacters = 0

  for (let sIdx = 0; sIdx < spineItemRefs.length; sIdx++) {
    const idref = spineItemRefs[sIdx]
    const item = manifest.get(idref)
    if (!item) continue

    const chapterBytes = entryMap.get(item.fullPath)
    if (!chapterBytes) continue

    const chapterDir = item.fullPath.includes('/') ? item.fullPath.slice(0, item.fullPath.lastIndexOf('/') + 1) : ''
    const rawHtml = textDecoder.decode(chapterBytes)

    let chapterTitle = tocTitleMap.get(item.fullPath) || ''
    let cleanedHtml = ''
    let plainText = ''

    if (domParser) {
      try {
        const parsedDoc = domParser.parseFromString(rawHtml, 'application/xhtml+xml')
        // Check for XML parsing errors
        const parserError = parsedDoc.getElementsByTagName('parsererror')[0]
        const docToUse = parserError ? domParser.parseFromString(rawHtml, 'text/html') : parsedDoc

        // Discover title if not in TOC
        if (!chapterTitle) {
          const h1 = docToUse.querySelector('h1, h2, h3')
          if (h1 && h1.textContent?.trim()) {
            chapterTitle = h1.textContent.trim()
          } else {
            const headTitle = docToUse.querySelector('title')
            if (headTitle && headTitle.textContent?.trim()) {
              chapterTitle = headTitle.textContent.trim()
            }
          }
        }

        // Inline images inside XHTML
        const imgEls = docToUse.querySelectorAll('img, image')
        imgEls.forEach((img) => {
          const src = img.getAttribute('src') || img.getAttribute('xlink:href') || img.getAttribute('href') || ''
          if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
            const resolvedImgPath = resolveZipPath(chapterDir, src)
            const imgData = entryMap.get(resolvedImgPath)
            if (imgData) {
              const mime = getMimeType(resolvedImgPath)
              const dataUrl = `data:${mime};base64,${uint8ArrayToBase64(imgData)}`
              if (img.tagName.toLowerCase() === 'image') {
                img.setAttribute('xlink:href', dataUrl)
                img.setAttribute('href', dataUrl)
              } else {
                img.setAttribute('src', dataUrl)
              }
            }
          }
        })

        // Remove script, style, noscript tags to avoid style conflicts and security issues
        const scripts = docToUse.querySelectorAll('script, noscript')
        scripts.forEach((s) => s.remove())

        // Extract body HTML
        const body = docToUse.body || docToUse.documentElement
        cleanedHtml = body.innerHTML
        plainText = (body.textContent || '').replace(/\s+/g, ' ').trim()
      } catch {
        cleanedHtml = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
        plainText = cleanedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    } else {
      cleanedHtml = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
      plainText = cleanedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }

    if (!chapterTitle) {
      chapterTitle = `Chapter ${sIdx + 1}`
    }

    const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0
    totalWords += words
    totalCharacters += plainText.length

    chapters.push({
      id: item.id,
      title: chapterTitle,
      href: item.href,
      fullPath: item.fullPath,
      contentHtml: cleanedHtml,
      plainText,
      wordCount: words,
      characterCount: plainText.length,
    })
  }

  return {
    metadata,
    toc: tocList,
    chapters,
    totalWords,
    totalCharacters,
    fileSizeBytes: data.byteLength,
    fileName,
  }
}
