"use client"

import { toolWidgets } from "./registry"

/**
 * Resolves the client widget for a tool slug. The /tools/[slug] page (a Server
 * Component) renders this; the widget itself is 100% client-side.
 */
export default function ToolRunner({ slug }: { slug: string }) {
  const Widget = toolWidgets[slug]
  if (!Widget) return null
  return <Widget />
}
