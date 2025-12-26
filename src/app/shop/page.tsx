"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header, Footer } from "@/components/layout"
import { PopularProducts, NewProducts, RecentlyViewedProducts } from "@/components/pages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react"

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

interface Category {
  id: number
  name: string
  slug: string
  productCount: number
}

export default function ShopPage() {
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
      <ShopContent />
    </Suspense>
  )
}

function ShopContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const categorySlug = searchParams.get('category')
  const sortBy = searchParams.get('sort') || 'latest'
  const searchQuery = searchParams.get('search') || ''

  const [search, setSearch] = useState(searchQuery)

  // 기존 ?category= 쿼리파라미터로 접근 시 /shop/categories/[slug]로 리다이렉트
  useEffect(() => {
    if (categorySlug && categorySlug !== 'all') {
      router.replace(`/shop/categories/${categorySlug}`)
    }
  }, [categorySlug, router])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '12',
        sort: sortBy,
        ...(searchQuery && { search: searchQuery })
      })

      const res = await fetch(`/api/shop/products?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error('상품 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [page, sortBy, searchQuery])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/shop/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('카테고리 조회 에러:', error)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    setPage(1)
  }, [sortBy, searchQuery])

  const handleCategoryChange = (slug: string) => {
    if (slug && slug !== 'all') {
      router.push(`/shop/categories/${slug}`)
    } else {
      router.push('/shop')
    }
  }

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', sort)
    params.delete('page')
    router.push(`/shop?${params}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (search.trim()) {
      params.set('search', search.trim())
    } else {
      params.delete('search')
    }
    params.delete('page')
    router.push(`/shop?${params}`)
  }

  const formatPrice = (price: number) => price.toLocaleString() + '원'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* 헤더 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              쇼핑몰
            </h1>
            <p className="text-muted-foreground mt-1">
              신선한 상품을 만나보세요
            </p>
          </div>

          {/* 필터 영역 */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* 검색 */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="상품 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-20"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2"
                >
                  검색
                </Button>
              </div>
            </form>

            <div className="flex gap-2">
              {/* 카테고리 필터 */}
              <Select value="all" onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      {cat.name} ({cat.productCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 정렬 */}
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">최신순</SelectItem>
                  <SelectItem value="popular">인기순</SelectItem>
                  <SelectItem value="price_asc">낮은가격</SelectItem>
                  <SelectItem value="price_desc">높은가격</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 카테고리 태그 */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <Badge
                variant="default"
                className="cursor-pointer"
                onClick={() => handleCategoryChange('all')}
              >
                전체
              </Badge>
              {categories.map(cat => (
                <Badge
                  key={cat.id}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => handleCategoryChange(cat.slug)}
                >
                  {cat.name}
                </Badge>
              ))}
            </div>
          )}

          {/* 결과 정보 */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              총 {total}개의 상품
              {searchQuery && ` (검색: "${searchQuery}")`}
            </p>
          </div>

          {/* 상품 그리드 */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">상품이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <Link key={product.id} href={`/shop/products/${product.slug}`}>
                  <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow group">
                    {/* 이미지 */}
                    <div className="relative aspect-square bg-muted">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      {product.isSoldOut && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">품절</span>
                        </div>
                      )}
                      {product.originPrice && product.originPrice > product.price && (
                        <Badge className="absolute top-2 left-2 bg-red-500">
                          {Math.round((1 - product.price / product.originPrice) * 100)}%
                        </Badge>
                      )}
                    </div>

                    {/* 정보 */}
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
                        <span className="font-bold text-lg">
                          {product.hasOptions && product.minPrice !== product.maxPrice
                            ? `${formatPrice(product.minPrice)} ~`
                            : formatPrice(product.price)
                          }
                        </span>
                        {product.originPrice && product.originPrice > product.price && (
                          <span className="text-sm text-muted-foreground line-through">
                            {formatPrice(product.originPrice)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* 추천 섹션 */}
          <div className="border-t mt-8">
            <RecentlyViewedProducts />
            <PopularProducts title="인기 상품" />
            <NewProducts title="신상품" />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
