import type { MetadataRoute } from "next"
import { availableSlugs } from "@/lib/tools-catalog"

const BASE_URL = "https://docuzy.app"

// Generated from the catalog so new tools appear in the sitemap automatically.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/tools`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...availableSlugs().map((slug) => ({
      url: `${BASE_URL}/tools/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ]
}
