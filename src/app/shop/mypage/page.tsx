"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
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
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Star,
  Bell,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

// 주소록 타입
interface UserAddress {
  id: number
  name: string
  recipientName: string
  recipientPhone: string
  zipCode: string
  address: string
  addressDetail: string | null
  isDefault: boolean
  createdAt: string
}

// 알림 타입
interface Notification {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
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

function MyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL에서 탭 상태 읽기
  const tabParam = searchParams.get('tab')
  const activeTab = (tabParam === 'wishlist' || tabParam === 'addresses' || tabParam === 'notifications') ? tabParam : 'orders'

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

  // 주소록 관련 상태
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null)
  const [addressForm, setAddressForm] = useState({
    name: '',
    recipientName: '',
    recipientPhone: '',
    zipCode: '',
    address: '',
    addressDetail: '',
    isDefault: false,
  })
  const [addressSaving, setAddressSaving] = useState(false)
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null)

  // 알림 관련 상태
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [notificationsPage, setNotificationsPage] = useState(1)
  const [notificationsTotalPages, setNotificationsTotalPages] = useState(1)

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

  // 주소록 조회
  const fetchAddresses = useCallback(async () => {
    setAddressesLoading(true)
    try {
      const res = await fetch('/api/shop/addresses')
      if (res.status === 401) {
        router.push('/login?redirect=/shop/mypage?tab=addresses')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setAddresses(data.addresses)
      }
    } catch (error) {
      console.error('주소록 조회 에러:', error)
    } finally {
      setAddressesLoading(false)
    }
  }, [router])

  // 알림 목록 조회
  const fetchNotifications = useCallback(async () => {
    setNotificationsLoading(true)
    try {
      const res = await fetch(`/api/notifications?page=${notificationsPage}&limit=20`)
      if (res.status === 401) {
        router.push('/login?redirect=/shop/mypage?tab=notifications')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
        setNotificationsTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('알림 목록 조회 에러:', error)
    } finally {
      setNotificationsLoading(false)
    }
  }, [notificationsPage, router])

  // 알림 읽음 처리
  const markAsRead = async (notificationId: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })
      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ))
    } catch (error) {
      console.error('알림 읽음 처리 에러:', error)
    }
  }

  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      setNotifications(notifications.map(n => ({ ...n, isRead: true })))
    } catch (error) {
      console.error('알림 읽음 처리 에러:', error)
    }
  }

  // 알림 클릭 처리
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  // 탭에 따라 데이터 로드
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders()
    } else if (activeTab === 'wishlist') {
      fetchWishlist()
    } else if (activeTab === 'addresses') {
      fetchAddresses()
    } else if (activeTab === 'notifications') {
      fetchNotifications()
    }
  }, [activeTab, fetchOrders, fetchWishlist, fetchAddresses, fetchNotifications])

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

  // 주소 추가/수정 모달 열기
  const openAddressModal = (address?: UserAddress) => {
    if (address) {
      setEditingAddress(address)
      setAddressForm({
        name: address.name,
        recipientName: address.recipientName,
        recipientPhone: address.recipientPhone,
        zipCode: address.zipCode,
        address: address.address,
        addressDetail: address.addressDetail || '',
        isDefault: address.isDefault,
      })
    } else {
      setEditingAddress(null)
      setAddressForm({
        name: '',
        recipientName: '',
        recipientPhone: '',
        zipCode: '',
        address: '',
        addressDetail: '',
        isDefault: false,
      })
    }
    setAddressModalOpen(true)
  }

  // 주소 저장
  const saveAddress = async () => {
    if (!addressForm.name || !addressForm.recipientName || !addressForm.recipientPhone ||
        !addressForm.zipCode || !addressForm.address) {
      alert('필수 항목을 모두 입력해주세요.')
      return
    }

    setAddressSaving(true)
    try {
      const url = editingAddress
        ? `/api/shop/addresses/${editingAddress.id}`
        : '/api/shop/addresses'
      const method = editingAddress ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressForm),
      })

      if (res.ok) {
        setAddressModalOpen(false)
        fetchAddresses()
      } else {
        const data = await res.json()
        alert(data.error || '주소 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('주소 저장 에러:', error)
      alert('주소 저장 중 오류가 발생했습니다.')
    } finally {
      setAddressSaving(false)
    }
  }

  // 주소 삭제
  const deleteAddress = async (id: number) => {
    if (!confirm('이 주소를 삭제하시겠습니까?')) return

    setDeletingAddressId(id)
    try {
      const res = await fetch(`/api/shop/addresses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchAddresses()
      } else {
        const data = await res.json()
        alert(data.error || '주소 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('주소 삭제 에러:', error)
    } finally {
      setDeletingAddressId(null)
    }
  }

  // 전화번호 자동 포맷팅
  const formatPhoneNumber = (value: string): string => {
    const numbers = value.replace(/[^0-9]/g, '')
    if (/^(15|16|17|18)/.test(numbers)) {
      if (numbers.length <= 4) return numbers
      return `${numbers.slice(0, 4)}-${numbers.slice(4, 8)}`
    }
    if (numbers.startsWith('02')) {
      if (numbers.length <= 2) return numbers
      if (numbers.length <= 6) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`
      if (numbers.length <= 10) return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`
    }
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    if (numbers.length <= 11) return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
  }

  // 다음 주소 검색 API (주소록용)
  const searchAddressForForm = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (typeof window !== "undefined" && win.daum?.Postcode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new win.daum.Postcode({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oncomplete: (data: any) => {
          setAddressForm(prev => ({
            ...prev,
            zipCode: data.zonecode,
            address: data.roadAddress || data.jibunAddress,
          }))
        },
      }).open()
    } else {
      const script = document.createElement("script")
      script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win2 = window as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new win2.daum.Postcode({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          oncomplete: (data: any) => {
            setAddressForm(prev => ({
              ...prev,
              zipCode: data.zonecode,
              address: data.roadAddress || data.jibunAddress,
            }))
          },
        }).open()
      }
      document.head.appendChild(script)
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
            <TabsList className="mb-6 w-full h-auto grid grid-cols-2 sm:grid-cols-4 gap-1 p-1">
              <TabsTrigger value="orders" className="flex items-center justify-center gap-2 py-2">
                <ShoppingBag className="h-4 w-4" />
                <span>주문내역</span>
              </TabsTrigger>
              <TabsTrigger value="wishlist" className="flex items-center justify-center gap-2 py-2">
                <Heart className="h-4 w-4" />
                <span>찜 목록</span>
              </TabsTrigger>
              <TabsTrigger value="addresses" className="flex items-center justify-center gap-2 py-2">
                <MapPin className="h-4 w-4" />
                <span>배송지</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center justify-center gap-2 py-2">
                <Bell className="h-4 w-4" />
                <span>알림</span>
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

                          {/* 구매하기 버튼 */}
                          {item.isActive && !item.isSoldOut && (
                            <Link href={`/shop/${item.productSlug}`} className="block">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                <ShoppingCart className="h-4 w-4 mr-1" />
                                구매하기
                              </Button>
                            </Link>
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

            {/* 주소록 탭 */}
            <TabsContent value="addresses">
              {/* 주소 추가 버튼 */}
              <div className="flex justify-end mb-4">
                <Button onClick={() => openAddressModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  새 주소 추가
                </Button>
              </div>

              {addressesLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : addresses.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <MapPin className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">등록된 배송지가 없습니다.</p>
                    <Button onClick={() => openAddressModal()}>
                      <Plus className="h-4 w-4 mr-2" />
                      배송지 추가하기
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {addresses.map((addr) => (
                    <Card key={addr.id} className={addr.isDefault ? 'ring-2 ring-primary' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium">{addr.name}</h3>
                              {addr.isDefault && (
                                <Badge variant="default" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  기본 배송지
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">
                              {addr.recipientName} | {addr.recipientPhone}
                            </p>
                            <p className="text-sm">
                              [{addr.zipCode}] {addr.address}
                              {addr.addressDetail && `, ${addr.addressDetail}`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAddressModal(addr)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteAddress(addr.id)}
                              disabled={deletingAddressId === addr.id}
                            >
                              {deletingAddressId === addr.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 알림 탭 */}
            <TabsContent value="notifications">
              {/* 헤더 */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-muted-foreground">
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <span className="text-primary font-medium">
                      {notifications.filter(n => !n.isRead).length}개의 읽지 않은 알림
                    </span>
                  )}
                </span>
                {notifications.some(n => !n.isRead) && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                    모두 읽음
                  </Button>
                )}
              </div>

              {notificationsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : notifications.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Bell className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">알림이 없습니다.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <Card
                      key={notification.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${!notification.isRead ? 'border-primary/30 bg-primary/5' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                          )}
                          <div className={`flex-1 ${notification.isRead ? 'ml-5' : ''}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{notification.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {notification.type === 'order_status' ? '주문' :
                                  notification.type === 'review_reply' ? '리뷰' :
                                    notification.type === 'qna_reply' ? 'Q&A' : '시스템'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(notification.createdAt).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* 페이지네이션 */}
                  {notificationsTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={notificationsPage === 1}
                        onClick={() => setNotificationsPage(p => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        {notificationsPage} / {notificationsTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={notificationsPage === notificationsTotalPages}
                        onClick={() => setNotificationsPage(p => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* 주소 추가/수정 모달 */}
      <Dialog open={addressModalOpen} onOpenChange={setAddressModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? '배송지 수정' : '새 배송지 추가'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="addressName">배송지명 *</Label>
              <Input
                id="addressName"
                placeholder="예: 집, 회사"
                value={addressForm.name}
                onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="recipientName">받는 분 *</Label>
                <Input
                  id="recipientName"
                  placeholder="이름"
                  value={addressForm.recipientName}
                  onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="recipientPhone">연락처 *</Label>
                <Input
                  id="recipientPhone"
                  placeholder="010-0000-0000"
                  value={addressForm.recipientPhone}
                  onChange={(e) => setAddressForm({ ...addressForm, recipientPhone: formatPhoneNumber(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>주소 *</Label>
              <div className="flex gap-2">
                <Input
                  value={addressForm.zipCode}
                  placeholder="우편번호"
                  className="w-28"
                  readOnly
                />
                <Button type="button" variant="outline" onClick={searchAddressForForm}>
                  주소 검색
                </Button>
              </div>
            </div>
            <Input
              value={addressForm.address}
              placeholder="기본 주소"
              readOnly
            />
            <Input
              value={addressForm.addressDetail}
              placeholder="상세 주소 (선택)"
              onChange={(e) => setAddressForm({ ...addressForm, addressDetail: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={addressForm.isDefault}
                onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isDefault" className="text-sm cursor-pointer">
                기본 배송지로 설정
              </label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAddressModalOpen(false)}
              >
                취소
              </Button>
              <Button
                className="flex-1"
                onClick={saveAddress}
                disabled={addressSaving}
              >
                {addressSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingAddress ? '수정' : '추가'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}

export default function MyPage() {
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
      <MyPageContent />
    </Suspense>
  )
}
