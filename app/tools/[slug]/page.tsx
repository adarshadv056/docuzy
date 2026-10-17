import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  TOOL_WIDTH_CLASS,
  availableSlugs,
  findTool,
  toolMetadata,
} from "@/lib/tools-catalog"
import ToolHeader from "@/components/tools/ToolHeader"
import ToolRunner from "@/components/tools/ToolRunner"
import RelatedTools from "@/components/tools/RelatedTools"

// Every available tool is prerendered from the catalog — no hand-written route
// folders. Unknown or coming-soon slugs fall through to notFound().
export function generateStaticParams() {
  return availableSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tool = findTool(slug)
  return tool ? toolMetadata(tool) : {}
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tool = findTool(slug)
  if (!tool) notFound()

  return (
    <main className="mx-auto w-full px-6 pb-24 pt-8">
      <div className={`mx-auto ${TOOL_WIDTH_CLASS[tool.width ?? "medium"]}`}>
        <ToolHeader tool={tool} />
        <ToolRunner slug={slug} />
        <RelatedTools tool={tool} />
      </div>
    </main>
  )
}
