"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
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
import { Header, Footer } from "@/components/layout"
import {
  Search, Loader2, FileText, Eye, MessageSquare, ThumbsUp,
  ChevronLeft, ChevronRight, Clock, TrendingUp, Sparkles,
  BookOpen, ScrollText, LayoutGrid
} from "lucide-react"
import Link from "next/link"

interface PostResult {
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

interface ContentResult {
  id: number
  slug: string
  title: string
  excerpt: string
  updatedAt: string
}

interface PolicyResult {
  id: number
  slug: string
  version: string
  title: string
  excerpt: string
  updatedAt: string
}

interface BoardOption {
  slug: string
  name: string
}

interface SearchResponse {
  success: boolean
  query: string
  type: string
  results: {
    posts: { items: PostResult[]; total: number }
    contents: { items: ContentResult[]; total: number }
    policies: { items: PolicyResult[]; total: number }
  }
  counts: {
    all: number
    posts: number
    contents: number
    policies: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  boards: BoardOption[]
}

type SearchType = 'all' | 'posts' | 'contents' | 'policies'

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [data, setData] = useState<SearchResponse | null>(null)

  const [selectedType, setSelectedType] = useState<SearchType>(
    (searchParams.get('type') as SearchType) || 'all'
  )
  const [selectedBoard, setSelectedBoard] = useState(searchParams.get('board') || 'all')
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance')

  const performSearch = useCallback(async (
    searchQuery: string,
    type: SearchType = 'all',
    page: number = 1,
    board: string = 'all',
    sort: string = 'relevance'
  ) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return

    setLoading(true)
    setSearched(true)

    try {
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        type,
        page: page.toString(),
        sort
      })

      if (board !== 'all') params.set('board', board)

      const response = await fetch(`/api/search?${params}`)
      const result: SearchResponse = await response.json()

      if (result.success) {
        setData(result)
      } else {
        setData(null)
      }
    } catch (error) {
      console.error('검색 에러:', error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    const type = (searchParams.get('type') as SearchType) || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const board = searchParams.get('board') || 'all'
    const sort = searchParams.get('sort') || 'relevance'

    if (q) {
      setQuery(q)
      setSelectedType(type)
      setSelectedBoard(board)
      setSortBy(sort)
      performSearch(q, type, page, board, sort)
    }
  }, [searchParams, performSearch])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim().length < 2) {
      alert('검색어는 2자 이상 입력해주세요.')
      return
    }

    const params = new URLSearchParams({
      q: query.trim(),
      type: selectedType,
      sort: sortBy
    })
    if (selectedBoard !== 'all') params.set('board', selectedBoard)

    router.push(`/search?${params}`)
  }

  const handleTypeChange = (type: SearchType) => {
    setSelectedType(type)
    const searchedQuery = data?.query || query.trim()
    const params = new URLSearchParams({
      q: searchedQuery,
      type,
      sort: sortBy
    })
    if (selectedBoard !== 'all' && type === 'posts') params.set('board', selectedBoard)
    router.push(`/search?${params}`)
  }

  const handleFilterChange = (board: string, sort: string) => {
    const searchedQuery = data?.query || query.trim()
    const params = new URLSearchParams({
      q: searchedQuery,
      type: selectedType,
      sort
    })
    if (board !== 'all') params.set('board', board)
    router.push(`/search?${params}`)
  }

  const handlePageChange = (newPage: number) => {
    const searchedQuery = data?.query || query.trim()
    const params = new URLSearchParams({
      q: searchedQuery,
      type: selectedType,
      page: newPage.toString(),
      sort: sortBy
    })
    if (selectedBoard !== 'all') params.set('board', selectedBoard)
    router.push(`/search?${params}`)
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

  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text
    const regex = new RegExp(`(${searchQuery.split(/\s+/).join('|')})`, 'gi')
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>')
  }

  const tabs = [
    { key: 'all' as SearchType, label: '전체', icon: LayoutGrid, count: data?.counts.all || 0 },
    { key: 'posts' as SearchType, label: '게시글', icon: FileText, count: data?.counts.posts || 0 },
    { key: 'contents' as SearchType, label: '콘텐츠', icon: BookOpen, count: data?.counts.contents || 0 },
    { key: 'policies' as SearchType, label: '정책/약관', icon: ScrollText, count: data?.counts.policies || 0 },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* 검색 헤더 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Search className="h-6 w-6" />
              통합 검색
            </h1>

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
            </form>
          </div>

          {/* 탭 네비게이션 */}
          {searched && data && (
            <div className="mb-4">
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleTypeChange(tab.key)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${selectedType === tab.key
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {tab.count.toLocaleString()}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 게시글 필터 */}
          {searched && data && selectedType === 'posts' && (
            <div className="flex flex-wrap gap-3 mb-4">
              <Select
                value={selectedBoard}
                onValueChange={(value) => {
                  setSelectedBoard(value)
                  handleFilterChange(value, sortBy)
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="게시판 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 게시판</SelectItem>
                  {data.boards.map((board) => (
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
                  handleFilterChange(selectedBoard, value)
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
          )}

          {/* 검색 결과 */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : searched && data ? (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">&quot;{data.query}&quot;</span>
                {' '}검색 결과 총 <span className="font-semibold text-primary">{data.counts.all.toLocaleString()}</span>건
              </div>

              {/* 전체 탭 */}
              {selectedType === 'all' && (
                <div className="space-y-6">
                  {/* 게시글 섹션 */}
                  {data.results.posts.total > 0 && (
                    <Card>
                      <div className="border-b px-4 py-3 flex items-center justify-between">
                        <h2 className="font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          게시글
                          <Badge variant="secondary">{data.results.posts.total}</Badge>
                        </h2>
                        {data.results.posts.total > 5 && (
                          <button onClick={() => handleTypeChange('posts')} className="text-sm text-primary hover:underline">
                            더보기 →
                          </button>
                        )}
                      </div>
                      <CardContent className="p-0 divide-y">
                        {data.results.posts.items.slice(0, 5).map((post) => (
                          <Link key={post.id} href={`/board/${post.board.slug}/${post.id}`} className="block px-4 py-3 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs shrink-0">{post.board.name}</Badge>
                              <h3 className="font-medium truncate text-sm" dangerouslySetInnerHTML={{ __html: highlightText(post.title, data.query) }} />
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1" dangerouslySetInnerHTML={{ __html: highlightText(post.excerpt, data.query) }} />
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span>{post.author.nickname || post.author.name}</span>
                              <span>{formatTimeAgo(post.createdAt)}</span>
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount}</span>
                            </div>
                          </Link>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* 콘텐츠 섹션 */}
                  {data.results.contents.total > 0 && (
                    <Card>
                      <div className="border-b px-4 py-3 flex items-center justify-between">
                        <h2 className="font-semibold flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-green-600" />
                          콘텐츠
                          <Badge variant="secondary">{data.results.contents.total}</Badge>
                        </h2>
                        {data.results.contents.total > 5 && (
                          <button onClick={() => handleTypeChange('contents')} className="text-sm text-primary hover:underline">
                            더보기 →
                          </button>
                        )}
                      </div>
                      <CardContent className="p-0 divide-y">
                        {data.results.contents.items.slice(0, 5).map((content) => (
                          <Link key={content.id} href={`/content/${content.slug}`} className="block px-4 py-3 hover:bg-muted/50 transition-colors">
                            <h3 className="font-medium text-sm mb-1" dangerouslySetInnerHTML={{ __html: highlightText(content.title, data.query) }} />
                            <p className="text-xs text-muted-foreground line-clamp-1" dangerouslySetInnerHTML={{ __html: highlightText(content.excerpt, data.query) }} />
                          </Link>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* 정책 섹션 */}
                  {data.results.policies.total > 0 && (
                    <Card>
                      <div className="border-b px-4 py-3 flex items-center justify-between">
                        <h2 className="font-semibold flex items-center gap-2">
                          <ScrollText className="h-4 w-4 text-purple-600" />
                          정책/약관
                          <Badge variant="secondary">{data.results.policies.total}</Badge>
                        </h2>
                        {data.results.policies.total > 5 && (
                          <button onClick={() => handleTypeChange('policies')} className="text-sm text-primary hover:underline">
                            더보기 →
                          </button>
                        )}
                      </div>
                      <CardContent className="p-0 divide-y">
                        {data.results.policies.items.slice(0, 5).map((policy) => (
                          <Link key={policy.id} href={`/policy/${policy.slug}`} className="block px-4 py-3 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-sm" dangerouslySetInnerHTML={{ __html: highlightText(policy.title, data.query) }} />
                              <Badge variant="outline" className="text-xs">v{policy.version}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1" dangerouslySetInnerHTML={{ __html: highlightText(policy.excerpt, data.query) }} />
                          </Link>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {data.counts.all === 0 && (
                    <Card>
                      <CardContent className="py-16 text-center">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">검색 결과가 없습니다</h3>
                        <p className="text-muted-foreground mb-4">다른 검색어를 시도해 보세요.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* 게시글 탭 */}
              {selectedType === 'posts' && (
                <>
                  {data.results.posts.items.length > 0 ? (
                    <>
                      <Card>
                        <CardContent className="p-0 divide-y">
                          {data.results.posts.items.map((post) => (
                            <Link key={post.id} href={`/board/${post.board.slug}/${post.id}`} className="block px-4 py-4 hover:bg-muted/50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs shrink-0">{post.board.name}</Badge>
                                    <h3 className="font-medium truncate" dangerouslySetInnerHTML={{ __html: highlightText(post.title, data.query) }} />
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: highlightText(post.excerpt, data.query) }} />
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>{post.author.nickname || post.author.name}</span>
                                    <span>{formatTimeAgo(post.createdAt)}</span>
                                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount}</span>
                                    <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{post.likeCount}</span>
                                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{post.commentCount}</span>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </CardContent>
                      </Card>

                      {data.pagination.totalPages > 1 && (
                        <Pagination pagination={data.pagination} onPageChange={handlePageChange} />
                      )}
                    </>
                  ) : (
                    <EmptyResult icon={FileText} message="게시글 검색 결과가 없습니다" />
                  )}
                </>
              )}

              {/* 콘텐츠 탭 */}
              {selectedType === 'contents' && (
                <>
                  {data.results.contents.items.length > 0 ? (
                    <>
                      <Card>
                        <CardContent className="p-0 divide-y">
                          {data.results.contents.items.map((content) => (
                            <Link key={content.id} href={`/content/${content.slug}`} className="block px-4 py-4 hover:bg-muted/50 transition-colors">
                              <h3 className="font-medium mb-1" dangerouslySetInnerHTML={{ __html: highlightText(content.title, data.query) }} />
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: highlightText(content.excerpt, data.query) }} />
                              <div className="text-xs text-muted-foreground">마지막 수정: {formatTimeAgo(content.updatedAt)}</div>
                            </Link>
                          ))}
                        </CardContent>
                      </Card>

                      {data.pagination.totalPages > 1 && (
                        <Pagination pagination={data.pagination} onPageChange={handlePageChange} />
                      )}
                    </>
                  ) : (
                    <EmptyResult icon={BookOpen} message="콘텐츠 검색 결과가 없습니다" />
                  )}
                </>
              )}

              {/* 정책 탭 */}
              {selectedType === 'policies' && (
                <>
                  {data.results.policies.items.length > 0 ? (
                    <>
                      <Card>
                        <CardContent className="p-0 divide-y">
                          {data.results.policies.items.map((policy) => (
                            <Link key={policy.id} href={`/policy/${policy.slug}`} className="block px-4 py-4 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium" dangerouslySetInnerHTML={{ __html: highlightText(policy.title, data.query) }} />
                                <Badge variant="outline" className="text-xs">v{policy.version}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: highlightText(policy.excerpt, data.query) }} />
                              <div className="text-xs text-muted-foreground">마지막 수정: {formatTimeAgo(policy.updatedAt)}</div>
                            </Link>
                          ))}
                        </CardContent>
                      </Card>

                      {data.pagination.totalPages > 1 && (
                        <Pagination pagination={data.pagination} onPageChange={handlePageChange} />
                      )}
                    </>
                  ) : (
                    <EmptyResult icon={ScrollText} message="정책/약관 검색 결과가 없습니다" />
                  )}
                </>
              )}
            </>
          ) : (
            <Card className="bg-muted/30">
              <CardContent className="py-16 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">검색어를 입력하세요</h3>
                <p className="text-muted-foreground">게시글, 콘텐츠, 정책/약관에서 통합 검색합니다.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

// 페이지네이션 컴포넌트
function Pagination({ pagination, onPageChange }: {
  pagination: { page: number; totalPages: number }
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex justify-center items-center gap-2 mt-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(pagination.page - 1)}
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
        onClick={() => onPageChange(pagination.page + 1)}
        disabled={pagination.page === pagination.totalPages}
      >
        다음
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// 빈 결과 컴포넌트
function EmptyResult({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <Icon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{message}</h3>
      </CardContent>
    </Card>
  )
}
