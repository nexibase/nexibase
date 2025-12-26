"use client"

import { useState, useEffect, useCallback } from "react"
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
  limit = 8,
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
    <ProductSection
      title={title}
      icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
      products={products}
    />
  )
}

// 신상품 섹션
export function NewProducts({
  title = "신상품",
  limit = 8,
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
    <ProductSection
      title={title}
      icon={<Sparkles className="h-5 w-5 text-purple-500" />}
      products={products}
    />
  )
}

// 최근 본 상품 섹션
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

// 공통 상품 섹션 컴포넌트
function ProductSection({
  title,
  icon,
  products
}: {
  title: string
  icon: React.ReactNode
  products: Product[]
}) {
  const [scrollIndex, setScrollIndex] = useState(0)
  const itemsPerView = 4
  const maxIndex = Math.max(0, products.length - itemsPerView)

  const handlePrev = () => setScrollIndex(prev => Math.max(0, prev - 1))
  const handleNext = () => setScrollIndex(prev => Math.min(maxIndex, prev + 1))

  const formatPrice = (price: number) => price.toLocaleString() + '원'

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {products.length > itemsPerView && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrev}
              disabled={scrollIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNext}
              disabled={scrollIndex >= maxIndex}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 gap-4"
          style={{
            transform: `translateX(-${scrollIndex * (100 / itemsPerView + 4)}%)`,
          }}
        >
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/shop/products/${product.slug}`}
              className="flex-shrink-0 w-[calc(25%-12px)] min-w-[180px]"
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
    </div>
  )
}

export default { PopularProducts, NewProducts, RecentlyViewedProducts, saveViewedProduct, getViewedProductIds }
