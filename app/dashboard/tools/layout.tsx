import ToolBreadcrumb from "@/components/tools/ToolBreadcrumb"

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToolBreadcrumb />
      {children}
    </>
  )
}
