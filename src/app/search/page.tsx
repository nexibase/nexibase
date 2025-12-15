"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Header, Footer } from "@/themes"
import {
  Search, Loader2, FileText, Eye, MessageSquare, ThumbsUp,
  ChevronLeft, ChevronRight, Clock, TrendingUp, Sparkles
} from "lucide-react"
import Link from "next/link"

interface SearchResult {
  id: number
  title: string
  excerpt: string
  viewCount: number
  likeCount: number
  commentCount: number
  createdAt: string
  author: {
    id: number
    nickname: string | null
    name: string | null
  }
  board: {
    id: number
    slug: string
    name: string
  }
}

interface BoardOption {
  slug: string
  name: string
}

interface SearchResponse {
  success: boolean
  query: string
  posts: SearchResult[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  boards: BoardOption[]
  searchMode?: string
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [boards, setBoards] = useState<BoardOption[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // 필터 상태
  const [selectedBoard, setSelectedBoard] = useState(searchParams.get('board') || 'all')
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance')

  // 검색 실행
  const performSearch = useCallback(async (
    searchQuery: string,
    page: number = 1,
    board: string = 'all',
    sort: string = 'relevance'
  ) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      return
    }

    setLoading(true)
    setSearched(true)

    try {
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        page: page.toString(),
        sort
      })

      if (board !== 'all') {
        params.set('board', board)
      }

      const response = await fetch(`/api/search?${params}`)
      const data: SearchResponse = await response.json()

      if (data.success) {
        setResults(data.posts)
        setPagination(data.pagination)
        setBoards(data.boards)
      } else {
        setResults([])
        setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 })
      }
    } catch (error) {
      console.error('검색 에러:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // URL 파라미터 변경 시 검색
  useEffect(() => {
    const q = searchParams.get('q')
    const page = parseInt(searchParams.get('page') || '1')
    const board = searchParams.get('board') || 'all'
    const sort = searchParams.get('sort') || 'relevance'

    if (q) {
      setQuery(q)
      setSelectedBoard(board)
      setSortBy(sort)
      performSearch(q, page, board, sort)
    }
  }, [searchParams, performSearch])

  // 검색 폼 제출
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim().length < 2) {
      alert('검색어는 2자 이상 입력해주세요.')
      return
    }

    const params = new URLSearchParams({
      q: query.trim(),
      sort: sortBy
    })
    if (selectedBoard !== 'all') {
      params.set('board', selectedBoard)
    }

    router.push(`/search?${params}`)
  }

  // 필터 변경
  const handleFilterChange = (board: string, sort: string) => {
    const params = new URLSearchParams({
      q: query.trim(),
      sort
    })
    if (board !== 'all') {
      params.set('board', board)
    }
    router.push(`/search?${params}`)
  }

  // 페이지 변경
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams({
      q: query.trim(),
      page: newPage.toString(),
      sort: sortBy
    })
    if (selectedBoard !== 'all') {
      params.set('board', selectedBoard)
    }
    router.push(`/search?${params}`)
  }

  // 시간 포맷팅
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

  // 검색어 하이라이팅
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query.split(/\s+/).join('|')})`, 'gi')
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* 검색 헤더 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Search className="h-6 w-6" />
              검색
            </h1>

            {/* 검색 폼 */}
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="검색어를 입력하세요 (2자 이상)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 h-12 text-lg"
                    autoFocus
                  />
                </div>
                <Button type="submit" size="lg" className="h-12 px-8">
                  검색
                </Button>
              </div>

              {/* 필터 */}
              <div className="flex flex-wrap gap-3">
                <Select
                  value={selectedBoard}
                  onValueChange={(value) => {
                    setSelectedBoard(value)
                    if (searched) handleFilterChange(value, sortBy)
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="게시판 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 게시판</SelectItem>
                    {boards.map((board) => (
                      <SelectItem key={board.slug} value={board.slug}>
                        {board.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={sortBy}
                  onValueChange={(value) => {
                    setSortBy(value)
                    if (searched) handleFilterChange(selectedBoard, value)
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="정렬" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        정확도순
                      </span>
                    </SelectItem>
                    <SelectItem value="latest">
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        최신순
                      </span>
                    </SelectItem>
                    <SelectItem value="popular">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        인기순
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </form>
          </div>

          {/* 검색 결과 */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : searched ? (
            <>
              {/* 결과 요약 */}
              <div className="mb-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">&quot;{searchParams.get('q')}&quot;</span>
                {' '}검색 결과 총 <span className="font-semibold text-primary">{pagination.total.toLocaleString()}</span>건
              </div>

              {results.length > 0 ? (
                <>
                  {/* 결과 목록 */}
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {results.map((result) => (
                        <Link
                          key={result.id}
                          href={`/board/${result.board.slug}/${result.id}`}
                          className="block px-4 py-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {result.board.name}
                                </Badge>
                                <h3
                                  className="font-medium truncate"
                                  dangerouslySetInnerHTML={{
                                    __html: highlightText(result.title, searchParams.get('q') || '')
                                  }}
                                />
                              </div>
                              <p
                                className="text-sm text-muted-foreground line-clamp-2 mb-2"
                                dangerouslySetInnerHTML={{
                                  __html: highlightText(result.excerpt, searchParams.get('q') || '')
                                }}
                              />
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{result.author.nickname || result.author.name}</span>
                                <span>{formatTimeAgo(result.createdAt)}</span>
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {result.viewCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <ThumbsUp className="h-3 w-3" />
                                  {result.likeCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {result.commentCount}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>

                  {/* 페이지네이션 */}
                  {pagination.totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        이전
                      </Button>
                      <span className="text-sm text-muted-foreground px-4">
                        {pagination.page} / {pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                      >
                        다음
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">검색 결과가 없습니다</h3>
                    <p className="text-muted-foreground mb-4">
                      다른 검색어를 시도해 보세요.
                    </p>
                    <ul className="text-sm text-muted-foreground text-left max-w-xs mx-auto space-y-1">
                      <li>• 검색어의 철자가 정확한지 확인하세요</li>
                      <li>• 더 일반적인 검색어를 사용해 보세요</li>
                      <li>• 게시판 필터를 &quot;전체 게시판&quot;으로 변경해 보세요</li>
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="bg-muted/30">
              <CardContent className="py-16 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">검색어를 입력하세요</h3>
                <p className="text-muted-foreground">
                  게시글의 제목과 내용에서 검색합니다.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
