"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header, Footer } from "@/themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Package,
  Minus,
  Plus,
  Check,
  AlertCircle,
  X,
  Star,
  MessageSquare,
  Lock,
  Send,
  Pencil,
  ImagePlus,
  Settings,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface ProductOption {
  id: number
  option1: string | null
  option2: string | null
  option3: string | null
  price: number
  stock: number
  sku: string | null
}

interface Product {
  id: number
  name: string
  slug: string
  description: string | null
  content: string | null
  price: number
  originPrice: number | null
  images: string[]
  category: { id: number; name: string; slug: string } | null
  isSoldOut: boolean
  viewCount: number
  soldCount: number
  hasOptions: boolean
  options: ProductOption[]
  optionValues: {
    option1: string[]
    option2: string[]
    option3: string[]
  }
  optionName1: string | null
  optionName2: string | null
  optionName3: string | null
}

interface CartItem {
  productId: number
  productName: string
  productSlug: string
  productImage: string | null
  optionId: number | null
  optionText: string
  price: number
  quantity: number
}

interface Review {
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

interface Qna {
  id: number
  question: string
  answer: string | null
  answeredAt: string | null
  isSecret: boolean
  canView: boolean
  isOwner: boolean
  createdAt: string
  user: { id: number; name: string }
}

interface ReviewableOrder {
  orderId: number
  orderItemId: number
  productName: string
  optionText: string | null
  orderNo: string
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = params.slug as string

  // URL 기반 탭 상태
  const tabParam = searchParams.get('tab')
  const activeTab: 'detail' | 'review' | 'qna' = (tabParam === 'review' || tabParam === 'qna') ? tabParam : 'detail'

  const setActiveTab = useCallback((tab: 'detail' | 'review' | 'qna') => {
    const newParams = new URLSearchParams(searchParams.toString())
    if (tab === 'detail') {
      newParams.delete('tab')
    } else {
      newParams.set('tab', tab)
    }
    const queryString = newParams.toString()
    router.replace(`/shop/${slug}${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }, [router, slug, searchParams])

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 옵션 선택 상태
  const [selectedOption1, setSelectedOption1] = useState<string>("")
  const [selectedOption2, setSelectedOption2] = useState<string>("")
  const [selectedOption3, setSelectedOption3] = useState<string>("")
  const [quantity, setQuantity] = useState(1)

  // 이미지 갤러리
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // 장바구니 추가 상태
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartMessage, setCartMessage] = useState<string | null>(null)
  const [showCartModal, setShowCartModal] = useState(false)

  // 리뷰 상태
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewPage, setReviewPage] = useState(1)
  const [reviewTotal, setReviewTotal] = useState(0)
  const [avgRating, setAvgRating] = useState(0)
  const [reviewableOrders, setReviewableOrders] = useState<ReviewableOrder[]>([])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [selectedOrderItem, setSelectedOrderItem] = useState<number | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewContent, setReviewContent] = useState('')
  const [reviewImages, setReviewImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)

  // 리뷰 이미지 뷰어 상태
  const [viewerImages, setViewerImages] = useState<string[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)
  const [showImageViewer, setShowImageViewer] = useState(false)

  // Q&A 상태
  const [qnas, setQnas] = useState<Qna[]>([])
  const [qnasLoading, setQnasLoading] = useState(false)
  const [qnaPage, setQnaPage] = useState(1)
  const [qnaTotal, setQnaTotal] = useState(0)
  const [showQnaForm, setShowQnaForm] = useState(false)
  const [qnaContent, setQnaContent] = useState('')
  const [qnaIsSecret, setQnaIsSecret] = useState(false)
  const [submittingQna, setSubmittingQna] = useState(false)

  // 관리자 여부
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetchProduct()
    checkAdmin()
  }, [slug])

  // 관리자 여부 확인
  const checkAdmin = async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        setIsAdmin(data.user?.role === 'admin')
      }
    } catch {
      // 무시
    }
  }

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'review' && reviews.length === 0) {
      fetchReviews()
      fetchReviewableOrders()
    }
    if (activeTab === 'qna' && qnas.length === 0) {
      fetchQnas()
    }
  }, [activeTab])

  // 리뷰 작성 가능 주문이 1건이면 자동 선택
  useEffect(() => {
    if (showReviewForm && reviewableOrders.length === 1 && !selectedOrderItem) {
      setSelectedOrderItem(reviewableOrders[0].orderItemId)
    }
  }, [showReviewForm, reviewableOrders, selectedOrderItem])

  // 리뷰 가져오기
  const fetchReviews = async (page = 1) => {
    setReviewsLoading(true)
    try {
      const res = await fetch(`/api/shop/products/${slug}/reviews?page=${page}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews)
        setReviewTotal(data.pagination.total)
        setAvgRating(data.avgRating)
        setReviewPage(page)
      }
    } catch (err) {
      console.error('리뷰 로드 실패:', err)
    } finally {
      setReviewsLoading(false)
    }
  }

  // 리뷰 작성 가능한 주문 확인
  const fetchReviewableOrders = async () => {
    try {
      const res = await fetch(`/api/shop/products/${slug}/reviewable-orders`)
      if (res.ok) {
        const data = await res.json()
        setReviewableOrders(data.orders || [])
      }
    } catch (err) {
      console.error('리뷰 가능 주문 로드 실패:', err)
    }
  }

  // Q&A 가져오기
  const fetchQnas = async (page = 1) => {
    setQnasLoading(true)
    try {
      const res = await fetch(`/api/shop/products/${slug}/qna?page=${page}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setQnas(data.qnas)
        setQnaTotal(data.pagination.total)
        setQnaPage(page)
      }
    } catch (err) {
      console.error('Q&A 로드 실패:', err)
    } finally {
      setQnasLoading(false)
    }
  }

  // 원본 URL에서 썸네일 URL 생성 (xxx.webp -> xxx-thumb.webp)
  const getThumbnailUrl = (url: string) => {
    // .webp 또는 .gif 확장자 앞에 -thumb 삽입
    return url.replace(/(\.(webp|gif))$/i, '-thumb.webp')
  }

  // 리뷰 이미지 업로드
  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // 최대 5장 제한
    if (reviewImages.length + files.length > 5) {
      alert('이미지는 최대 5장까지 첨부할 수 있습니다.')
      return
    }

    setUploadingImage(true)

    const successUrls: string[] = []
    const failedFiles: { name: string; size: string; reason: string }[] = []

    // 파일 크기 포맷팅 함수
    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes}B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
    }

    // 개별적으로 업로드 처리
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'reviews')
        if (product) {
          formData.append('productId', String(product.id))
        }

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

    // 성공한 이미지 추가
    if (successUrls.length > 0) {
      setReviewImages(prev => [...prev, ...successUrls])
    }

    // 실패한 이미지가 있으면 알림
    if (failedFiles.length > 0) {
      const failedMessage = failedFiles
        .map(f => `• ${f.name} (${f.size}): ${f.reason}`)
        .join('\n')
      alert(`일부 이미지 업로드 실패:\n${failedMessage}`)
    }

    setUploadingImage(false)
    // input 초기화
    e.target.value = ''
  }

  // 리뷰 이미지 삭제
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
        setSelectedOrderItem(null)
        setReviewRating(5)
        setReviewContent('')
        setReviewImages([])
        fetchReviews(1)
        fetchReviewableOrders()
      } else {
        const data = await res.json()
        alert(data.error || '리뷰 작성에 실패했습니다.')
      }
    } catch (err) {
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
    // 기존 이미지 로드
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
        fetchReviews(reviewPage)
      } else {
        const data = await res.json()
        alert(data.error || '리뷰 수정에 실패했습니다.')
      }
    } catch (err) {
      alert('리뷰 수정에 실패했습니다.')
    } finally {
      setSubmittingReview(false)
    }
  }

  // 리뷰 이미지 뷰어 열기
  const openImageViewer = (images: string[], startIndex: number) => {
    setViewerImages(images)
    setViewerIndex(startIndex)
    setShowImageViewer(true)
  }

  // 리뷰 삭제
  const deleteReview = async (reviewId: number) => {
    if (!confirm('리뷰를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/shop/products/${slug}/reviews?reviewId=${reviewId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchReviews(reviewPage)
        fetchReviewableOrders()
      } else {
        const data = await res.json()
        alert(data.error || '리뷰 삭제에 실패했습니다.')
      }
    } catch {
      alert('리뷰 삭제에 실패했습니다.')
    }
  }

  // Q&A 작성
  const submitQna = async () => {
    if (!qnaContent.trim()) return
    setSubmittingQna(true)
    try {
      const res = await fetch(`/api/shop/products/${slug}/qna`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: qnaContent.trim(),
          isSecret: qnaIsSecret
        })
      })
      if (res.ok) {
        setShowQnaForm(false)
        setQnaContent('')
        setQnaIsSecret(false)
        fetchQnas(1)
      } else {
        const data = await res.json()
        alert(data.error || 'Q&A 작성에 실패했습니다.')
      }
    } catch (err) {
      alert('Q&A 작성에 실패했습니다.')
    } finally {
      setSubmittingQna(false)
    }
  }

  const fetchProduct = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/shop/products/${slug}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError("상품을 찾을 수 없습니다.")
        } else {
          setError("상품을 불러오는데 실패했습니다.")
        }
        return
      }
      const data = await res.json()
      setProduct(data.product)
    } catch (err) {
      setError("상품을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  // 2단계 옵션 목록 (1단계 선택에 따라 필터링)
  const availableOption2Values = useMemo(() => {
    if (!product || !selectedOption1) return []
    const values = new Set<string>()
    product.options.forEach(opt => {
      if (opt.option1 === selectedOption1 && opt.option2) {
        values.add(opt.option2)
      }
    })
    return Array.from(values)
  }, [product, selectedOption1])

  // 3단계 옵션 목록 (1,2단계 선택에 따라 필터링)
  const availableOption3Values = useMemo(() => {
    if (!product || !selectedOption1 || !selectedOption2) return []
    const values = new Set<string>()
    product.options.forEach(opt => {
      if (opt.option1 === selectedOption1 && opt.option2 === selectedOption2 && opt.option3) {
        values.add(opt.option3)
      }
    })
    return Array.from(values)
  }, [product, selectedOption1, selectedOption2])

  // 선택된 옵션 찾기
  const selectedOption = useMemo(() => {
    if (!product) return null

    // 옵션이 없는 경우
    if (!product.hasOptions || product.options.length === 0) {
      return null
    }

    // 옵션이 있는 경우 - 모든 필요한 옵션이 선택되었는지 확인
    const hasOption1 = product.optionValues.option1.length > 0
    const hasOption2 = product.optionValues.option2.length > 0
    const hasOption3 = product.optionValues.option3.length > 0

    if (hasOption1 && !selectedOption1) return null
    if (hasOption2 && !selectedOption2) return null
    if (hasOption3 && !selectedOption3) return null

    return product.options.find(opt =>
      opt.option1 === (selectedOption1 || null) &&
      opt.option2 === (selectedOption2 || null) &&
      opt.option3 === (selectedOption3 || null)
    )
  }, [product, selectedOption1, selectedOption2, selectedOption3])

  // 현재 가격
  const currentPrice = useMemo(() => {
    if (selectedOption) return selectedOption.price
    if (product) return product.price
    return 0
  }, [product, selectedOption])

  // 재고
  const currentStock = useMemo(() => {
    if (selectedOption) return selectedOption.stock
    return null
  }, [selectedOption])

  // 품절 여부
  const isOutOfStock = useMemo(() => {
    if (!product) return true
    if (product.isSoldOut) return true
    if (selectedOption && selectedOption.stock <= 0) return true
    return false
  }, [product, selectedOption])

  // 옵션 선택 완료 여부
  const isOptionSelected = useMemo(() => {
    if (!product) return false
    if (!product.hasOptions || product.options.length === 0) return true

    const hasOption1 = product.optionValues.option1.length > 0
    const hasOption2 = product.optionValues.option2.length > 0
    const hasOption3 = product.optionValues.option3.length > 0

    if (hasOption1 && !selectedOption1) return false
    if (hasOption2 && !selectedOption2) return false
    if (hasOption3 && !selectedOption3) return false

    return true
  }, [product, selectedOption1, selectedOption2, selectedOption3])

  // 옵션 1 변경 시 하위 옵션 초기화
  const handleOption1Change = (value: string) => {
    setSelectedOption1(value)
    setSelectedOption2("")
    setSelectedOption3("")
  }

  // 옵션 2 변경 시 하위 옵션 초기화
  const handleOption2Change = (value: string) => {
    setSelectedOption2(value)
    setSelectedOption3("")
  }

  // 수량 변경
  const handleQuantityChange = (delta: number) => {
    const newQty = quantity + delta
    if (newQty < 1) return
    if (currentStock !== null && newQty > currentStock) return
    setQuantity(newQty)
  }

  // 옵션 텍스트 생성
  const getOptionText = () => {
    const parts = []
    if (selectedOption1) parts.push(selectedOption1)
    if (selectedOption2) parts.push(selectedOption2)
    if (selectedOption3) parts.push(selectedOption3)
    return parts.join(" / ")
  }

  // 장바구니에 추가
  const addToCart = () => {
    if (!product) return
    if (!isOptionSelected) {
      setCartMessage("옵션을 선택해주세요.")
      setTimeout(() => setCartMessage(null), 2000)
      return
    }
    if (isOutOfStock) {
      setCartMessage("품절된 상품입니다.")
      setTimeout(() => setCartMessage(null), 2000)
      return
    }

    setAddingToCart(true)

    // 장바구니 아이템 생성
    const cartItem: CartItem = {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.images[0] || null,
      optionId: selectedOption?.id || null,
      optionText: getOptionText(),
      price: currentPrice,
      quantity: quantity,
    }

    // localStorage에서 기존 장바구니 불러오기
    const existingCart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]")

    // 같은 상품+옵션이 있으면 수량 추가, 없으면 새로 추가
    const existingIndex = existingCart.findIndex(
      item => item.productId === cartItem.productId && item.optionId === cartItem.optionId
    )

    if (existingIndex >= 0) {
      existingCart[existingIndex].quantity += cartItem.quantity
    } else {
      existingCart.push(cartItem)
    }

    // localStorage에 저장
    localStorage.setItem("cart", JSON.stringify(existingCart))

    // 장바구니 이벤트 발생 (헤더 업데이트용)
    window.dispatchEvent(new Event("cartUpdated"))

    setAddingToCart(false)
    setShowCartModal(true)
  }

  // 장바구니에서 주문하기
  const goToOrderFromCart = () => {
    // 장바구니에 있는 해당 상품만 주문 정보로 저장
    const existingCart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]")
    localStorage.setItem("orderItems", JSON.stringify(existingCart))
    router.push("/shop/order")
  }

  // 바로 구매
  const buyNow = () => {
    if (!product) return
    if (!isOptionSelected) {
      setCartMessage("옵션을 선택해주세요.")
      setTimeout(() => setCartMessage(null), 2000)
      return
    }
    if (isOutOfStock) {
      setCartMessage("품절된 상품입니다.")
      setTimeout(() => setCartMessage(null), 2000)
      return
    }

    // 주문 아이템 생성
    const orderItem: CartItem = {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.images[0] || null,
      optionId: selectedOption?.id || null,
      optionText: getOptionText(),
      price: currentPrice,
      quantity: quantity,
    }

    // 주문 정보로 저장 후 바로 주문 페이지로 이동
    localStorage.setItem("orderItems", JSON.stringify([orderItem]))
    router.push("/shop/order")
  }

  const formatPrice = (price: number) => price.toLocaleString() + "원"

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">{error || "상품을 찾을 수 없습니다."}</p>
          <Button variant="outline" onClick={() => router.push("/shop")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            쇼핑몰로 돌아가기
          </Button>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* 뒤로가기 */}
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              뒤로가기
            </Button>
          </div>

          {/* 아마존 스타일 3컬럼 레이아웃 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 왼쪽: 이미지 갤러리 (썸네일 + 메인 이미지) */}
            <div className="lg:col-span-5">
              <div className="flex gap-3">
                {/* 썸네일 세로 배열 */}
                {product.images.length > 1 && (
                  <div className="flex flex-col gap-2 w-16 flex-shrink-0">
                    {product.images.map((img, idx) => (
                      <button
                        key={idx}
                        onMouseEnter={() => setSelectedImageIndex(idx)}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`w-14 h-14 rounded border-2 overflow-hidden transition-all ${
                          idx === selectedImageIndex
                            ? "border-primary ring-1 ring-primary"
                            : "border-muted hover:border-primary/50"
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* 메인 이미지 */}
                <div className="flex-1 relative">
                  <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                    {product.images.length > 0 ? (
                      <img
                        src={product.images[selectedImageIndex]}
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-20 w-20 text-muted-foreground" />
                      </div>
                    )}
                    {product.isSoldOut && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-2xl">품절</span>
                      </div>
                    )}
                    {product.originPrice && product.originPrice > product.price && (
                      <Badge className="absolute top-3 left-3 bg-red-500 text-sm px-2 py-0.5">
                        {Math.round((1 - product.price / product.originPrice) * 100)}% OFF
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 중앙: 상품 정보 */}
            <div className="lg:col-span-4">
              {/* 카테고리 */}
              {product.category && (
                <Link href={`/shop?category=${product.category.slug}`}>
                  <Badge variant="outline" className="mb-2 text-xs">
                    {product.category.name}
                  </Badge>
                </Link>
              )}

              {/* 상품명 */}
              <div className="flex items-start gap-2 mb-3">
                <h1 className="text-xl font-semibold leading-tight">{product.name}</h1>
                {isAdmin && (
                  <Link
                    href={`/admin/shop/products/${product.id}`}
                    className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                    title="상품 수정"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                )}
              </div>

              {/* 판매/조회 정보 */}
              <div className="flex gap-3 text-sm text-muted-foreground mb-4 pb-4 border-b">
                <span>판매 {product.soldCount}개</span>
                <span>조회 {product.viewCount}</span>
              </div>

              {/* 가격 (모바일에서만 표시) */}
              <div className="lg:hidden mb-4">
                <div className="flex items-baseline gap-2">
                  {product.originPrice && product.originPrice > currentPrice && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.originPrice)}
                    </span>
                  )}
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(currentPrice)}
                  </span>
                </div>
              </div>

              {/* 설명 */}
              {product.description && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">상품 설명</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
                </div>
              )}

              {/* 상품 정보 요약 */}
              <div className="space-y-2 text-sm">
                {product.hasOptions && product.optionValues.option1.length > 0 && (
                  <div className="flex">
                    <span className="text-muted-foreground w-20">{product.optionName1 || "옵션1"}</span>
                    <span>{product.optionValues.option1.join(", ")}</span>
                  </div>
                )}
                {product.hasOptions && product.optionValues.option2.length > 0 && (
                  <div className="flex">
                    <span className="text-muted-foreground w-20">{product.optionName2 || "옵션2"}</span>
                    <span>{product.optionValues.option2.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 오른쪽: 구매 박스 */}
            <div className="lg:col-span-3">
              <Card className="sticky top-4">
                <CardContent className="p-4 space-y-4">
                  {/* 가격 */}
                  <div>
                    {product.originPrice && product.originPrice > currentPrice && (
                      <div className="text-sm text-muted-foreground line-through">
                        {formatPrice(product.originPrice)}
                      </div>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-primary">
                        {formatPrice(currentPrice)}
                      </span>
                    </div>
                  </div>

                  {/* 배송 정보 */}
                  <div className="text-sm text-muted-foreground pb-3 border-b">
                    무료배송
                  </div>

                  {/* 재고 상태 */}
                  {!product.isSoldOut && (
                    <p className={`text-sm font-medium ${
                      currentStock !== null && currentStock <= 5
                        ? "text-orange-600"
                        : "text-green-600"
                    }`}>
                      {currentStock !== null
                        ? currentStock <= 0
                          ? "품절"
                          : currentStock <= 5
                            ? `재고 ${currentStock}개 남음`
                            : "재고 있음"
                        : "재고 있음"
                      }
                    </p>
                  )}

                  {/* 옵션 선택 */}
                  {product.hasOptions && product.options.length > 0 && (
                    <div className="space-y-3">
                      {/* 1단계 옵션 */}
                      {product.optionValues.option1.length > 0 && (
                        <div>
                          <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                            {product.optionName1 || "옵션1"}
                          </label>
                          <Select value={selectedOption1} onValueChange={handleOption1Change}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {product.optionValues.option1.map(val => (
                                <SelectItem key={val} value={val}>
                                  {val}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* 2단계 옵션 */}
                      {product.optionValues.option2.length > 0 && (
                        <div>
                          <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                            {product.optionName2 || "옵션2"}
                          </label>
                          <Select
                            value={selectedOption2}
                            onValueChange={handleOption2Change}
                            disabled={!selectedOption1}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder={selectedOption1 ? "선택" : "상위 옵션 먼저 선택"} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableOption2Values.map(val => (
                                <SelectItem key={val} value={val}>
                                  {val}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* 3단계 옵션 */}
                      {product.optionValues.option3.length > 0 && (
                        <div>
                          <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                            {product.optionName3 || "옵션3"}
                          </label>
                          <Select
                            value={selectedOption3}
                            onValueChange={setSelectedOption3}
                            disabled={!selectedOption2}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder={selectedOption2 ? "선택" : "상위 옵션 먼저 선택"} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableOption3Values.map(val => (
                                <SelectItem key={val} value={val}>
                                  {val}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* 선택된 옵션 정보 */}
                      {selectedOption && (
                        <div className="text-xs pt-2 border-t">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{getOptionText()}</span>
                            <span className={selectedOption.stock <= 0 ? "text-red-500" : ""}>
                              {selectedOption.stock <= 0 ? "품절" : `${selectedOption.stock}개`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 수량 선택 */}
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">수량</label>
                    <div className="flex items-center border rounded-md w-fit">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(-1)}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-10 text-center text-sm">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(1)}
                        disabled={currentStock !== null && quantity >= currentStock}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* 총 금액 */}
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="text-sm text-muted-foreground">총 금액</span>
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(currentPrice * quantity)}
                    </span>
                  </div>

                  {/* 메시지 */}
                  {cartMessage && (
                    <div className={`flex items-center gap-2 p-2 rounded text-xs ${
                      cartMessage.includes("추가") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                      {cartMessage.includes("추가") ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {cartMessage}
                    </div>
                  )}

                  {/* 버튼 */}
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={buyNow}
                      disabled={isOutOfStock || !isOptionSelected}
                    >
                      바로 구매
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={addToCart}
                      disabled={addingToCart || isOutOfStock || !isOptionSelected}
                    >
                      {addingToCart ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4 mr-2" />
                      )}
                      장바구니
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 탭 영역 */}
          <div className="mt-12">
            {/* 탭 버튼 */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('detail')}
                className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'detail'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                상세정보
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                  activeTab === 'review'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Star className="h-4 w-4" />
                리뷰 ({reviewTotal})
              </button>
              <button
                onClick={() => setActiveTab('qna')}
                className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                  activeTab === 'qna'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Q&A ({qnaTotal})
              </button>
            </div>

            {/* 탭 내용 */}
            <div className="py-6">
              {/* 상세정보 탭 */}
              {activeTab === 'detail' && (
                <div>
                  {product.content ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: product.content }}
                    />
                  ) : (
                    <p className="text-muted-foreground text-center py-12">
                      등록된 상세정보가 없습니다.
                    </p>
                  )}
                </div>
              )}

              {/* 리뷰 탭 */}
              {activeTab === 'review' && (
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
                  {reviewableOrders.length > 0 && !showReviewForm && (
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
                        {/* 주문 선택 - 여러 건일 때만 표시 */}
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
                            onClick={() => fetchReviews(reviewPage - 1)}
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
                            onClick={() => fetchReviews(reviewPage + 1)}
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
              )}

              {/* Q&A 탭 */}
              {activeTab === 'qna' && (
                <div>
                  {/* Q&A 작성 버튼 */}
                  {!showQnaForm && (
                    <div className="mb-6">
                      <Button onClick={() => setShowQnaForm(true)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        문의하기
                      </Button>
                    </div>
                  )}

                  {/* Q&A 작성 폼 */}
                  {showQnaForm && (
                    <Card className="mb-6">
                      <CardContent className="p-4 space-y-4">
                        <div>
                          <Label>문의 내용</Label>
                          <Textarea
                            value={qnaContent}
                            onChange={(e) => setQnaContent(e.target.value)}
                            placeholder="상품에 대해 궁금한 점을 문의해주세요."
                            className="mt-1"
                            rows={4}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            id="qna-secret"
                            checked={qnaIsSecret}
                            onCheckedChange={setQnaIsSecret}
                          />
                          <Label htmlFor="qna-secret" className="flex items-center gap-1 cursor-pointer">
                            <Lock className="h-4 w-4" />
                            비밀글로 작성
                          </Label>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setShowQnaForm(false)}>
                            취소
                          </Button>
                          <Button
                            onClick={submitQna}
                            disabled={submittingQna || !qnaContent.trim()}
                          >
                            {submittingQna ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                            등록
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Q&A 목록 */}
                  {qnasLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : qnas.length > 0 ? (
                    <div className="space-y-4">
                      {qnas.map(qna => (
                        <div key={qna.id} className="border rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {qna.isSecret && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Lock className="h-3 w-3 mr-1" />
                                    비밀글
                                  </Badge>
                                )}
                                <span className="font-medium text-sm">{qna.user.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(qna.createdAt).toLocaleDateString('ko-KR')}
                                </span>
                                {qna.answer && (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                    답변완료
                                  </Badge>
                                )}
                              </div>

                              {/* 질문 */}
                              <div className="mb-3">
                                <span className="inline-block px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded mr-2">Q</span>
                                <span className={`text-sm ${!qna.canView ? 'text-muted-foreground italic' : ''}`}>
                                  {qna.question}
                                </span>
                              </div>

                              {/* 답변 */}
                              {qna.answer && (
                                <div className="p-3 bg-muted rounded-lg">
                                  <span className="inline-block px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded mr-2">A</span>
                                  <span className={`text-sm ${!qna.canView ? 'text-muted-foreground italic' : ''}`}>
                                    {qna.answer}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* 페이지네이션 */}
                      {qnaTotal > 10 && (
                        <div className="flex justify-center gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchQnas(qnaPage - 1)}
                            disabled={qnaPage <= 1}
                          >
                            이전
                          </Button>
                          <span className="flex items-center px-3 text-sm">
                            {qnaPage} / {Math.ceil(qnaTotal / 10)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchQnas(qnaPage + 1)}
                            disabled={qnaPage >= Math.ceil(qnaTotal / 10)}
                          >
                            다음
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-12">
                      아직 등록된 Q&A가 없습니다.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 장바구니 추가 확인 모달 */}
      {showCartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 오버레이 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCartModal(false)}
          />
          {/* 모달 */}
          <div className="relative bg-background rounded-lg shadow-lg max-w-sm w-full mx-4 p-6">
            <button
              onClick={() => setShowCartModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold mb-1">장바구니에 담았습니다</h3>
              <p className="text-sm text-muted-foreground">
                주문서로 이동하시겠습니까?
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCartModal(false)}
              >
                쇼핑 계속하기
              </Button>
              <Button
                className="flex-1"
                onClick={goToOrderFromCart}
              >
                주문서로 이동
              </Button>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => router.push("/shop/cart")}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                장바구니 보기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 리뷰 이미지 뷰어 모달 */}
      {showImageViewer && viewerImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          {/* 닫기 버튼 */}
          <button
            onClick={() => setShowImageViewer(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
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
              onClick={() => setViewerIndex(prev => (prev === 0 ? viewerImages.length - 1 : prev - 1))}
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
              onClick={() => setViewerIndex(prev => (prev === viewerImages.length - 1 ? 0 : prev + 1))}
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
                  onClick={() => setViewerIndex(idx)}
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

      <Footer />
    </div>
  )
}
