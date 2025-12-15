"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Truck,
  ArrowRight,
  Loader2,
  DollarSign,
  Users,
  BarChart3,
} from "lucide-react"

interface DashboardStats {
  products: {
    total: number
    active: number
    soldOut: number
  }
  orders: {
    total: number
    pending: number
    paid: number
    preparing: number
    shipping: number
    delivered: number
    cancelled: number
  }
  sales: {
    today: number
    week: number
    month: number
  }
  recentOrders: {
    id: number
    orderNo: string
    ordererName: string
    finalPrice: number
    status: string
    createdAt: string
    itemCount: number
  }[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "결제대기", color: "bg-yellow-500" },
  paid: { label: "결제완료", color: "bg-blue-500" },
  preparing: { label: "상품준비", color: "bg-indigo-500" },
  shipping: { label: "배송중", color: "bg-purple-500" },
  delivered: { label: "배송완료", color: "bg-green-500" },
  confirmed: { label: "구매확정", color: "bg-green-700" },
  cancelled: { label: "주문취소", color: "bg-gray-500" },
}

export default function ShopDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/shop/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error("통계 조회 에러:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => price.toLocaleString() + "원"
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              쇼핑몰 대시보드
            </h1>
            <p className="text-muted-foreground mt-1">
              쇼핑몰 현황을 한눈에 확인하세요
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <>
              {/* 매출 요약 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">오늘 매출</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatPrice(stats.sales.today)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">이번 주 매출</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatPrice(stats.sales.week)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/5 border-purple-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">이번 달 매출</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {formatPrice(stats.sales.month)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <BarChart3 className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 주문 현황 + 상품 현황 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 주문 현황 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      주문 현황
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <Link href="/admin/shop/orders?status=pending">
                        <div className="p-3 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm text-muted-foreground">결제대기</span>
                          </div>
                          <span className="text-xl font-bold text-yellow-600">
                            {stats.orders.pending}
                          </span>
                        </div>
                      </Link>

                      <Link href="/admin/shop/orders?status=paid">
                        <div className="p-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-muted-foreground">결제완료</span>
                          </div>
                          <span className="text-xl font-bold text-blue-600">
                            {stats.orders.paid}
                          </span>
                        </div>
                      </Link>

                      <Link href="/admin/shop/orders?status=preparing">
                        <div className="p-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-indigo-600" />
                            <span className="text-sm text-muted-foreground">상품준비</span>
                          </div>
                          <span className="text-xl font-bold text-indigo-600">
                            {stats.orders.preparing}
                          </span>
                        </div>
                      </Link>

                      <Link href="/admin/shop/orders?status=shipping">
                        <div className="p-3 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <Truck className="h-4 w-4 text-purple-600" />
                            <span className="text-sm text-muted-foreground">배송중</span>
                          </div>
                          <span className="text-xl font-bold text-purple-600">
                            {stats.orders.shipping}
                          </span>
                        </div>
                      </Link>
                    </div>

                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        총 주문: <span className="font-medium text-foreground">{stats.orders.total}건</span>
                      </div>
                      <Link href="/admin/shop/orders">
                        <Button variant="ghost" size="sm">
                          전체보기 <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                {/* 상품 현황 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      상품 현황
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">전체 상품</p>
                            <p className="text-xl font-bold">{stats.products.total}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-green-500/10">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-muted-foreground">판매중</span>
                          </div>
                          <span className="text-xl font-bold text-green-600">
                            {stats.products.active}
                          </span>
                        </div>

                        <div className="p-3 rounded-lg bg-red-500/10">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm text-muted-foreground">품절</span>
                          </div>
                          <span className="text-xl font-bold text-red-600">
                            {stats.products.soldOut}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t flex justify-end">
                      <Link href="/admin/shop/products">
                        <Button variant="ghost" size="sm">
                          상품관리 <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 최근 주문 */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      최근 주문
                    </CardTitle>
                    <Link href="/admin/shop/orders">
                      <Button variant="ghost" size="sm">
                        전체보기 <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {stats.recentOrders.length > 0 ? (
                    <div className="space-y-3">
                      {stats.recentOrders.map((order) => (
                        <Link
                          key={order.id}
                          href={`/admin/shop/orders/${order.id}`}
                          className="block p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{order.orderNo}</span>
                                  <Badge
                                    className={`${STATUS_LABELS[order.status]?.color || "bg-gray-500"} text-white text-xs`}
                                  >
                                    {STATUS_LABELS[order.status]?.label || order.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {order.ordererName} · {order.itemCount}개 상품
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatPrice(order.finalPrice)}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(order.createdAt)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      아직 주문이 없습니다.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 빠른 링크 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <Link href="/admin/shop/products">
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="font-medium">상품관리</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/admin/shop/categories">
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                      <span className="font-medium">카테고리</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/admin/shop/orders">
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <span className="font-medium">주문관리</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/admin/shop/settings">
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-primary" />
                      <span className="font-medium">쇼핑몰설정</span>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              데이터를 불러올 수 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
