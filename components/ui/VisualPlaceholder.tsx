"use client"

import {
  Monitor,
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  FolderOpen,
  Edit3,
  Sliders,
  Maximize2
} from "lucide-react"

export interface VisualPlaceholderProps {
  title: string
  description: string
  aspectRatio?: "16/9" | "4/3" | "1/1" | "3/2" | "21/9"
  variant?: "dashboard" | "chat" | "tool" | "workspace" | "editor" | "workflow" | "default"
  appPath?: string
  specBadge?: string
  recommendedFormat?: string
}

const variantConfig: Record<
  NonNullable<VisualPlaceholderProps["variant"]>,
  {
    icon: React.ComponentType<{ className?: string }>
    accentLabel: string
    defaultPath: string
  }
> = {
  dashboard: {
    icon: LayoutDashboard,
    accentLabel: "Workspace UI Showcase",
    defaultPath: "docuzy.app/workspace/documents",
  },
  chat: {
    icon: MessageSquare,
    accentLabel: "AI Document Chat Demo",
    defaultPath: "docuzy.app/workspace/chat?doc=ml-notes",
  },
  tool: {
    icon: Sliders,
    accentLabel: "PDF & Image Utilities",
    defaultPath: "docuzy.app/tools/compress-pdf",
  },
  workspace: {
    icon: FolderOpen,
    accentLabel: "File System & Tags",
    defaultPath: "docuzy.app/workspace/folders/fall-2026",
  },
  editor: {
    icon: Edit3,
    accentLabel: "Document Annotation Studio",
    defaultPath: "docuzy.app/editor/thesis-draft-v3",
  },
  workflow: {
    icon: Sparkles,
    accentLabel: "5-Step Pipeline Flow",
    defaultPath: "docuzy.app/pipeline/rag-engine",
  },
  default: {
    icon: Monitor,
    accentLabel: "Interactive Product Visual",
    defaultPath: "docuzy.app",
  },
}

export default function VisualPlaceholder({
  title,
  description,
  aspectRatio = "16/9",
  variant = "default",
  appPath,
  specBadge,
  recommendedFormat = "1920×1080 WebM / MP4 or High-Res SVG Mockup",
}: VisualPlaceholderProps) {
  const config = variantConfig[variant] || variantConfig.default
  const Icon = config.icon
  const displayPath = appPath || config.defaultPath

  const aspectRatioClasses = {
    "16/9": "aspect-video",
    "4/3": "aspect-[4/3]",
    "1/1": "aspect-square",
    "3/2": "aspect-[3/2]",
    "21/9": "aspect-[21/9]",
  }

  return (
    <div
      className={`group relative ${aspectRatioClasses[aspectRatio]} w-full rounded-2xl md:rounded-3xl border border-[var(--border-primary)] bg-[var(--bg-card)] overflow-hidden shadow-2xl transition-all duration-500 hover:border-[var(--accent)] hover:shadow-[0_20px_50px_var(--accent-glow)]`}
    >
      {/* Ambient background glow inside frame */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent-glow)] via-transparent to-transparent opacity-40 pointer-events-none" />
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[var(--accent)]/10 blur-3xl pointer-events-none" />

      {/* App Window Chrome / Header */}
      <div className="relative z-20 flex h-11 w-full items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/90 px-4 backdrop-blur-md">
        {/* macOS Traffic Lights */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#ff5f56]/90 border border-[#e0443e]" />
          <div className="h-3 w-3 rounded-full bg-[#ffbd2e]/90 border border-[#dea123]" />
          <div className="h-3 w-3 rounded-full bg-[#27c93f]/90 border border-[#1aab29]" />
        </div>

        {/* Address / Route Bar */}
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3 py-1 text-xs text-[var(--text-muted)] font-mono max-w-[280px] sm:max-w-md truncate">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="truncate">{displayPath}</span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <span className="hidden sm:inline-block text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)]">
            UI Asset
          </span>
          <Maximize2 className="h-3.5 w-3.5 opacity-60" />
        </div>
      </div>

      {/* Simulated Underlay Wireframe based on variant */}
      <div className="absolute inset-0 pt-11 overflow-hidden opacity-25 dark:opacity-20 pointer-events-none select-none">
        {variant === "dashboard" && (
          <div className="p-6 grid grid-cols-12 gap-4 h-full">
            <div className="col-span-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 space-y-2">
              <div className="h-4 w-20 rounded bg-[var(--border-primary)]" />
              <div className="h-3 w-full rounded bg-[var(--border-primary)]/50" />
              <div className="h-3 w-4/5 rounded bg-[var(--border-primary)]/50" />
              <div className="h-3 w-3/4 rounded bg-[var(--border-primary)]/50" />
            </div>
            <div className="col-span-9 space-y-4">
              <div className="h-8 w-full rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-28 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 space-y-2">
                  <div className="h-3 w-12 rounded bg-indigo-500/40" />
                  <div className="h-4 w-3/4 rounded bg-[var(--border-primary)]" />
                </div>
                <div className="h-28 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 space-y-2">
                  <div className="h-3 w-12 rounded bg-blue-500/40" />
                  <div className="h-4 w-3/4 rounded bg-[var(--border-primary)]" />
                </div>
                <div className="h-28 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 space-y-2">
                  <div className="h-3 w-12 rounded bg-emerald-500/40" />
                  <div className="h-4 w-3/4 rounded bg-[var(--border-primary)]" />
                </div>
              </div>
            </div>
          </div>
        )}

        {variant === "chat" && (
          <div className="p-6 grid grid-cols-12 gap-4 h-full">
            <div className="col-span-6 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 space-y-2">
              <div className="h-5 w-1/3 rounded bg-[var(--border-primary)]" />
              <div className="h-3 w-full rounded bg-[var(--border-primary)]/40" />
              <div className="h-3 w-5/6 rounded bg-[var(--border-primary)]/40" />
              <div className="h-3 w-4/5 rounded bg-indigo-500/30" />
            </div>
            <div className="col-span-6 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="ml-auto w-3/4 rounded-xl bg-indigo-600/30 border border-indigo-500/30 p-3 h-12" />
                <div className="mr-auto w-4/5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-3 h-20" />
              </div>
              <div className="h-10 w-full rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]" />
            </div>
          </div>
        )}

        {(variant === "tool" || variant === "editor" || variant === "workspace" || variant === "workflow" || variant === "default") && (
          <div className="p-6 space-y-4 h-full">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 rounded-lg bg-[var(--border-primary)]" />
              <div className="h-6 w-24 rounded-lg bg-[var(--border-primary)]/60" />
            </div>
            <div className="grid grid-cols-4 gap-4 h-3/4">
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]" />
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]" />
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]" />
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]" />
            </div>
          </div>
        )}
      </div>

      {/* Floating Glassmorphic Spec Card */}
      <div className="relative z-30 flex h-[calc(100%-2.75rem)] w-full items-center justify-center p-6 md:p-10">
        <div className="max-w-xl w-full rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/90 p-6 md:p-8 backdrop-blur-xl shadow-2xl text-center transition-transform duration-300 group-hover:scale-[1.01]">
          {/* Badge */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-1 text-xs font-semibold text-[var(--accent)] shadow-sm">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{specBadge || config.accentLabel}</span>
          </div>

          {/* Title */}
          <h4 className="text-lg md:text-xl font-bold tracking-tight text-[var(--text-primary)]">
            {title}
          </h4>

          {/* Description of what visual to place here */}
          <p className="mt-3 text-xs md:text-sm leading-relaxed text-[var(--text-secondary)] font-normal">
            {description}
          </p>

          {/* Recommended format footer */}
          <div className="mt-5 pt-4 border-t border-[var(--border-primary)] flex flex-wrap items-center justify-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">Placement Guide:</span>
            <span className="rounded-md bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[10px] border border-[var(--border-primary)]">
              {recommendedFormat}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}