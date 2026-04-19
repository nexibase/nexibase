"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Github,
  ExternalLink,
  BookOpen,
  Copy,
  Check,
  Puzzle,
  Palette,
  Globe,
  MessageSquare,
  LayoutGrid,
  Users,
} from "lucide-react"
import Link from "next/link"

const GITHUB_URL = "https://github.com/nexibase/nexibase"
const TAGS_URL = "https://github.com/nexibase/nexibase/tags"
const DEMO_URL = "https://demo.nexibase.com"
const DOCS_URL = "https://github.com/nexibase/nexibase#readme"

const INSTALL_CMD = `git clone --recurse-submodules https://github.com/nexibase/nexibase.git
cd nexibase && docker compose up -d`

const SITE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || ""

const FEATURES = [
  { icon: Puzzle, label: "Plugins" },
  { icon: Palette, label: "Themes" },
  { icon: LayoutGrid, label: "Widgets" },
  { icon: MessageSquare, label: "Boards" },
  { icon: Users, label: "Auth" },
  { icon: Globe, label: "EN / 한국어" },
]

interface GitHubRelease {
  tag_name?: string
  published_at?: string
  html_url?: string
}

interface GitHubRepo {
  stargazers_count?: number
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return "today"
  const days = Math.floor(diff / day)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function NexibaseLandingHero() {
  const [copied, setCopied] = useState(false)
  const [stars, setStars] = useState<number | null>(null)
  const [release, setRelease] = useState<GitHubRelease | null>(null)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API not available; ignore
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch("https://api.github.com/repos/nexibase/nexibase")
      .then(res => (res.ok ? res.json() : null))
      .then((data: GitHubRepo | null) => {
        if (cancelled || !data) return
        if (typeof data.stargazers_count === "number") {
          setStars(data.stargazers_count)
        }
      })
      .catch(() => {})

    fetch("https://api.github.com/repos/nexibase/nexibase/releases/latest")
      .then(res => (res.ok ? res.json() : null))
      .then((data: GitHubRelease | null) => {
        if (cancelled || !data) return
        setRelease(data)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const starLabel =
    stars === null ? null : stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : String(stars)

  const versionTag = release?.tag_name
    ? release.tag_name.startsWith("v")
      ? release.tag_name
      : `v${release.tag_name}`
    : SITE_VERSION
      ? `v${SITE_VERSION}`
      : ""
  const releasedAgo = release?.published_at ? formatRelativeTime(release.published_at) : ""

  return (
    <Card className="h-full border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
      <CardContent className="p-5 md:p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Open source · Next.js 16
          </span>
          {versionTag && (
            <Link
              href={TAGS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border bg-background shadow-xs px-2.5 py-0.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
            >
              <span className="font-mono font-medium text-foreground">{versionTag}</span>
              {releasedAgo && (
                <span className="text-muted-foreground">· {releasedAgo}</span>
              )}
            </Link>
          )}
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
            The community CMS, in one Next.js app.
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Launch forums, boards, and membership sites in under a minute —
            plugin folders, CSS-variable themes, pick your language at install.
            One self-hostable codebase.
          </p>
        </div>

        <div className="relative rounded-md border bg-background/80 max-w-2xl">
          <pre className="font-mono text-xs md:text-sm leading-relaxed overflow-x-auto px-3 py-2.5 pr-11">
            <code>
              <span className="text-muted-foreground select-none">$ </span>
              <span>git clone --recurse-submodules https://github.com/nexibase/nexibase.git</span>
              {"\n"}
              <span className="text-muted-foreground select-none">$ </span>
              <span>cd nexibase && docker compose up -d</span>
            </code>
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy install command"
            className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded border bg-background hover:bg-muted transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Button size="sm">
              <Github className="h-4 w-4 mr-1.5" />
              Star on GitHub
              {starLabel && (
                <span className="ml-1.5 rounded-sm bg-white/15 px-1.5 py-0.5 text-[11px] font-mono leading-none">
                  {starLabel}
                </span>
              )}
            </Button>
          </Link>
          <Link href={DEMO_URL} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Live demo
            </Button>
          </Link>
          <Link href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <BookOpen className="h-4 w-4 mr-1.5" />
              Docs
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-1">
          {FEATURES.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">{label}</span>
            </span>
          ))}
          <span className="hidden md:inline text-muted-foreground/50">·</span>
          <span>MIT · Self-hostable</span>
        </div>
      </CardContent>
    </Card>
  )
}
