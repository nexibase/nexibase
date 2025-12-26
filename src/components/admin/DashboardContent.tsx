"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart3, Users, MessageSquare, TrendingUp, Loader2, LayoutDashboard,
  ShoppingCart, Package, DollarSign, Clock, Eye, ThumbsUp, Star
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface DashboardData {
  stats: {
    totalUsers: number
    userGrowth: number
    totalPosts: number
    postGrowth: number
    activeUsers: number
    activeUserGrowth: number
  }
  shopStats: {
    totalOrders: number
    thisMonthOrders: number
    orderGrowth: number
    totalRevenue: number
    thisMonthRevenue: number
    revenueGrowth: number
    totalProducts: number
    pendingOrders: number
  }
  recentUsers: {
    id: number
    nickname: string
    email: string
    image: string | null
    createdAt: string
  }[]
  recentPosts: {
    id: number
    title: string
    createdAt: string
    author: { nickname: string }
    board: { slug: string }
  }[]
  recentOrders: {
    id: number
    orderNo: string
    finalPrice: number
    status: string
    createdAt: string
    user: { nickname: string }
  }[]
  popularProducts: {
    id: number
    name: string
    slug: string
    price: number
    soldCount: number
    viewCount: number
    image: string | null
  }[]
  popularPosts: {
    id: number
    title: string
    viewCount: number
    likeCount: number
    commentCount: number
    board: { slug: string; name: string }
  }[]
  trends: {
    orders: { date: string; orders: number; revenue: number }[]
    users: { date: string; count: number }[]
  }
}

const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '결제대기', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: '결제완료', color: 'bg-blue-100 text-blue-800' },
  preparing: { label: '상품준비', color: 'bg-purple-100 text-purple-800' },
  shipped: { label: '배송중', color: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: '배송완료', color: 'bg-green-100 text-green-800' },
  cancelled: { label: '취소', color: 'bg-red-100 text-red-800' },
  refunded: { label: '환불', color: 'bg-gray-100 text-gray-800' },
}

export function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/admin/dashboard")
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to fetch")
        setData(json)
      } catch (err) {
        setError("데이터를 불러오는데 실패했습니다.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{error || "데이터를 불러올 수 없습니다."}</p>
      </div>
    )
  }

  const formatGrowth = (value: number) => {
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value}%`
  }

  const formatTimeAgo = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ko })
  }

  const formatPrice = (price: number) => price.toLocaleString() + '원'

  // 차트용 최대값 계산
  const maxOrders = Math.max(...(data.trends?.orders?.map(d => d.orders) || []), 1)
  const maxRevenue = Math.max(...(data.trends?.orders?.map(d => d.revenue) || []), 1)
  const maxUsers = Math.max(...(data.trends?.users?.map(d => d.count) || []), 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" />
          대시보드
        </h1>
        <p className="text-muted-foreground mt-1">관리자 패널에 오신 것을 환영합니다.</p>
      </div>

      {/* 기본 통계 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/users">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 회원수</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className={data.stats.userGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatGrowth(data.stats.userGrowth)}
                </span> 지난달 대비
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/boards">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 게시글</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.totalPosts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className={data.stats.postGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatGrowth(data.stats.postGrowth)}
                </span> 지난주 대비
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">오늘 활성 사용자</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.activeUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className={data.stats.activeUserGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatGrowth(data.stats.activeUserGrowth)}
                </span> 어제 대비
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">시스템 상태</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">정상</div>
            <p className="text-xs text-muted-foreground">
              모든 서비스 운영 중
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 쇼핑몰 통계 카드들 */}
      {data.shopStats && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            쇼핑몰 현황
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/shop/orders">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">이번달 주문</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.shopStats.thisMonthOrders.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={data.shopStats.orderGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatGrowth(data.shopStats.orderGrowth)}
                    </span> 지난달 대비
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/shop/sales">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">이번달 매출</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPrice(data.shopStats.thisMonthRevenue)}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={data.shopStats.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatGrowth(data.shopStats.revenueGrowth)}
                    </span> 지난달 대비
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/shop/products">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">등록 상품</CardTitle>
                  <Package className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.shopStats.totalProducts.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    활성화된 상품
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/shop/orders?status=paid">
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-orange-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">처리 대기</CardTitle>
                  <Clock className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{data.shopStats.pendingOrders.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    결제완료 주문
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      )}

      {/* 추이 차트 */}
      {data.trends && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 주문/매출 추이 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">최근 7일 주문 추이</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.trends.orders?.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground w-20">
                        {new Date(item.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="font-medium">{item.orders}건</span>
                      <span className="text-muted-foreground">{formatPrice(item.revenue)}</span>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div
                        className="bg-blue-500 rounded-full transition-all"
                        style={{ width: `${(item.orders / maxOrders) * 50}%` }}
                      />
                      <div
                        className="bg-green-500 rounded-full transition-all"
                        style={{ width: `${(item.revenue / maxRevenue) * 50}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-full" /> 주문수
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full" /> 매출
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 신규 가입자 추이 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">최근 7일 신규 가입자</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.trends.users?.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground w-20">
                        {new Date(item.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="font-medium">{item.count}명</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(item.count / maxUsers) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 최근 활동 & 인기 콘텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 주문 */}
        {data.recentOrders && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>최근 주문</CardTitle>
              <Link href="/admin/shop/orders" className="text-sm text-muted-foreground hover:text-primary">
                전체보기
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recentOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">최근 주문이 없습니다.</p>
                ) : (
                  data.recentOrders.map((order) => (
                    <Link key={order.id} href={`/admin/shop/orders/${order.id}`} className="flex items-center justify-between hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <ShoppingCart className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{order.orderNo}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.user.nickname} • {formatTimeAgo(order.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatPrice(order.finalPrice)}</p>
                        <Badge variant="secondary" className={ORDER_STATUS_MAP[order.status]?.color || ''}>
                          {ORDER_STATUS_MAP[order.status]?.label || order.status}
                        </Badge>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 최근 가입 회원 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>최근 가입 회원</CardTitle>
            <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-primary">
              전체보기
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">최근 가입한 회원이 없습니다.</p>
              ) : (
                data.recentUsers.map((user) => (
                  <Link key={user.id} href={`/admin/users?edit=${user.id}`} className="flex items-center space-x-4 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.nickname}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.nickname}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(user.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 인기 콘텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 인기 상품 */}
        {data.popularProducts && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                인기 상품
              </CardTitle>
              <Link href="/admin/shop/products" className="text-sm text-muted-foreground hover:text-primary">
                전체보기
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.popularProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">상품이 없습니다.</p>
                ) : (
                  data.popularProducts.map((product, idx) => (
                    <Link key={product.id} href={`/admin/shop/products/${product.id}`} className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                      <span className="text-sm font-bold text-muted-foreground w-5">{idx + 1}</span>
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(product.price)}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p className="flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3" /> {product.soldCount}
                        </p>
                        <p className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {product.viewCount}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 인기 게시글 */}
        {data.popularPosts && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-500" />
                인기 게시글
              </CardTitle>
              <Link href="/popular" className="text-sm text-muted-foreground hover:text-primary">
                전체보기
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.popularPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">게시글이 없습니다.</p>
                ) : (
                  data.popularPosts.map((post, idx) => (
                    <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`} className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                      <span className="text-sm font-bold text-muted-foreground w-5">{idx + 1}</span>
                      <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground">{post.board.name}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {post.viewCount}
                        </p>
                        <p className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" /> {post.likeCount}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
