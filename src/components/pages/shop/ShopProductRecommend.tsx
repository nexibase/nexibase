"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, TrendingUp, Clock, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"

interface Product {
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  originPrice: number | null
  minPrice: number
  maxPrice: number
  image: string | null
  category: { id: number; name: string; slug: string } | null
  isSoldOut: boolean
  soldCount: number
  hasOptions: boolean
}

// localStorage 키
const VIEWED_PRODUCTS_KEY = 'shop_viewed_products'

// 최근 본 상품 저장 (상품 상세 페이지에서 호출)
export function saveViewedProduct(productId: number) {
  if (typeof window === 'undefined') return

  try {
    const stored = localStorage.getItem(VIEWED_PRODUCTS_KEY)
    let ids: number[] = stored ? JSON.parse(stored) : []

    // 이미 있으면 제거 후 맨 앞에 추가
    ids = ids.filter(id => id !== productId)
    ids.unshift(productId)

    // 최대 20개 유지
    ids = ids.slice(0, 20)

    localStorage.setItem(VIEWED_PRODUCTS_KEY, JSON.stringify(ids))
  } catch {
    // localStorage 에러 무시
  }
}

// 최근 본 상품 ID 목록 가져오기
export function getViewedProductIds(): number[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(VIEWED_PRODUCTS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// 인기 상품 섹션
export function PopularProducts({
  title = "인기 상품",
  limit = 12,
  excludeId
}: {
  title?: string
  limit?: number
  excludeId?: number
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const params = new URLSearchParams({
          type: 'popular',
          limit: String(limit),
          ...(excludeId && { exclude: String(excludeId) })
        })
        const res = await fetch(`/api/shop/products/recommend?${params}`)
        if (res.ok) {
          const data = await res.json()
          setProducts(data.products)
        }
      } catch (error) {
        console.error('인기 상품 조회 에러:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [limit, excludeId])

  if (loading || products.length === 0) return null

  return (
    <InfiniteProductSlider
      title={title}
      icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
      products={products}
    />
  )
}

// 신상품 섹션
export function NewProducts({
  title = "신상품",
  limit = 12,
  excludeId
}: {
  title?: string
  limit?: number
  excludeId?: number
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const params = new URLSearchParams({
          type: 'new',
          limit: String(limit),
          ...(excludeId && { exclude: String(excludeId) })
        })
        const res = await fetch(`/api/shop/products/recommend?${params}`)
        if (res.ok) {
          const data = await res.json()
          setProducts(data.products)
        }
      } catch (error) {
        console.error('신상품 조회 에러:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [limit, excludeId])

  if (loading || products.length === 0) return null

  return (
    <InfiniteProductSlider
      title={title}
      icon={<Sparkles className="h-5 w-5 text-purple-500" />}
      products={products}
    />
  )
}

// 최근 본 상품 섹션 (무한 롤링 아님)
export function RecentlyViewedProducts({
  title = "최근 본 상품",
  excludeId
}: {
  title?: string
  excludeId?: number
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProducts = useCallback(async () => {
    try {
      let ids = getViewedProductIds()
      if (excludeId) {
        ids = ids.filter(id => id !== excludeId)
      }

      if (ids.length === 0) {
        setLoading(false)
        return
      }

      const res = await fetch('/api/shop/products/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: ids })
      })

      if (res.ok) {
        const data = await res.json()
        setProducts(data.products)
      }
    } catch (error) {
      console.error('최근 본 상품 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [excludeId])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  if (loading || products.length === 0) return null

  return (
    <ProductSection
      title={title}
      icon={<Clock className="h-5 w-5 text-blue-500" />}
      products={products}
    />
  )
}

// 상품 카드 컴포넌트 (재사용)
function ProductCard({ product, formatPrice }: { product: Product; formatPrice: (price: number) => string }) {
  return (
    <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow group">
      <div className="relative aspect-square bg-muted">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        {product.isSoldOut && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold">품절</span>
          </div>
        )}
        {product.originPrice && product.originPrice > product.price && (
          <Badge className="absolute top-2 left-2 bg-red-500 text-xs">
            {Math.round((1 - product.price / product.originPrice) * 100)}%
          </Badge>
        )}
      </div>

      <CardContent className="p-3">
        {product.category && (
          <p className="text-xs text-muted-foreground mb-1">
            {product.category.name}
          </p>
        )}
        <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <div className="flex items-end gap-2">
          <span className="font-bold">
            {product.hasOptions && product.minPrice !== product.maxPrice
              ? `${formatPrice(product.minPrice)} ~`
              : formatPrice(product.price)
            }
          </span>
          {product.originPrice && product.originPrice > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.originPrice)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// 무한 롤링 상품 슬라이더
function InfiniteProductSlider({
  title,
  icon,
  products
}: {
  title: string
  icon: React.ReactNode
  products: Product[]
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isScrolling = useRef(false)

  const formatPrice = (price: number) => price.toLocaleString() + '원'

  // 상품을 3배로 복제 (앞뒤로 무한 스크롤을 위해)
  const extendedProducts = [...products, ...products, ...products]

  // 상품 카드 너비 계산 (gap 포함)
  const getItemWidth = useCallback(() => {
    if (!scrollRef.current) return 200
    const containerWidth = scrollRef.current.clientWidth
    const itemsPerView = containerWidth >= 1024 ? 4 : containerWidth >= 768 ? 3 : 2
    const gap = 16
    return (containerWidth - gap * (itemsPerView - 1)) / itemsPerView + gap
  }, [])

  // 중간 위치로 초기화 (products 길이만큼 offset)
  useEffect(() => {
    if (!scrollRef.current || products.length === 0) return
    const itemWidth = getItemWidth()
    const middleOffset = products.length * itemWidth
    scrollRef.current.scrollLeft = middleOffset
  }, [products.length, getItemWidth])

  // 스크롤 위치 감시 및 무한 루프 처리
  useEffect(() => {
    const container = scrollRef.current
    if (!container || products.length === 0) return

    const handleScroll = () => {
      if (isScrolling.current) return

      const itemWidth = getItemWidth()
      const singleSetWidth = products.length * itemWidth
      const currentScroll = container.scrollLeft

      // 첫 번째 세트 시작 부분에 도달하면 중간으로 점프
      if (currentScroll < singleSetWidth * 0.3) {
        isScrolling.current = true
        container.scrollLeft = currentScroll + singleSetWidth
        setTimeout(() => { isScrolling.current = false }, 50)
      }
      // 세 번째 세트 끝 부분에 도달하면 중간으로 점프
      else if (currentScroll > singleSetWidth * 2.3) {
        isScrolling.current = true
        container.scrollLeft = currentScroll - singleSetWidth
        setTimeout(() => { isScrolling.current = false }, 50)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [products.length, getItemWidth])

  const handlePrev = () => {
    if (!scrollRef.current) return
    const itemWidth = getItemWidth()
    const currentScroll = scrollRef.current.scrollLeft
    const targetIndex = Math.floor(currentScroll / itemWidth) - 1
    scrollRef.current.scrollTo({
      left: targetIndex * itemWidth,
      behavior: 'smooth'
    })
  }

  const handleNext = () => {
    if (!scrollRef.current) return
    const itemWidth = getItemWidth()
    const currentScroll = scrollRef.current.scrollLeft
    const targetIndex = Math.ceil(currentScroll / itemWidth) + 1
    scrollRef.current.scrollTo({
      left: targetIndex * itemWidth,
      behavior: 'smooth'
    })
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={handleNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {extendedProducts.map((product, index) => (
          <Link
            key={`${product.id}-${index}`}
            href={`/shop/products/${product.slug}`}
            className="flex-shrink-0 w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] snap-start"
          >
            <ProductCard product={product} formatPrice={formatPrice} />
          </Link>
        ))}
      </div>
    </div>
  )
}

// 일반 상품 섹션 (최근 본 상품용)
function ProductSection({
  title,
  icon,
  products
}: {
  title: string
  icon: React.ReactNode
  products: Product[]
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const formatPrice = (price: number) => price.toLocaleString() + '원'

  const checkScrollState = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
  }, [])

  useEffect(() => {
    checkScrollState()
    const ref = scrollRef.current
    if (ref) {
      ref.addEventListener('scroll', checkScrollState)
      return () => ref.removeEventListener('scroll', checkScrollState)
    }
  }, [checkScrollState])

  const getItemWidth = () => {
    if (!scrollRef.current) return 200
    const containerWidth = scrollRef.current.clientWidth
    const itemsPerView = containerWidth >= 1024 ? 4 : containerWidth >= 768 ? 3 : 2
    const gap = 16
    return (containerWidth - gap * (itemsPerView - 1)) / itemsPerView + gap
  }

  const handlePrev = () => {
    if (!scrollRef.current) return
    const itemWidth = getItemWidth()
    const currentScroll = scrollRef.current.scrollLeft
    const targetIndex = Math.floor(currentScroll / itemWidth) - 1
    scrollRef.current.scrollTo({
      left: Math.max(0, targetIndex * itemWidth),
      behavior: 'smooth'
    })
  }

  const handleNext = () => {
    if (!scrollRef.current) return
    const itemWidth = getItemWidth()
    const currentScroll = scrollRef.current.scrollLeft
    const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth
    const targetIndex = Math.ceil(currentScroll / itemWidth) + 1
    scrollRef.current.scrollTo({
      left: Math.min(maxScroll, targetIndex * itemWidth),
      behavior: 'smooth'
    })
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={handlePrev}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={handleNext}
            disabled={!canScrollRight}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/shop/products/${product.slug}`}
            className="flex-shrink-0 w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] snap-start"
          >
            <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow group">
              <div className="relative aspect-square bg-muted">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                {product.isSoldOut && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold">품절</span>
                  </div>
                )}
                {product.originPrice && product.originPrice > product.price && (
                  <Badge className="absolute top-2 left-2 bg-red-500 text-xs">
                    {Math.round((1 - product.price / product.originPrice) * 100)}%
                  </Badge>
                )}
              </div>

              <CardContent className="p-3">
                {product.category && (
                  <p className="text-xs text-muted-foreground mb-1">
                    {product.category.name}
                  </p>
                )}
                <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-end gap-2">
                  <span className="font-bold">
                    {product.hasOptions && product.minPrice !== product.maxPrice
                      ? `${formatPrice(product.minPrice)} ~`
                      : formatPrice(product.price)
                    }
                  </span>
                  {product.originPrice && product.originPrice > product.price && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatPrice(product.originPrice)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default { PopularProducts, NewProducts, RecentlyViewedProducts, saveViewedProduct, getViewedProductIds }
