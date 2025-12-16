"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header, Footer } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Package,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Eye,
  Heart,
  ShoppingCart,
  User,
} from "lucide-react"

// 주문 타입
interface Order {
  id: number
  orderNo: string
  totalPrice: number
  deliveryFee: number
  finalPrice: number
  status: string
  paymentMethod: string
  createdAt: string
  items: {
    id: number
    productName: string
    optionText: string | null
    price: number
    quantity: number
    productImage: string | null
    productSlug: string | null
  }[]
}

// 찜 아이템 타입
interface WishlistItem {
  id: number
  productId: number
  productName: string
  productSlug: string
  price: number
  originPrice: number | null
  image: string | null
  isActive: boolean
  isSoldOut: boolean
  createdAt: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "결제대기", color: "bg-yellow-500" },
  paid: { label: "결제완료", color: "bg-blue-500" },
  preparing: { label: "상품준비", color: "bg-indigo-500" },
  shipping: { label: "배송중", color: "bg-purple-500" },
  delivered: { label: "배송완료", color: "bg-green-500" },
  confirmed: { label: "구매확정", color: "bg-green-700" },
  cancelled: { label: "주문취소", color: "bg-gray-500" },
  refund_requested: { label: "환불요청", color: "bg-orange-500" },
  refunded: { label: "환불완료", color: "bg-red-500" },
}

export default function MyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL에서 탭 상태 읽기
  const tabParam = searchParams.get('tab')
  const activeTab = (tabParam === 'wishlist') ? tabParam : 'orders'

  // 주문 관련 상태
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersTotalPages, setOrdersTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")

  // 찜 관련 상태
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([])
  const [wishlistLoading, setWishlistLoading] = useState(true)
  const [wishlistPage, setWishlistPage] = useState(1)
  const [wishlistTotalPages, setWishlistTotalPages] = useState(1)
  const [removingId, setRemovingId] = useState<number | null>(null)

  // 탭 변경 핸들러
  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'orders') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    router.replace(`/shop/mypage${params.toString() ? `?${params}` : ''}`)
  }

  // 주문 목록 조회
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(ordersPage),
        limit: '10',
        ...(statusFilter && { status: statusFilter }),
      })

      const res = await fetch(`/api/shop/orders?${params}`)
      if (res.status === 401) {
        router.push('/login?redirect=/shop/mypage')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders)
        setOrdersTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('주문 목록 조회 에러:', error)
    } finally {
      setOrdersLoading(false)
    }
  }, [ordersPage, statusFilter, router])

  // 찜 목록 조회
  const fetchWishlist = useCallback(async () => {
    setWishlistLoading(true)
    try {
      const res = await fetch(`/api/shop/wishlist?page=${wishlistPage}&limit=12`)
      if (res.status === 401) {
        router.push('/login?redirect=/shop/mypage?tab=wishlist')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setWishlistItems(data.items)
        setWishlistTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('찜 목록 조회 에러:', error)
    } finally {
      setWishlistLoading(false)
    }
  }, [wishlistPage, router])

  // 탭에 따라 데이터 로드
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders()
    } else if (activeTab === 'wishlist') {
      fetchWishlist()
    }
  }, [activeTab, fetchOrders, fetchWishlist])

  // 상태 필터 변경 시 페이지 초기화
  useEffect(() => {
    setOrdersPage(1)
  }, [statusFilter])

  const formatPrice = (price: number) => price.toLocaleString() + '원'
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // 찜 해제
  const removeFromWishlist = async (productId: number) => {
    setRemovingId(productId)
    try {
      const res = await fetch(`/api/shop/wishlist?productId=${productId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setWishlistItems(wishlistItems.filter(item => item.productId !== productId))
      }
    } catch (error) {
      console.error('찜 해제 에러:', error)
    } finally {
      setRemovingId(null)
    }
  }

  // 장바구니에 추가
  const addToCart = async (item: WishlistItem) => {
    try {
      // 로컬 장바구니에 추가
      const cart = JSON.parse(localStorage.getItem('cart') || '[]')
      const existingIndex = cart.findIndex((c: { productId: number; optionId?: number }) =>
        c.productId === item.productId && !c.optionId
      )

      if (existingIndex >= 0) {
        cart[existingIndex].quantity += 1
      } else {
        cart.push({
          productId: item.productId,
          productName: item.productName,
          productSlug: item.productSlug,
          price: item.price,
          originPrice: item.originPrice,
          image: item.image,
          quantity: 1
        })
      }

      localStorage.setItem('cart', JSON.stringify(cart))
      window.dispatchEvent(new Event('cartUpdated'))
      alert('장바구니에 추가되었습니다.')
    } catch {
      alert('장바구니 추가에 실패했습니다.')
    }
  }

  // 썸네일 URL 생성
  const getThumbnailUrl = (url: string | null) => {
    if (!url) return '/placeholder.png'
    if (url.includes('imagedelivery.net') && !url.includes('/public')) {
      return url.replace(/\/[^/]+$/, '/w=200')
    }
    return url
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* 헤더 */}
          <div className="flex items-center gap-3 mb-6">
            <User className="h-7 w-7" />
            <h1 className="text-2xl font-bold">마이페이지</h1>
          </div>

          {/* 탭 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                주문내역
              </TabsTrigger>
              <TabsTrigger value="wishlist" className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                찜 목록
              </TabsTrigger>
            </TabsList>

            {/* 주문내역 탭 */}
            <TabsContent value="orders">
              {/* 필터 */}
              <div className="flex justify-end mb-4">
                <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="전체 상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([value, { label }]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 주문 목록 */}
              {ordersLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : orders.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">주문 내역이 없습니다.</p>
                    <Button onClick={() => router.push('/shop')}>
                      쇼핑하러 가기
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card key={order.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(order.createdAt)}
                            </p>
                            <p className="font-mono text-sm">{order.orderNo}</p>
                          </div>
                          <Badge className={STATUS_LABELS[order.status]?.color || 'bg-gray-500'}>
                            {STATUS_LABELS[order.status]?.label || order.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* 주문 상품 */}
                        {order.items.slice(0, 2).map((item) => (
                          <div key={item.id} className="flex gap-4">
                            {item.productSlug ? (
                              <Link
                                href={`/shop/${item.productSlug}`}
                                className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0 hover:ring-2 ring-primary transition-all"
                              >
                                {item.productImage ? (
                                  <img
                                    src={item.productImage}
                                    alt={item.productName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                )}
                              </Link>
                            ) : (
                              <div className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                                {item.productImage ? (
                                  <img
                                    src={item.productImage}
                                    alt={item.productName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              {item.productSlug ? (
                                <Link href={`/shop/${item.productSlug}`} className="font-medium line-clamp-1 hover:underline">
                                  {item.productName}
                                </Link>
                              ) : (
                                <h3 className="font-medium line-clamp-1">{item.productName}</h3>
                              )}
                              {item.optionText && (
                                <p className="text-sm text-muted-foreground">{item.optionText}</p>
                              )}
                              <p className="text-sm">
                                {formatPrice(item.price)} × {item.quantity}개
                              </p>
                            </div>
                          </div>
                        ))}
                        {order.items.length > 2 && (
                          <p className="text-sm text-muted-foreground">
                            외 {order.items.length - 2}개 상품
                          </p>
                        )}

                        {/* 결제 정보 및 버튼 */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div>
                            <p className="text-sm text-muted-foreground">결제금액</p>
                            <p className="font-bold text-lg">{formatPrice(order.finalPrice)}</p>
                          </div>
                          <Link href={`/shop/orders/${order.orderNo}`}>
                            <Button variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              상세보기
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* 주문 페이지네이션 */}
              {ordersTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                    disabled={ordersPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-4">
                    {ordersPage} / {ordersTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setOrdersPage(p => Math.min(ordersTotalPages, p + 1))}
                    disabled={ordersPage === ordersTotalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* 찜 목록 탭 */}
            <TabsContent value="wishlist">
              {wishlistLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : wishlistItems.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">찜한 상품이 없습니다.</p>
                    <Button onClick={() => router.push('/shop')}>
                      쇼핑하러 가기
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {wishlistItems.map((item) => (
                      <div key={item.id} className="group relative border rounded-lg overflow-hidden">
                        {/* 상품 이미지 */}
                        <Link href={`/shop/${item.productSlug}`}>
                          <div className="aspect-square relative bg-muted">
                            <img
                              src={getThumbnailUrl(item.image)}
                              alt={item.productName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {/* 품절 오버레이 */}
                            {(item.isSoldOut || !item.isActive) && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Badge variant="secondary" className="text-sm">
                                  {!item.isActive ? "판매중지" : "품절"}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </Link>

                        {/* 찜 해제 버튼 */}
                        <button
                          onClick={() => removeFromWishlist(item.productId)}
                          disabled={removingId === item.productId}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors"
                          title="찜 해제"
                        >
                          {removingId === item.productId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                          )}
                        </button>

                        {/* 상품 정보 */}
                        <div className="p-3">
                          <Link href={`/shop/${item.productSlug}`}>
                            <h3 className="text-sm font-medium line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                              {item.productName}
                            </h3>
                          </Link>
                          <div className="flex items-baseline gap-1 mb-3">
                            {item.originPrice && item.originPrice > item.price && (
                              <span className="text-xs text-muted-foreground line-through">
                                {formatPrice(item.originPrice)}
                              </span>
                            )}
                            <span className="text-sm font-bold text-primary">
                              {formatPrice(item.price)}
                            </span>
                          </div>

                          {/* 장바구니 버튼 */}
                          {item.isActive && !item.isSoldOut && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => addToCart(item)}
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              장바구니
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 찜 페이지네이션 */}
                  {wishlistTotalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-8">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWishlistPage(p => Math.max(1, p - 1))}
                        disabled={wishlistPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        이전
                      </Button>
                      <span className="flex items-center px-4 text-sm">
                        {wishlistPage} / {wishlistTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWishlistPage(p => Math.min(wishlistTotalPages, p + 1))}
                        disabled={wishlistPage >= wishlistTotalPages}
                      >
                        다음
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  )
}
