"use client"

import { useState, useEffect } from "react"
import { useLocale } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ArrowRight } from "lucide-react"
import Link from "next/link"

interface Recipe {
  id: number
  slug: string
  titleEn: string
  titleKo: string
  descriptionEn: string
  descriptionKo: string
  difficulty: string
  type: string
  generatedAt: string
}

const DIFF_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LatestRecipes({ settings }: { settings?: Record<string, any> }) {
  const locale = useLocale()
  const isKo = locale === 'ko'
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const limit = settings?.limit || 5
  const compact = settings?.compact ?? false

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const res = await fetch(`/api/vibe-coding-recipes?limit=${limit}`)
        if (res.ok) {
          const data = await res.json()
          setRecipes(data.recipes || [])
        }
      } catch (error) {
        console.error('LatestRecipes fetch failed:', error)
      }
    }
    fetchRecipes()
  }, [limit])

  const listUrl = `/${locale}/vibe-coding-recipes`

  if (compact) {
    return (
      <Card className="h-full">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            {isKo ? '최신 레시피' : 'Latest Recipes'}
          </h2>
          <Link href={listUrl} className="text-xs text-primary hover:underline flex items-center gap-1">
            {isKo ? '더보기' : 'More'} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <CardContent className="p-0">
          {recipes.length > 0 ? (
            <div className="divide-y">
              {recipes.map((recipe) => (
                <Link
                  key={recipe.id}
                  href={`/${locale}/vibe-coding-recipes/${recipe.slug}`}
                  className="block px-4 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`${DIFF_COLORS[recipe.difficulty]} text-[10px] px-1.5 py-0`}>
                      {recipe.difficulty}
                    </Badge>
                    <span className="text-sm truncate">
                      {isKo ? recipe.titleKo : recipe.titleEn}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {isKo ? '아직 레시피가 없습니다' : 'No recipes yet'}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {isKo ? '바이브코딩 레시피' : 'Vibe Coding Recipes'}
        </h2>
        <Link href={listUrl} className="text-sm text-primary hover:underline flex items-center gap-1">
          {isKo ? '전체보기' : 'View all'} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <CardContent className="p-0">
        {recipes.length > 0 ? (
          <div className="divide-y">
            {recipes.map((recipe) => {
              const title = isKo ? recipe.titleKo : recipe.titleEn
              const desc = (isKo ? recipe.descriptionKo : recipe.descriptionEn)
                .replace(/[#*`_\[\]]/g, '')
                .slice(0, 100)
              const typeLabel = recipe.type.replace(/_/g, ' ')

              return (
                <Link
                  key={recipe.id}
                  href={`/${locale}/vibe-coding-recipes/${recipe.slug}`}
                  className="block px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className={`${DIFF_COLORS[recipe.difficulty]} text-xs`}>
                          {recipe.difficulty}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {typeLabel}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm truncate">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{desc}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTimeAgo(recipe.generatedAt, isKo)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            {isKo ? '아직 레시피가 없습니다' : 'No recipes yet'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatTimeAgo(dateStr: string, isKo: boolean): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return isKo ? '오늘' : 'Today'
  if (diffDays === 1) return isKo ? '어제' : 'Yesterday'
  if (diffDays < 7) return isKo ? `${diffDays}일 전` : `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString(isKo ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })
}
