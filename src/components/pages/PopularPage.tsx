"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Eye, MessageSquare, ThumbsUp, Flame, Clock, Calendar, CalendarDays, LayoutList } from "lucide-react"
import Link from "next/link"

interface Post {
  id: number
  title: string
  content: string
  createdAt: string
  viewCount: number
  likeCount: number
  commentCount: number
  author: {
    nickname: string | null
  }
  board: {
    slug: string
    name: string
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

type Period = 'day' | 'week' | 'month' | 'all'

export default function PopularPage() {
  const t = useTranslations('lists')
  const tc = useTranslations('common')
  const periodOptions: { value: Period; label: string; icon: React.ReactNode }[] = [
    { value: 'day', label: t('periodDay'), icon: <Clock className="h-4 w-4" /> },
    { value: 'week', label: t('periodWeek'), icon: <Calendar className="h-4 w-4" /> },
    { value: 'month', label: t('periodMonth'), icon: <CalendarDays className="h-4 w-4" /> },
    { value: 'all', label: t('periodAll'), icon: <LayoutList className="h-4 w-4" /> },
  ]
  const router = useRouter()
  const searchParams = useSearchParams()

  const periodParam = searchParams.get('period') as Period | null
  const pageParam = searchParams.get('page')

  const [posts, setPosts] = useState<Post[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<Period>(periodParam || 'week')
  const [currentPage, setCurrentPage] = useState(pageParam ? parseInt(pageParam) : 1)

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/posts/popular?period=${period}&page=${currentPage}&limit=20`)
        if (res.ok) {
          const data = await res.json()
          setPosts(data.posts || [])
          setPagination(data.pagination)
        }
      } catch (error) {
        console.error('인기글 조회 에러:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPosts()
  }, [period, currentPage])

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod)
    setCurrentPage(1)
    const params = new URLSearchParams()
    if (newPeriod !== 'week') {
      params.set('period', newPeriod)
    }
    router.replace(`/posts/popular${params.toString() ? `?${params}` : ''}`)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    const params = new URLSearchParams(searchParams.toString())
    if (newPage > 1) {
      params.set('page', String(newPage))
    } else {
      params.delete('page')
    }
    router.replace(`/posts/popular${params.toString() ? `?${params}` : ''}`)
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return t('justNow')
    if (diffMins < 60) return t('minutesAgo', { mins: diffMins })
    if (diffHours < 24) return t('hoursAgo', { hours: diffHours })
    if (diffDays < 7) return t('daysAgo', { days: diffDays })
    return date.toLocaleDateString()
  }

  const getContentPreview = (content: string) => {
    // HTML 태그 제거
    const text = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
    return text.length > 100 ? text.substring(0, 100) + '...' : text
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Flame className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">{t('popularPosts')}</h1>
        </div>
        <p className="text-muted-foreground">
          {t('popularPostsDescription')}
        </p>
      </div>

      {/* 기간 필터 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {periodOptions.map((option) => (
          <Button
            key={option.value}
            variant={period === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => handlePeriodChange(option.value)}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            {option.icon}
            {option.label}
          </Button>
        ))}
      </div>

      {/* 게시글 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-3">
          {posts.map((post, index) => (
            <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* 순위 */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                      index === 0 ? 'bg-yellow-500 text-yellow-950' :
                      index === 1 ? 'bg-gray-400 text-gray-900' :
                      index === 2 ? 'bg-amber-600 text-amber-100' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {(currentPage - 1) * 20 + index + 1}
                    </div>

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {post.board.name}
                        </Badge>
                        <h3 className="font-semibold text-base truncate">
                          {post.title}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                        {getContentPreview(post.content)}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{post.author.nickname || tc('anonymous')}</span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {post.likeCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {post.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {post.commentCount}
                        </span>
                        <span>{formatTimeAgo(post.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('noPopularPosts')}
          </CardContent>
        </Card>
      )}

      {/* 페이지네이션 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            {t('prev')}
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number
              if (pagination.totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  className="w-9"
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === pagination.totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  )
}
