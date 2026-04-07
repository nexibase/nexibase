"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Eye, MessageSquare, ThumbsUp, Clock } from "lucide-react"
import Link from "next/link"

interface Post {
  id: number
  title: string
  content?: string
  createdAt: string
  viewCount: number
  likeCount?: number
  commentCount?: number
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

export default function LatestPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const pageParam = searchParams.get('page')

  const [posts, setPosts] = useState<Post[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(pageParam ? parseInt(pageParam) : 1)

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/posts/latest?page=${currentPage}&limit=20`)
        if (res.ok) {
          const data = await res.json()
          setPosts(data.posts || [])
          setPagination(data.pagination)
        }
      } catch (error) {
        console.error('최신글 조회 에러:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPosts()
  }, [currentPage])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    const params = new URLSearchParams(searchParams.toString())
    if (newPage > 1) {
      params.set('page', String(newPage))
    } else {
      params.delete('page')
    }
    router.replace(`/latest${params.toString() ? `?${params}` : ''}`)
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString('ko-KR')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">최근 게시글</h1>
        </div>
        <p className="text-muted-foreground">
          방금 올라온 새로운 게시글을 확인하세요
        </p>
      </div>

      {/* 게시글 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
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
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        <span>{post.author.nickname || '익명'}</span>
                        {post.likeCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            {post.likeCount}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {post.viewCount}
                        </span>
                        {post.commentCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {post.commentCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 시간 */}
                    <div className="flex-shrink-0 text-xs text-muted-foreground">
                      {formatTimeAgo(post.createdAt)}
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
            아직 게시글이 없습니다.
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
            이전
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
            다음
          </Button>
        </div>
      )}
    </div>
  )
}
