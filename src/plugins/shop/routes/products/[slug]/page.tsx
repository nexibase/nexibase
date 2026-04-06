"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header, Footer } from "@/components/layout"
import { sanitizeHtml } from "@/lib/sanitize"
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
  Minus,
  Plus,
  Check,
  AlertCircle,
  X,
  Star,
  MessageSquare,
  Settings,
  ChevronLeft,
  Heart,
} from "lucide-react"
import ShopProductImages from "@/plugins/shop/components/ProductImages"
import ShopReviewSection from "@/plugins/shop/components/ReviewSection"
import ShopQnaSection from "@/plugins/shop/components/QnaSection"
import { PopularProducts, RecentlyViewedProducts, saveViewedProduct } from "@/plugins/shop/components/ShopProductRecommend"

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
  stock: number
  totalStock: number
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
  reviewCount: number
  avgRating: number
  qnaCount: number
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

// 선택된 옵션 아이템 (멀티 선택용)
interface SelectedItem {
  optionId: number | null
  optionText: string
  price: number
  quantity: number
  stock: number
}

interface Review {
  id: number
  rating: number
  content: string
  images: string | null
  reply: string | null
  repliedAt: string | null
  createdAt: string
  user: { id: number; nickname: string; image: string | null }
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
  user: { id: number; nickname: string }
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
    router.replace(`/shop/products/${slug}${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }, [router, slug, searchParams])

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 옵션 선택 상태 (드롭다운용)
  const [selectedOption1, setSelectedOption1] = useState<string>("")
  const [selectedOption2, setSelectedOption2] = useState<string>("")
  const [selectedOption3, setSelectedOption3] = useState<string>("")

  // 멀티 옵션 선택 목록
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])

  // 옵션 없는 상품용 수량
  const [quantity, setQuantity] = useState(1)

  // 장바구니 추가 상태
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartMessage, setCartMessage] = useState<string | null>(null)
  const [showCartModal, setShowCartModal] = useState(false)

  // 리뷰 상태 (데이터만 - UI 상태는 ReviewSection에서 관리)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewPage, setReviewPage] = useState(1)
  const [reviewTotal, setReviewTotal] = useState(0)
  const [avgRating, setAvgRating] = useState(0)
  const [reviewableOrders, setReviewableOrders] = useState<ReviewableOrder[]>([])

  // Q&A 상태 (데이터만 - UI 상태는 QnaSection에서 관리)
  const [qnas, setQnas] = useState<Qna[]>([])
  const [qnasLoading, setQnasLoading] = useState(false)
  const [qnaPage, setQnaPage] = useState(1)
  const [qnaTotal, setQnaTotal] = useState(0)

  // 관리자 여부
  const [isAdmin, setIsAdmin] = useState(false)

  // 찜하기 상태
  const [isWished, setIsWished] = useState(false)
  const [wishLoading, setWishLoading] = useState(false)

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

  // 찜 여부 확인
  const checkWishlist = async (productId: number) => {
    try {
      const res = await fetch(`/api/shop/wishlist/check?productId=${productId}`)
      if (res.ok) {
        const data = await res.json()
        setIsWished(data.isWished)
      }
    } catch {
      // 무시
    }
  }

  // 찜하기 토글
  const toggleWishlist = async () => {
    if (!product) return
    setWishLoading(true)
    try {
      const res = await fetch('/api/shop/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id })
      })
      if (res.ok) {
        const data = await res.json()
        setIsWished(data.isWished)
      } else if (res.status === 401) {
        // 로그인 필요
        if (confirm('로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?')) {
          router.push(`/login?redirect=/shop/products/${slug}`)
        }
      } else {
        const data = await res.json()
        alert(data.error || '찜하기에 실패했습니다.')
      }
    } catch {
      alert('찜하기에 실패했습니다.')
    } finally {
      setWishLoading(false)
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
      // 리뷰/Q&A 개수 초기화 (API에서 받은 값으로)
      setReviewTotal(data.product.reviewCount || 0)
      setAvgRating(data.product.avgRating || 0)
      setQnaTotal(data.product.qnaCount || 0)
      // 찜 여부 확인
      checkWishlist(data.product.id)
      // 최근 본 상품에 저장
      saveViewedProduct(data.product.id)
    } catch {
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

  // 최종 옵션 단계 확인 (몇 단계까지 있는지)
  const finalOptionLevel = useMemo(() => {
    if (!product) return 0
    if (product.optionValues.option3.length > 0) return 3
    if (product.optionValues.option2.length > 0) return 2
    if (product.optionValues.option1.length > 0) return 1
    return 0
  }, [product])

  // 최종 단계 옵션의 재고 정보 (마지막 선택 단계에서만 표시)
  const getFinalOptionStock = useCallback((optionValue: string, level: number) => {
    if (!product) return null

    if (level === 1) {
      // 1단계가 최종인 경우
      const option = product.options.find(opt => opt.option1 === optionValue)
      return option ? { stock: option.stock, price: option.price } : null
    } else if (level === 2 && selectedOption1) {
      // 2단계가 최종인 경우
      const option = product.options.find(opt =>
        opt.option1 === selectedOption1 && opt.option2 === optionValue
      )
      return option ? { stock: option.stock, price: option.price } : null
    } else if (level === 3 && selectedOption1 && selectedOption2) {
      // 3단계가 최종인 경우
      const option = product.options.find(opt =>
        opt.option1 === selectedOption1 && opt.option2 === selectedOption2 && opt.option3 === optionValue
      )
      return option ? { stock: option.stock, price: option.price } : null
    }
    return null
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
    // 옵션이 없는 상품의 경우 product.stock 사용
    if (product && !product.hasOptions) return product.stock
    return null
  }, [selectedOption, product])

  // 품절 여부
  const isOutOfStock = useMemo(() => {
    if (!product) return true
    if (product.isSoldOut) return true
    if (selectedOption && selectedOption.stock <= 0) return true
    // 옵션 없는 상품의 경우 product.stock으로 품절 여부 확인
    if (!product.hasOptions && product.stock <= 0) return true
    return false
  }, [product, selectedOption])


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

  // 옵션 선택 완료 시 selectedItems에 자동 추가
  useEffect(() => {
    if (!product || !product.hasOptions) return

    const hasOption1 = product.optionValues.option1.length > 0
    const hasOption2 = product.optionValues.option2.length > 0
    const hasOption3 = product.optionValues.option3.length > 0

    // 모든 필요한 옵션이 선택되었는지 확인
    if (hasOption1 && !selectedOption1) return
    if (hasOption2 && !selectedOption2) return
    if (hasOption3 && !selectedOption3) return

    // 선택된 옵션 찾기
    const option = product.options.find(opt =>
      opt.option1 === (selectedOption1 || null) &&
      opt.option2 === (selectedOption2 || null) &&
      opt.option3 === (selectedOption3 || null)
    )

    if (!option) return

    // 이미 추가된 옵션인지 확인
    const exists = selectedItems.some(item => item.optionId === option.id)
    if (exists) {
      setCartMessage("이미 추가된 옵션입니다.")
      setTimeout(() => setCartMessage(null), 2000)
      // 옵션 선택 초기화
      setSelectedOption1("")
      setSelectedOption2("")
      setSelectedOption3("")
      return
    }

    // 품절 확인
    if (option.stock <= 0) {
      setCartMessage("품절된 옵션입니다.")
      setTimeout(() => setCartMessage(null), 2000)
      setSelectedOption1("")
      setSelectedOption2("")
      setSelectedOption3("")
      return
    }

    // 옵션 텍스트 생성
    const parts = []
    if (selectedOption1) parts.push(selectedOption1)
    if (selectedOption2) parts.push(selectedOption2)
    if (selectedOption3) parts.push(selectedOption3)
    const optionText = parts.join(" / ")

    // selectedItems에 추가
    setSelectedItems(prev => [...prev, {
      optionId: option.id,
      optionText,
      price: option.price,
      quantity: 1,
      stock: option.stock
    }])

    // 옵션 선택 초기화
    setSelectedOption1("")
    setSelectedOption2("")
    setSelectedOption3("")
  }, [selectedOption1, selectedOption2, selectedOption3, product, selectedItems])

  // 선택된 아이템 수량 변경
  const handleItemQuantityChange = (optionId: number | null, delta: number) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.optionId === optionId) {
        const newQty = item.quantity + delta
        if (newQty < 1 || newQty > item.stock) return item
        return { ...item, quantity: newQty }
      }
      return item
    }))
  }

  // 선택된 아이템 삭제
  const removeSelectedItem = (optionId: number | null) => {
    setSelectedItems(prev => prev.filter(item => item.optionId !== optionId))
  }

  // 옵션 없는 상품용 수량 변경
  const handleQuantityChange = (delta: number) => {
    const newQty = quantity + delta
    if (newQty < 1) return
    if (currentStock !== null && newQty > currentStock) return
    setQuantity(newQty)
  }

  // 총 금액 계산
  const totalPrice = useMemo(() => {
    if (!product) return 0
    if (product.hasOptions && selectedItems.length > 0) {
      return selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    }
    return currentPrice * quantity
  }, [product, selectedItems, currentPrice, quantity])

  // 총 수량 계산
  const totalQuantity = useMemo(() => {
    if (!product) return 0
    if (product.hasOptions && selectedItems.length > 0) {
      return selectedItems.reduce((sum, item) => sum + item.quantity, 0)
    }
    return quantity
  }, [product, selectedItems, quantity])

  // 장바구니에 추가
  const addToCart = () => {
    if (!product) return

    // 옵션이 있는 상품
    if (product.hasOptions) {
      if (selectedItems.length === 0) {
        setCartMessage("옵션을 선택해주세요.")
        setTimeout(() => setCartMessage(null), 2000)
        return
      }

      setAddingToCart(true)

      // localStorage에서 기존 장바구니 불러오기
      const existingCart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]")

      // 선택된 모든 아이템 장바구니에 추가
      selectedItems.forEach(item => {
        const cartItem: CartItem = {
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          productImage: product.images[0] || null,
          optionId: item.optionId,
          optionText: item.optionText,
          price: item.price,
          quantity: item.quantity,
        }

        const existingIndex = existingCart.findIndex(
          c => c.productId === cartItem.productId && c.optionId === cartItem.optionId
        )

        if (existingIndex >= 0) {
          existingCart[existingIndex].quantity += cartItem.quantity
        } else {
          existingCart.push(cartItem)
        }
      })

      localStorage.setItem("cart", JSON.stringify(existingCart))
      window.dispatchEvent(new Event("cartUpdated"))

      setAddingToCart(false)
      setShowCartModal(true)
      setSelectedItems([]) // 장바구니 추가 후 선택 초기화
    } else {
      // 옵션이 없는 상품
      if (isOutOfStock) {
        setCartMessage("품절된 상품입니다.")
        setTimeout(() => setCartMessage(null), 2000)
        return
      }

      setAddingToCart(true)

      const cartItem: CartItem = {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productImage: product.images[0] || null,
        optionId: null,
        optionText: "",
        price: currentPrice,
        quantity: quantity,
      }

      const existingCart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]")
      const existingIndex = existingCart.findIndex(
        item => item.productId === cartItem.productId && item.optionId === null
      )

      if (existingIndex >= 0) {
        existingCart[existingIndex].quantity += cartItem.quantity
      } else {
        existingCart.push(cartItem)
      }

      localStorage.setItem("cart", JSON.stringify(existingCart))
      window.dispatchEvent(new Event("cartUpdated"))

      setAddingToCart(false)
      setShowCartModal(true)
    }
  }

  // 바로 구매
  const buyNow = () => {
    if (!product) return

    // 옵션이 있는 상품
    if (product.hasOptions) {
      if (selectedItems.length === 0) {
        setCartMessage("옵션을 선택해주세요.")
        setTimeout(() => setCartMessage(null), 2000)
        return
      }

      // 선택된 모든 아이템을 주문 정보로 저장
      const orderItems: CartItem[] = selectedItems.map(item => ({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productImage: product.images[0] || null,
        optionId: item.optionId,
        optionText: item.optionText,
        price: item.price,
        quantity: item.quantity,
      }))

      localStorage.setItem("orderItems", JSON.stringify(orderItems))
      router.push("/shop/order")
    } else {
      // 옵션이 없는 상품
      if (isOutOfStock) {
        setCartMessage("품절된 상품입니다.")
        setTimeout(() => setCartMessage(null), 2000)
        return
      }

      const orderItem: CartItem = {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productImage: product.images[0] || null,
        optionId: null,
        optionText: "",
        price: currentPrice,
        quantity: quantity,
      }

      localStorage.setItem("orderItems", JSON.stringify([orderItem]))
      router.push("/shop/order")
    }
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

          {/* 50:50 레이아웃 */}
          {/* md 이상: 이미지(6) | 상품정보+구매박스(6) */}
          {/* sm: 이미지 → 상품정보 → 구매박스 (1컬럼) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 왼쪽: 이미지 갤러리 */}
            <div>
              <ShopProductImages
                images={product.images}
                productName={product.name}
                isSoldOut={product.isSoldOut}
                price={product.price}
                originPrice={product.originPrice}
              />
            </div>

            {/* 오른쪽: 상품 정보 + 구매박스 */}
            <div className="space-y-6">
              {/* 상품 정보 */}
              <div>
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
                <h1 className="text-xl font-semibold leading-tight flex-1">{product.name}</h1>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={toggleWishlist}
                    disabled={wishLoading}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors"
                    title={isWished ? "찜 해제" : "찜하기"}
                  >
                    <Heart
                      className={`h-5 w-5 transition-colors ${
                        isWished
                          ? "fill-red-500 text-red-500"
                          : "text-muted-foreground hover:text-red-500"
                      } ${wishLoading ? "animate-pulse" : ""}`}
                    />
                  </button>
                  {isAdmin && (
                    <Link
                      href={`/admin/shop/products/${product.id}`}
                      className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      title="상품 수정"
                    >
                      <Settings className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>

              {/* 판매 정보 (조회수는 관리자만) */}
              <div className="flex gap-3 text-sm text-muted-foreground mb-4 pb-4 border-b">
                <span>판매 {product.soldCount}개</span>
                {isAdmin && <span>조회 {product.viewCount}</span>}
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

              {/* 구매 박스 */}
              <div>
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
                          : `재고 ${currentStock}개`
                        : product.hasOptions
                          ? "옵션을 선택해주세요"
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
                              {product.optionValues.option1.map(val => {
                                const isFinal = finalOptionLevel === 1
                                const stockInfo = isFinal ? getFinalOptionStock(val, 1) : null
                                const isSoldOut = stockInfo && stockInfo.stock <= 0
                                return (
                                  <SelectItem key={val} value={val}>
                                    {val}
                                    {isFinal && stockInfo && (
                                      <span className={`ml-2 text-xs ${
                                        isSoldOut
                                          ? "text-red-500"
                                          : stockInfo.stock <= 5
                                            ? "text-orange-500"
                                            : "text-muted-foreground"
                                      }`}>
                                        {isSoldOut ? "(품절)" : `(재고 ${stockInfo.stock})`}
                                      </span>
                                    )}
                                  </SelectItem>
                                )
                              })}
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
                              {availableOption2Values.map(val => {
                                const isFinal = finalOptionLevel === 2
                                const stockInfo = isFinal ? getFinalOptionStock(val, 2) : null
                                const isSoldOut = stockInfo && stockInfo.stock <= 0
                                return (
                                  <SelectItem key={val} value={val}>
                                    {val}
                                    {isFinal && stockInfo && (
                                      <span className={`ml-2 text-xs ${
                                        isSoldOut
                                          ? "text-red-500"
                                          : stockInfo.stock <= 5
                                            ? "text-orange-500"
                                            : "text-muted-foreground"
                                      }`}>
                                        {isSoldOut ? "(품절)" : `(재고 ${stockInfo.stock})`}
                                      </span>
                                    )}
                                  </SelectItem>
                                )
                              })}
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
                              {availableOption3Values.map(val => {
                                const isFinal = finalOptionLevel === 3
                                const stockInfo = isFinal ? getFinalOptionStock(val, 3) : null
                                const isSoldOut = stockInfo && stockInfo.stock <= 0
                                return (
                                  <SelectItem key={val} value={val}>
                                    {val}
                                    {isFinal && stockInfo && (
                                      <span className={`ml-2 text-xs ${
                                        isSoldOut
                                          ? "text-red-500"
                                          : stockInfo.stock <= 5
                                            ? "text-orange-500"
                                            : "text-muted-foreground"
                                      }`}>
                                        {isSoldOut ? "(품절)" : `(재고 ${stockInfo.stock})`}
                                      </span>
                                    )}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                    </div>
                  )}

                  {/* 선택된 옵션 목록 (멀티 옵션) */}
                  {product.hasOptions && selectedItems.length > 0 && (
                    <div className="space-y-2 pt-3 border-t">
                      <label className="text-xs font-medium text-muted-foreground">선택한 상품</label>
                      {selectedItems.map((item) => (
                        <div key={item.optionId} className="bg-muted/50 rounded-md p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <span className="text-sm">{item.optionText}</span>
                              <span className={`text-xs ml-2 ${item.stock <= 5 ? "text-orange-600" : "text-muted-foreground"}`}>
                                (재고 {item.stock}개)
                              </span>
                            </div>
                            <button
                              onClick={() => removeSelectedItem(item.optionId)}
                              className="text-muted-foreground hover:text-foreground ml-2"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center border rounded-md bg-background">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleItemQuantityChange(item.optionId, -1)}
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm">{item.quantity}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleItemQuantityChange(item.optionId, 1)}
                                disabled={item.quantity >= item.stock}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <span className="text-sm font-medium">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 수량 선택 (옵션 없는 상품만) */}
                  {!product.hasOptions && (
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
                  )}

                  {/* 총 금액 */}
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="text-sm text-muted-foreground">
                      총 금액 {totalQuantity > 0 && `(${totalQuantity}개)`}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(totalPrice)}
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
                      disabled={product.hasOptions ? selectedItems.length === 0 : isOutOfStock}
                    >
                      바로 구매
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={addToCart}
                      disabled={addingToCart || (product.hasOptions ? selectedItems.length === 0 : isOutOfStock)}
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
          </div>

          {/* 탭 영역 */}
          <div className="mt-12">
            {/* 탭 버튼 - 3분할 */}
            <div className="grid grid-cols-3 border-b">
              <button
                onClick={() => setActiveTab('detail')}
                className={`py-4 text-base font-semibold border-b-2 -mb-px transition-colors text-center ${
                  activeTab === 'detail'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                상세정보
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className={`py-4 text-base font-semibold border-b-2 -mb-px transition-colors text-center flex items-center justify-center gap-2 ${
                  activeTab === 'review'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Star className="h-5 w-5" />
                리뷰 ({reviewTotal})
              </button>
              <button
                onClick={() => setActiveTab('qna')}
                className={`py-4 text-base font-semibold border-b-2 -mb-px transition-colors text-center flex items-center justify-center gap-2 ${
                  activeTab === 'qna'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="h-5 w-5" />
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
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.content) }}
                    />
                  ) : (
                    <p className="text-muted-foreground text-center py-12">
                      등록된 상세정보가 없습니다.
                    </p>
                  )}
                </div>
              )}

              {/* 리뷰 탭 */}
              {activeTab === 'review' && product && (
                <ShopReviewSection
                  slug={slug}
                  productId={product.id}
                  reviews={reviews}
                  reviewsLoading={reviewsLoading}
                  reviewTotal={reviewTotal}
                  avgRating={avgRating}
                  reviewPage={reviewPage}
                  reviewableOrders={reviewableOrders}
                  onFetchReviews={fetchReviews}
                  onFetchReviewableOrders={fetchReviewableOrders}
                />
              )}

              {/* Q&A 탭 */}
              {activeTab === 'qna' && (
                <ShopQnaSection
                  slug={slug}
                  qnas={qnas}
                  qnasLoading={qnasLoading}
                  qnaTotal={qnaTotal}
                  qnaPage={qnaPage}
                  onFetchQnas={fetchQnas}
                />
              )}
            </div>
          </div>
        </div>

        {/* 추천 상품 섹션 */}
        <div className="max-w-6xl mx-auto px-4 border-t">
          <RecentlyViewedProducts excludeId={product.id} />
          <PopularProducts excludeId={product.id} />
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
                장바구니로 이동하시겠습니까?
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
                onClick={() => router.push("/shop/cart")}
              >
                장바구니로 이동
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
