"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Star,
  X,
  Send,
  Pencil,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { getThumbnailUrl } from "./ProductImages"

export interface Review {
  id: number
  rating: number
  content: string
  images: string | null
  reply: string | null
  repliedAt: string | null
  createdAt: string
  user: { id: number; name: string; image: string | null }
  isOwner: boolean
}

export interface ReviewableOrder {
  orderId: number
  orderItemId: number
  productName: string
  optionText: string | null
  orderNo: string
}

export interface ReviewSectionProps {
  slug: string
  productId: number
  reviews: Review[]
  reviewsLoading: boolean
  reviewTotal: number
  avgRating: number
  reviewPage: number
  reviewableOrders: ReviewableOrder[]
  onFetchReviews: (page: number) => void
  onFetchReviewableOrders: () => void
}

export default function ReviewSection({
  slug,
  productId,
  reviews,
  reviewsLoading,
  reviewTotal,
  avgRating,
  reviewPage,
  reviewableOrders,
  onFetchReviews,
  onFetchReviewableOrders,
}: ReviewSectionProps) {
  // 리뷰 작성 상태
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [selectedOrderItem, setSelectedOrderItem] = useState<number | null>(
    reviewableOrders.length === 1 ? reviewableOrders[0].orderItemId : null
  )
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewContent, setReviewContent] = useState('')
  const [reviewImages, setReviewImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)

  // 이미지 뷰어 상태
  const [viewerImages, setViewerImages] = useState<string[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)
  const [showImageViewer, setShowImageViewer] = useState(false)

  // 리뷰 이미지 업로드
  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (reviewImages.length + files.length > 5) {
      alert('이미지는 최대 5장까지 첨부할 수 있습니다.')
      return
    }

    setUploadingImage(true)

    const successUrls: string[] = []
    const failedFiles: { name: string; size: string; reason: string }[] = []

    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes}B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
    }

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'reviews')
        formData.append('productId', String(productId))

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        const data = await res.json()

        if (!res.ok) {
          failedFiles.push({ name: file.name, size: formatFileSize(file.size), reason: data.error || '업로드 실패' })
        } else {
          successUrls.push(data.url)
        }
      } catch {
        failedFiles.push({ name: file.name, size: formatFileSize(file.size), reason: '네트워크 오류' })
      }
    }

    if (successUrls.length > 0) {
      setReviewImages(prev => [...prev, ...successUrls])
    }

    if (failedFiles.length > 0) {
      const failedMessage = failedFiles
        .map(f => `• ${f.name} (${f.size}): ${f.reason}`)
        .join('\n')
      alert(`일부 이미지 업로드 실패:\n${failedMessage}`)
    }

    setUploadingImage(false)
    e.target.value = ''
  }

  const removeReviewImage = (index: number) => {
    setReviewImages(prev => prev.filter((_, i) => i !== index))
  }

  // 리뷰 작성
  const submitReview = async () => {
    if (!selectedOrderItem || !reviewContent.trim()) return
    setSubmittingReview(true)
    try {
      const res = await fetch(`/api/shop/products/${slug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItemId: selectedOrderItem,
          rating: reviewRating,
          content: reviewContent.trim(),
          images: reviewImages.length > 0 ? reviewImages : null
        })
      })
      if (res.ok) {
        setShowReviewForm(false)
        setSelectedOrderItem(reviewableOrders.length === 1 ? reviewableOrders[0]?.orderItemId : null)
        setReviewRating(5)
        setReviewContent('')
        setReviewImages([])
        onFetchReviews(1)
        onFetchReviewableOrders()
      } else {
        const data = await res.json()
        alert(data.error || '리뷰 작성에 실패했습니다.')
      }
    } catch {
      alert('리뷰 작성에 실패했습니다.')
    } finally {
      setSubmittingReview(false)
    }
  }

  // 리뷰 수정 시작
  const startEditReview = (review: Review) => {
    setEditingReview(review)
    setReviewRating(review.rating)
    setReviewContent(review.content)
    if (review.images) {
      try {
        const parsed = JSON.parse(review.images)
        setReviewImages(Array.isArray(parsed) ? parsed : [])
      } catch {
        setReviewImages([])
      }
    } else {
      setReviewImages([])
    }
    setShowReviewForm(false)
  }

  // 리뷰 수정 취소
  const cancelEditReview = () => {
    setEditingReview(null)
    setReviewRating(5)
    setReviewContent('')
    setReviewImages([])
  }

  // 리뷰 수정 제출
  const submitEditReview = async () => {
    if (!editingReview || !reviewContent.trim()) return
    setSubmittingReview(true)
    try {
      const res = await fetch(`/api/shop/products/${slug}/reviews`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId: editingReview.id,
          rating: reviewRating,
          content: reviewContent.trim(),
          images: reviewImages.length > 0 ? reviewImages : null
        })
      })
      if (res.ok) {
        setEditingReview(null)
        setReviewRating(5)
        setReviewContent('')
        setReviewImages([])
        onFetchReviews(reviewPage)
      } else {
        const data = await res.json()
        alert(data.error || '리뷰 수정에 실패했습니다.')
      }
    } catch {
      alert('리뷰 수정에 실패했습니다.')
    } finally {
      setSubmittingReview(false)
    }
  }

  // 리뷰 삭제
  const deleteReview = async (reviewId: number) => {
    if (!confirm('리뷰를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/shop/products/${slug}/reviews?reviewId=${reviewId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        onFetchReviews(reviewPage)
        onFetchReviewableOrders()
      } else {
        const data = await res.json()
        alert(data.error || '리뷰 삭제에 실패했습니다.')
      }
    } catch {
      alert('리뷰 삭제에 실패했습니다.')
    }
  }

  // 이미지 뷰어 열기
  const openImageViewer = (images: string[], startIndex: number) => {
    setViewerImages(images)
    setViewerIndex(startIndex)
    setShowImageViewer(true)
  }

  return (
    <>
      <div>
        {/* 평균 별점 */}
        {reviewTotal > 0 && (
          <div className="flex items-center gap-4 mb-6 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-3xl font-bold">{avgRating.toFixed(1)}</div>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i <= Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{reviewTotal}개 리뷰</p>
            </div>
          </div>
        )}

        {/* 리뷰 작성 버튼 */}
        {reviewableOrders.length > 0 && !showReviewForm && !editingReview && (
          <div className="mb-6">
            <Button onClick={() => setShowReviewForm(true)}>
              <Star className="h-4 w-4 mr-2" />
              리뷰 작성
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              작성 가능한 리뷰: {reviewableOrders.length}건
            </p>
          </div>
        )}

        {/* 리뷰 작성 폼 */}
        {showReviewForm && (
          <Card className="mb-6">
            <CardContent className="p-4 space-y-4">
              {/* 주문 선택 */}
              {reviewableOrders.length > 1 ? (
                <div>
                  <Label>주문 선택</Label>
                  <Select
                    value={selectedOrderItem?.toString() || ''}
                    onValueChange={(v) => setSelectedOrderItem(parseInt(v))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="리뷰를 작성할 주문을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {reviewableOrders.map(order => (
                        <SelectItem key={order.orderItemId} value={order.orderItemId.toString()}>
                          [{order.orderNo}] {order.optionText || '기본 옵션'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : reviewableOrders.length === 1 ? (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <span className="text-muted-foreground">주문번호:</span>{' '}
                  <span className="font-medium">{reviewableOrders[0].orderNo}</span>
                  {reviewableOrders[0].optionText && (
                    <>
                      <span className="mx-2 text-muted-foreground">|</span>
                      <span className="text-muted-foreground">옵션:</span>{' '}
                      <span className="font-medium">{reviewableOrders[0].optionText}</span>
                    </>
                  )}
                </div>
              ) : null}

              <div>
                <Label>별점</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReviewRating(i)}
                      className="p-1"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${
                          i <= reviewRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground hover:text-yellow-400'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>리뷰 내용</Label>
                <Textarea
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="상품에 대한 솔직한 리뷰를 작성해주세요."
                  className="mt-1"
                  rows={4}
                />
              </div>

              {/* 이미지 업로드 */}
              <div>
                <Label>사진 첨부 (최대 5장)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {reviewImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20">
                      <img src={img} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => removeReviewImage(idx)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {reviewImages.length < 5 && (
                    <label className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors">
                      {uploadingImage ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <ImagePlus className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">추가</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleReviewImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowReviewForm(false); setReviewImages([]) }}>
                  취소
                </Button>
                <Button
                  onClick={submitReview}
                  disabled={submittingReview || uploadingImage || !selectedOrderItem || !reviewContent.trim()}
                >
                  {submittingReview ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  등록
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 리뷰 수정 폼 */}
        {editingReview && (
          <Card className="mb-6">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">리뷰 수정</h4>
              </div>

              <div>
                <Label>별점</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReviewRating(i)}
                      className="p-1"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${
                          i <= reviewRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground hover:text-yellow-400'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>리뷰 내용</Label>
                <Textarea
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="상품에 대한 솔직한 리뷰를 작성해주세요."
                  className="mt-1"
                  rows={4}
                />
              </div>

              {/* 이미지 업로드 */}
              <div>
                <Label>사진 첨부 (최대 5장)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {reviewImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20">
                      <img src={img} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => removeReviewImage(idx)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {reviewImages.length < 5 && (
                    <label className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors">
                      {uploadingImage ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <ImagePlus className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">추가</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleReviewImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={cancelEditReview}>
                  취소
                </Button>
                <Button
                  onClick={submitEditReview}
                  disabled={submittingReview || uploadingImage || !reviewContent.trim()}
                >
                  {submittingReview ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />}
                  수정
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 리뷰 목록 */}
        {reviewsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{review.user.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{review.user.name}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      {review.isOwner && !editingReview && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditReview(review)}
                            className="h-7 px-2 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            수정
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteReview(review.id)}
                            className="h-7 px-2 text-muted-foreground hover:text-red-500"
                          >
                            <X className="h-3 w-3 mr-1" />
                            삭제
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{review.content}</p>

                    {/* 리뷰 이미지 */}
                    {review.images && (() => {
                      try {
                        const images = JSON.parse(review.images)
                        if (Array.isArray(images) && images.length > 0) {
                          return (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {images.map((img: string, idx: number) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => openImageViewer(images, idx)}
                                  className="block w-20 h-20 rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                                >
                                  <img src={getThumbnailUrl(img)} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )
                        }
                      } catch {
                        return null
                      }
                      return null
                    })()}

                    {/* 관리자 답변 */}
                    {review.reply && (
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">판매자 답변</p>
                        <p className="text-sm whitespace-pre-wrap">{review.reply}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* 페이지네이션 */}
            {reviewTotal > 10 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFetchReviews(reviewPage - 1)}
                  disabled={reviewPage <= 1}
                >
                  이전
                </Button>
                <span className="flex items-center px-3 text-sm">
                  {reviewPage} / {Math.ceil(reviewTotal / 10)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFetchReviews(reviewPage + 1)}
                  disabled={reviewPage >= Math.ceil(reviewTotal / 10)}
                >
                  다음
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-12">
            아직 등록된 리뷰가 없습니다.
          </p>
        )}
      </div>

      {/* 이미지 뷰어 모달 */}
      {showImageViewer && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setShowImageViewer(false)}
        >
          {/* 닫기 버튼 */}
          <button
            onClick={() => setShowImageViewer(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
          >
            <X className="h-8 w-8" />
          </button>

          {/* 이미지 카운터 */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm">
            {viewerIndex + 1} / {viewerImages.length}
          </div>

          {/* 이전 버튼 */}
          {viewerImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setViewerIndex(prev => (prev === 0 ? viewerImages.length - 1 : prev - 1)) }}
              className="absolute left-4 text-white hover:text-gray-300 p-2"
            >
              <ChevronLeft className="h-10 w-10" />
            </button>
          )}

          {/* 이미지 */}
          <img
            src={viewerImages[viewerIndex]}
            alt=""
            className="max-h-[85vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* 다음 버튼 */}
          {viewerImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setViewerIndex(prev => (prev === viewerImages.length - 1 ? 0 : prev + 1)) }}
              className="absolute right-4 text-white hover:text-gray-300 p-2"
            >
              <ChevronRight className="h-10 w-10" />
            </button>
          )}

          {/* 썸네일 */}
          {viewerImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {viewerImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setViewerIndex(idx) }}
                  className={`w-12 h-12 rounded overflow-hidden border-2 transition-all ${
                    idx === viewerIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={getThumbnailUrl(img)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
