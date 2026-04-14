"use client"

import { useState, useEffect } from "react"
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, ArrowRight, Eye, MessageSquare } from "lucide-react"
import Link from "next/link"

interface LatestPost {
  id: number
  title: string
  createdAt: string
  viewCount: number
  commentCount?: number
  author: { nickname: string | null; name: string | null }
  board: { slug: string; name: string }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LatestPosts({ settings }: { settings?: Record<string, any> }) {
  const t = useTranslations('boards')
  const locale = useLocale()
  const [posts, setPosts] = useState<LatestPost[]>([])
  const limit = settings?.limit || 6

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch(`/api/posts/latest?limit=${limit + 2}&locale=${locale}`)
        if (res.ok) {
          const data = await res.json()
          setPosts(data.posts || [])
        }
      } catch (error) {
        console.error('LatestPosts 데이터 조회 에러:', error)
      }
    }
    fetchPosts()
  }, [limit, locale])

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return t('justNow')
    if (diffMins < 60) return t('minutesAgo', { minutes: diffMins })
    if (diffHours < 24) return t('hoursAgo', { hours: diffHours })
    if (diffDays < 7) return t('daysAgo', { days: diffDays })
    return date.toLocaleDateString()
  }

  return (
    <Card className="h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          {t('widgets.latestPosts')}
        </h2>
        <Link href="/posts/latest" className="text-sm text-primary hover:underline flex items-center gap-1">
          {t('widgets.more')} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <CardContent className="p-0">
        {posts.length > 0 ? (
          <div className="divide-y">
            {posts.slice(0, limit).map((post) => (
              <Link
                key={post.id}
                href={`/boards/${post.board.slug}/${post.id}`}
                className="block px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {post.board.name}
                      </Badge>
                      <span className="font-medium text-sm truncate">
                        {post.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{post.author.nickname}</span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {post.viewCount}
                      </span>
                      {post.commentCount !== undefined && post.commentCount > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {post.commentCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTimeAgo(post.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            {t('widgets.noPosts')}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
