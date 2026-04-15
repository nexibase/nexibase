"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
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
import {
  Search, Loader2, FileText, Eye, MessageSquare, ThumbsUp,
  ChevronLeft, ChevronRight, Clock, TrendingUp, Sparkles,
  BookOpen, ScrollText, LayoutGrid, ShoppingBag
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { escapeHtml } from "@/lib/sanitize"

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

interface ProductResult {
  id: number
  slug: string
  name: string
  description: string | null
  price: number
  originPrice: number | null
  thumbnail: string | null
  isSoldOut: boolean
  category: {
    id: number
    name: string
    slug: string
  } | null
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
    products: { items: ProductResult[]; total: number }
  }
  counts: {
    all: number
    posts: number
    contents: number
    policies: number
    products: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  boards: BoardOption[]
}

type SearchType = 'all' | 'posts' | 'contents' | 'policies' | 'products'

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}

function SearchContent() {
  const t = useTranslations('search')
  const tl = useTranslations('lists')
  const locale = useLocale()
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
      alert(t('minLengthAlert'))
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

    if (diffMins < 1) return tl('justNow')
    if (diffMins < 60) return tl('minutesAgo', { mins: diffMins })
    if (diffHours < 24) return tl('hoursAgo', { hours: diffHours })
    if (diffDays < 7) return tl('daysAgo', { days: diffDays })
    return date.toLocaleDateString(locale)
  }

  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return escapeHtml(text)
    const escapedText = escapeHtml(text)
    const escapedTerms = searchQuery.split(/\s+/).map(term =>
      escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi')
    return escapedText.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>')
  }

  const tabs = [
    { key: 'all' as SearchType, label: t('tabAll'), icon: LayoutGrid, count: data?.counts.all || 0 },
    { key: 'posts' as SearchType, label: t('tabPosts'), icon: FileText, count: data?.counts.posts || 0 },
    { key: 'products' as SearchType, label: t('tabProducts'), icon: ShoppingBag, count: data?.counts.products || 0 },
    { key: 'contents' as SearchType, label: t('tabContents'), icon: BookOpen, count: data?.counts.contents || 0 },
    { key: 'policies' as SearchType, label: t('tabPolicies'), icon: ScrollText, count: data?.counts.policies || 0 },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 검색 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Search className="h-6 w-6" />
          {t('unifiedSearch')}
        </h1>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder={t('placeholderMin')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 h-12 text-lg"
                autoFocus
              />
            </div>
            <Button type="submit" size="lg" className="h-12 px-8">
              {t('searchButton')}
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
              <SelectValue placeholder={t('boardSelectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allBoards')}</SelectItem>
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
              <SelectValue placeholder={t('sortPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {t('sortRelevance')}
                </span>
              </SelectItem>
              <SelectItem value="latest">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('sortLatest')}
                </span>
              </SelectItem>
              <SelectItem value="popular">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {t('sortPopular')}
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
            {' '}{t('resultSummary', { count: data.counts.all.toLocaleString() })}
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
                      {t('tabPosts')}
                      <Badge variant="secondary">{data.results.posts.total}</Badge>
                    </h2>
                    {data.results.posts.total > 5 && (
                      <button onClick={() => handleTypeChange('posts')} className="text-sm text-primary hover:underline">
                        {t('viewMore')}
                      </button>
                    )}
                  </div>
                  <CardContent className="p-0 divide-y">
                    {data.results.posts.items.slice(0, 5).map((post) => (
                      <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`} className="block px-4 py-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs shrink-0">{post.board.name}</Badge>
                          <h3 className="font-medium truncate text-sm" dangerouslySetInnerHTML={{ __html: highlightText(post.title, data.query) }} />
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1" dangerouslySetInnerHTML={{ __html: highlightText(post.excerpt, data.query) }} />
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>{post.author.nickname}</span>
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
                      {t('tabContents')}
                      <Badge variant="secondary">{data.results.contents.total}</Badge>
                    </h2>
                    {data.results.contents.total > 5 && (
                      <button onClick={() => handleTypeChange('contents')} className="text-sm text-primary hover:underline">
                        {t('viewMore')}
                      </button>
                    )}
                  </div>
                  <CardContent className="p-0 divide-y">
                    {data.results.contents.items.slice(0, 5).map((content) => (
                      <Link key={content.id} href={`/contents/${content.slug}`} className="block px-4 py-3 hover:bg-muted/50 transition-colors">
                        <h3 className="font-medium text-sm mb-1" dangerouslySetInnerHTML={{ __html: highlightText(content.title, data.query) }} />
                        <p className="text-xs text-muted-foreground line-clamp-1" dangerouslySetInnerHTML={{ __html: highlightText(content.excerpt, data.query) }} />
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 상품 섹션 */}
              {data.results.products.total > 0 && (
                <Card>
                  <div className="border-b px-4 py-3 flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-orange-600" />
                      {t('tabProducts')}
                      <Badge variant="secondary">{data.results.products.total}</Badge>
                    </h2>
                    {data.results.products.total > 5 && (
                      <button onClick={() => handleTypeChange('products')} className="text-sm text-primary hover:underline">
                        {t('viewMore')}
                      </button>
                    )}
                  </div>
                  <CardContent className="p-0 divide-y">
                    {data.results.products.items.slice(0, 5).map((product) => (
                      <Link key={product.id} href={`/shop/products/${product.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                        {product.thumbnail ? (
                          <div className="relative w-12 h-12 rounded overflow-hidden bg-muted shrink-0">
                            <Image
                              src={product.thumbnail}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {product.category && (
                              <Badge variant="outline" className="text-xs shrink-0">{product.category.name}</Badge>
                            )}
                            <h3 className="font-medium text-sm truncate" dangerouslySetInnerHTML={{ __html: highlightText(product.name, data.query) }} />
                            {product.isSoldOut && (
                              <Badge variant="destructive" className="text-xs shrink-0">{t('soldOut')}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold text-primary">{product.price.toLocaleString()}{t('won')}</span>
                            {product.originPrice && product.originPrice > product.price && (
                              <span className="text-muted-foreground line-through text-xs">{product.originPrice.toLocaleString()}{t('won')}</span>
                            )}
                          </div>
                        </div>
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
                      {t('tabPolicies')}
                      <Badge variant="secondary">{data.results.policies.total}</Badge>
                    </h2>
                    {data.results.policies.total > 5 && (
                      <button onClick={() => handleTypeChange('policies')} className="text-sm text-primary hover:underline">
                        {t('viewMore')}
                      </button>
                    )}
                  </div>
                  <CardContent className="p-0 divide-y">
                    {data.results.policies.items.slice(0, 5).map((policy) => (
                      <Link key={policy.id} href={`/policies/${policy.slug}`} className="block px-4 py-3 hover:bg-muted/50 transition-colors">
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
                    <h3 className="text-lg font-semibold mb-2">{t('noResults')}</h3>
                    <p className="text-muted-foreground mb-4">{t('noResultsDesc')}</p>
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
                        <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`} className="block px-4 py-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs shrink-0">{post.board.name}</Badge>
                                <h3 className="font-medium truncate" dangerouslySetInnerHTML={{ __html: highlightText(post.title, data.query) }} />
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: highlightText(post.excerpt, data.query) }} />
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{post.author.nickname}</span>
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
                    <PaginationNav pagination={data.pagination} onPageChange={handlePageChange} />
                  )}
                </>
              ) : (
                <EmptyResult icon={FileText} message={t('noPostsResults')} />
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
                        <Link key={content.id} href={`/contents/${content.slug}`} className="block px-4 py-4 hover:bg-muted/50 transition-colors">
                          <h3 className="font-medium mb-1" dangerouslySetInnerHTML={{ __html: highlightText(content.title, data.query) }} />
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: highlightText(content.excerpt, data.query) }} />
                          <div className="text-xs text-muted-foreground">{t('lastModified')}: {formatTimeAgo(content.updatedAt)}</div>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>

                  {data.pagination.totalPages > 1 && (
                    <PaginationNav pagination={data.pagination} onPageChange={handlePageChange} />
                  )}
                </>
              ) : (
                <EmptyResult icon={BookOpen} message={t('noContentsResults')} />
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
                        <Link key={policy.id} href={`/policies/${policy.slug}`} className="block px-4 py-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium" dangerouslySetInnerHTML={{ __html: highlightText(policy.title, data.query) }} />
                            <Badge variant="outline" className="text-xs">v{policy.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: highlightText(policy.excerpt, data.query) }} />
                          <div className="text-xs text-muted-foreground">{t('lastModified')}: {formatTimeAgo(policy.updatedAt)}</div>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>

                  {data.pagination.totalPages > 1 && (
                    <PaginationNav pagination={data.pagination} onPageChange={handlePageChange} />
                  )}
                </>
              ) : (
                <EmptyResult icon={ScrollText} message={t('noPoliciesResults')} />
              )}
            </>
          )}

          {/* 상품 탭 */}
          {selectedType === 'products' && (
            <>
              {data.results.products.items.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {data.results.products.items.map((product) => (
                      <Link key={product.id} href={`/shop/products/${product.slug}`} className="group">
                        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                          <div className="relative aspect-square bg-muted">
                            {product.thumbnail ? (
                              <Image
                                src={product.thumbnail}
                                alt={product.name}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <ShoppingBag className="h-12 w-12 text-muted-foreground" />
                              </div>
                            )}
                            {product.isSoldOut && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Badge variant="destructive">{t('soldOut')}</Badge>
                              </div>
                            )}
                          </div>
                          <CardContent className="p-3">
                            {product.category && (
                              <Badge variant="outline" className="text-xs mb-1">{product.category.name}</Badge>
                            )}
                            <h3 className="font-medium text-sm line-clamp-2 mb-1" dangerouslySetInnerHTML={{ __html: highlightText(product.name, data.query) }} />
                            {product.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mb-2" dangerouslySetInnerHTML={{ __html: highlightText(product.description, data.query) }} />
                            )}
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary">{product.price.toLocaleString()}{t('won')}</span>
                              {product.originPrice && product.originPrice > product.price && (
                                <span className="text-muted-foreground line-through text-xs">{product.originPrice.toLocaleString()}{t('won')}</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>

                  {data.pagination.totalPages > 1 && (
                    <PaginationNav pagination={data.pagination} onPageChange={handlePageChange} />
                  )}
                </>
              ) : (
                <EmptyResult icon={ShoppingBag} message={t('noProductsResults')} />
              )}
            </>
          )}
        </>
      ) : (
        <Card className="bg-muted/30">
          <CardContent className="py-16 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('enterQuery')}</h3>
            <p className="text-muted-foreground">{t('enterQueryDesc')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// 페이지네이션 컴포넌트
function PaginationNav({ pagination, onPageChange }: {
  pagination: { page: number; totalPages: number }
  onPageChange: (page: number) => void
}) {
  const t = useTranslations('search')
  return (
    <div className="flex justify-center items-center gap-2 mt-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(pagination.page - 1)}
        disabled={pagination.page === 1}
      >
        <ChevronLeft className="h-4 w-4" />
        {t('prev')}
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
        {t('next')}
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
