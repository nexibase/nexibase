"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Star,
  Send,
  Trash2,
  RotateCcw,
  ExternalLink,
  X,
} from "lucide-react"

interface Review {
  id: number
  rating: number
  content: string
  images: string[]
  reply: string | null
  repliedAt: string | null
  isActive: boolean
  createdAt: string
  product: { id: number; name: string; slug: string }
  user: { id: number; nickname: string; email: string }
}

interface Stats {
  all: number
  noReply: number
  replied: number
  deleted: number
}

export default function AdminReviewsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const rating = searchParams.get('rating') || ''
  const search = searchParams.get('search') || ''
  const showDeleted = searchParams.get('deleted') === 'true'
  const [searchInput, setSearchInput] = useState(search)

  // 답변 모달
  const [replyModal, setReplyModal] = useState<Review | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 이미지 모달
  const [imageModal, setImageModal] = useState<string[] | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // 이미지 모달 키보드 이벤트
  useEffect(() => {
    if (!imageModal) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImageModal(null)
      } else if (e.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) => (prev === 0 ? imageModal.length - 1 : prev - 1))
      } else if (e.key === 'ArrowRight') {
        setCurrentImageIndex((prev) => (prev === imageModal.length - 1 ? 0 : prev + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [imageModal])

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '20')
      if (rating) params.set('rating', rating)
      if (search) params.set('search', search)
      if (showDeleted) params.set('deleted', 'true')

      const res = await fetch(`/api/admin/shop/reviews?${params}`)
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews)
        setStats(data.stats)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error('리뷰 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [page, rating, search, showDeleted])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (rating) params.set('rating', rating)
    if (searchInput) params.set('search', searchInput)
    if (showDeleted) params.set('deleted', 'true')
    router.push(`/admin/shop/reviews?${params}`)
  }

  const handleRatingFilter = (newRating: string) => {
    const params = new URLSearchParams()
    if (newRating) params.set('rating', newRating)
    if (search) params.set('search', search)
    if (showDeleted) params.set('deleted', 'true')
    router.push(`/admin/shop/reviews?${params}`)
  }

  const toggleDeleted = () => {
    const params = new URLSearchParams()
    if (rating) params.set('rating', rating)
    if (search) params.set('search', search)
    if (!showDeleted) params.set('deleted', 'true')
    router.push(`/admin/shop/reviews?${params}`)
  }

  const openReplyModal = (review: Review) => {
    setReplyModal(review)
    setReplyText(review.reply || '')
  }

  const submitReply = async () => {
    if (!replyModal) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/shop/reviews/${replyModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText.trim() })
      })
      if (res.ok) {
        setReplyModal(null)
        setReplyText('')
        fetchReviews()
      } else {
        const data = await res.json()
        alert(data.error || '답변 등록에 실패했습니다.')
      }
    } catch {
      alert('답변 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteReview = async (id: number, restore: boolean = false) => {
    const message = restore ? '이 리뷰를 복구하시겠습니까?' : '이 리뷰를 삭제하시겠습니까?'
    if (!confirm(message)) return
    try {
      const url = restore
        ? `/api/admin/shop/reviews/${id}?restore=true`
        : `/api/admin/shop/reviews/${id}`
      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        fetchReviews()
      }
    } catch {
      alert('처리에 실패했습니다.')
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* 헤더 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-6 w-6" />
              리뷰 관리
            </h1>
            <p className="text-muted-foreground mt-1">
              상품 리뷰를 관리하고 답변하세요
            </p>
          </div>

          {/* 통계 카드 */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card
                className={`cursor-pointer transition-colors ${!rating && !showDeleted ? 'ring-2 ring-primary' : ''}`}
                onClick={() => {
                  const params = new URLSearchParams()
                  if (search) params.set('search', search)
                  router.push(`/admin/shop/reviews?${params}`)
                }}
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.all}</div>
                  <div className="text-sm text-muted-foreground">전체</div>
                </CardContent>
              </Card>
              <Card className="cursor-default">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">{stats.noReply}</div>
                  <div className="text-sm text-muted-foreground">미답변</div>
                </CardContent>
              </Card>
              <Card className="cursor-default">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{stats.replied}</div>
                  <div className="text-sm text-muted-foreground">답변완료</div>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-colors ${showDeleted ? 'ring-2 ring-primary' : ''}`}
                onClick={toggleDeleted}
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-600">{stats.deleted}</div>
                  <div className="text-sm text-muted-foreground">삭제됨</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 필터 및 검색 */}
          <div className="flex flex-wrap gap-2 mb-6">
            {/* 별점 필터 */}
            <div className="flex gap-1">
              {[5, 4, 3, 2, 1].map(star => (
                <Button
                  key={star}
                  variant={rating === String(star) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleRatingFilter(rating === String(star) ? '' : String(star))}
                >
                  {star}점
                </Button>
              ))}
            </div>

            {/* 검색 */}
            <div className="flex gap-2 flex-1 max-w-md ml-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="상품명, 내용, 작성자 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch}>검색</Button>
            </div>
          </div>

          {/* 리뷰 목록 */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map(review => (
                <Card key={review.id} className={!review.isActive ? 'opacity-60 border-red-300' : ''}>
                  <CardContent className="p-4">
                    {/* 상단 정보 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/shop/products/${review.product.slug}?tab=review`}
                          target="_blank"
                          className="text-sm font-medium hover:underline flex items-center gap-1"
                        >
                          {review.product.name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        {renderStars(review.rating)}
                        {!review.isActive && (
                          <Badge variant="destructive" className="text-xs">삭제됨</Badge>
                        )}
                        {review.reply ? (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                            답변완료
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                            미답변
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {!review.isActive ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-green-600"
                            onClick={() => deleteReview(review.id, true)}
                            title="복구"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            onClick={() => deleteReview(review.id)}
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 작성자 정보 */}
                    <div className="text-xs text-muted-foreground mb-2">
                      {review.user.nickname} ({review.user.email}) · {new Date(review.createdAt).toLocaleString('ko-KR')}
                    </div>

                    {/* 리뷰 내용 */}
                    <div className="mb-3">
                      <p className="text-sm whitespace-pre-wrap">{review.content}</p>
                    </div>

                    {/* 리뷰 이미지 */}
                    {review.images.length > 0 && (
                      <div className="flex gap-2 mb-3">
                        {review.images.map((img, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setImageModal(review.images)
                              setCurrentImageIndex(idx)
                            }}
                            className="w-16 h-16 rounded border overflow-hidden hover:ring-2 ring-primary"
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 답변 */}
                    {review.reply && (
                      <div className="p-3 bg-muted rounded-lg mb-3">
                        <div className="text-xs text-muted-foreground mb-1">
                          관리자 답변 · {review.repliedAt && new Date(review.repliedAt).toLocaleString('ko-KR')}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{review.reply}</p>
                      </div>
                    )}

                    {/* 답변 버튼 */}
                    {review.isActive && (
                      <Button
                        variant={review.reply ? "outline" : "default"}
                        size="sm"
                        onClick={() => openReplyModal(review)}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        {review.reply ? '답변 수정' : '답변하기'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-4">
                    {page} / {totalPages} ({total}개)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              리뷰가 없습니다.
            </div>
          )}
        </div>
      </main>

      {/* 답변 모달 */}
      {replyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setReplyModal(null)}
          />
          <div className="relative bg-background rounded-lg shadow-lg max-w-lg w-full mx-4 p-6">
            <button
              onClick={() => setReplyModal(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold mb-4">리뷰 답변</h3>

            {/* 리뷰 표시 */}
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">{replyModal.product.name}</span>
                {renderStars(replyModal.rating)}
              </div>
              <p className="text-sm whitespace-pre-wrap">{replyModal.content}</p>
            </div>

            {/* 답변 입력 */}
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="답변을 입력하세요 (비워두면 답변 삭제)"
              rows={5}
              className="mb-4"
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReplyModal(null)}>
                취소
              </Button>
              <Button onClick={submitReply} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {replyModal.reply ? '수정' : '등록'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 모달 */}
      {imageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setImageModal(null)}
          />
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setImageModal(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>

            {/* 이전 버튼 */}
            {imageModal.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentImageIndex((prev) => (prev === 0 ? imageModal.length - 1 : prev - 1))
                }}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 w-10 h-10 flex items-center justify-center text-white hover:text-gray-300 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <img
              src={imageModal[currentImageIndex]}
              alt=""
              className="max-w-full max-h-[80vh] object-contain"
            />

            {/* 다음 버튼 */}
            {imageModal.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentImageIndex((prev) => (prev === imageModal.length - 1 ? 0 : prev + 1))
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 w-10 h-10 flex items-center justify-center text-white hover:text-gray-300 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* 인디케이터 및 카운터 */}
            {imageModal.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                  {currentImageIndex + 1} / {imageModal.length}
                </span>
                <div className="flex gap-2">
                  {imageModal.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrentImageIndex(idx)
                      }}
                      className={`w-3 h-3 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/70'}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
