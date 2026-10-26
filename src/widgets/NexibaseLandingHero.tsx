"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Github,
  ExternalLink,
  BookOpen,
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
const DOCS_URL = "https://github.com/nexibase/nexibase#quick-start"

const SITE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || ""


interface GitHubRelease {
  tag_name?: string
  published_at?: string
  html_url?: string
}

export default function NexibaseLandingHero() {
  const t = useTranslations("widgets.landingHero")
  const tRel = useTranslations("widgets.landingHero.relativeTime")

  const FEATURES = [
    { icon: Puzzle, label: t("features.plugins") },
    { icon: Palette, label: t("features.themes") },
    { icon: LayoutGrid, label: t("features.widgets") },
    { icon: MessageSquare, label: t("features.boards") },
    { icon: Users, label: t("features.auth") },
    { icon: Globe, label: t("features.i18n") },
  ]

  const formatRelativeTime = useCallback((iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime()
    const day = 24 * 60 * 60 * 1000
    if (diff < day) return tRel("today")
    const days = Math.floor(diff / day)
    if (days < 7) return tRel("daysAgo", { days })
    if (days < 30) return tRel("weeksAgo", { weeks: Math.floor(days / 7) })
    if (days < 365) return tRel("monthsAgo", { months: Math.floor(days / 30) })
    return tRel("yearsAgo", { years: Math.floor(days / 365) })
  }, [tRel])

  const [stars, setStars] = useState<number | null>(null)
  const [release, setRelease] = useState<GitHubRelease | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch("/api/github-stats")
      .then(res => (res.ok ? res.json() : null))
      .then((data: { stars: number | null; release: GitHubRelease | null } | null) => {
        if (cancelled || !data) return
        if (typeof data.stars === "number") setStars(data.stars)
        if (data.release) setRelease(data.release)
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
            {t("badge")}
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

        <div className="space-y-1.5 break-keep">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
            {t("headline")}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t("tagline")}
          </p>
        </div>

        <div className="rounded-md border bg-background/80 max-w-2xl px-3 py-2.5 space-y-1 break-keep">
          <p className="text-sm font-medium">{t("installRequirements")}</p>
          <p className="text-xs md:text-sm text-muted-foreground">{t("installGuide")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Button size="sm">
              <Github className="h-4 w-4 mr-1.5" />
              {t("starOnGithub")}
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
              {t("liveDemo")}
            </Button>
          </Link>
          <Link href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <BookOpen className="h-4 w-4 mr-1.5" />
              {t("docs")}
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
          <span>{t("footer")}</span>
        </div>
      </CardContent>
    </Card>
  )
}
