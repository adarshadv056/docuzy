"use server"

export interface FetchWebpageResult {
  success: boolean
  html?: string
  title?: string
  url?: string
  error?: string
}

const PRIVATE_IP_REGEX = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.|0\.|::1|fe80:|fc00:)/i

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim()
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    PRIVATE_IP_REGEX.test(host)
  ) {
    return true
  }
  return false
}

export async function fetchWebpage(rawUrl: string): Promise<FetchWebpageResult> {
  let targetUrl: URL
  try {
    let normalized = rawUrl.trim()
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "https://" + normalized
    }
    targetUrl = new URL(normalized)
  } catch {
    return { success: false, error: "Please enter a valid web URL." }
  }

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return { success: false, error: "Only HTTP and HTTPS URLs are supported." }
  }

  if (isPrivateHost(targetUrl.hostname)) {
    return { success: false, error: "Access to private or local network addresses is restricted." }
  }

  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 DocuzyBot/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    })

    if (!res.ok) {
      return {
        success: false,
        error: `Webpage returned HTTP status ${res.status} (${res.statusText || "Error"}).`,
      }
    }

    const contentType = res.headers.get("content-type") || ""
    if (!contentType.includes("html") && !contentType.includes("xml") && !contentType.includes("text/plain")) {
      return {
        success: false,
        error: "The provided URL does not return HTML content.",
      }
    }

    const rawHtml = await res.text()

    // Safety limit on size (max 6 MB)
    if (rawHtml.length > 6 * 1024 * 1024) {
      return {
        success: false,
        error: "Webpage exceeds the 6 MB content limit for PDF rendering.",
      }
    }

    // Extract title
    const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : targetUrl.hostname

    // Sanitize scripts and iframes for security and clean rendering
    let processedHtml = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")

    // Inject <base> tag to ensure relative images and CSS load from the target host
    const finalHref = res.url || targetUrl.toString()
    const baseHref = finalHref.endsWith("/")
      ? finalHref
      : finalHref.substring(0, finalHref.lastIndexOf("/") + 1) || `${targetUrl.origin}/`
    const baseTag = `<base href="${baseHref}">`
    if (/<head\b[^>]*>/i.test(processedHtml)) {
      processedHtml = processedHtml.replace(/<head\b[^>]*>/i, `$&${baseTag}`)
    } else {
      processedHtml = `${baseTag}${processedHtml}`
    }

    return {
      success: true,
      html: processedHtml,
      title,
      url: finalHref,
    }
  } catch (err: any) {
    console.error("[fetchWebpage] error:", err)
    if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
      return {
        success: false,
        error: "Connection timed out while fetching the webpage. Please verify the URL is reachable.",
      }
    }
    return {
      success: false,
      error: err.message || "Failed to fetch webpage content.",
    }
  }
}
