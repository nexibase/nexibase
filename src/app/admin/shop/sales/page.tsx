"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  TrendingUp,
  TrendingDown,
  Package,
  Eye,
  RefreshCw,
  DollarSign,
  ShoppingCart,
  CreditCard,
  Wallet,
  BarChart3,
  FileText,
  Calculator,
  Download,
} from "lucide-react"

interface SummaryData {
  summary: {
    totalSales: number
    orderCount: number
    averageOrderValue: number
    cancelledCount: number
    refundedAmount: number
    netSales: number
    growthRate: string | null
  }
  dailySales: { date: string; amount: number; count: number }[]
  topProducts: { productId: number; productName: string; productSlug: string; thumbnail: string | null; totalQty: number; totalAmount: number }[]
  period: { from: string; to: string }
}

interface Order {
  id: number
  orderNo: string
  ordererName: string
  ordererPhone: string
  recipientName: string
  totalPrice: number
  deliveryFee: number
  finalPrice: number
  status: string
  paymentMethod: string
  paidAt: string
  createdAt: string
  items: {
    id: number
    productName: string
    quantity: number
    subtotal: number
    productImage: string | null
  }[]
  user: {
    id: number
    nickname: string
    email: string
  }
}

interface OrdersData {
  orders: Order[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  period: { from: string; to: string }
}

interface SettlementData {
  settlement: {
    totalAmount: number
    productAmount: number
    deliveryFeeTotal: number
    orderCount: number
    pgFee: number
    netSettlement: number
    paymentMethods: {
      card: { amount: number; count: number; fee: number; feeRate: number }
      bank: { amount: number; count: number; fee: number; feeRate: number }
    }
  }
  period: { from: string; to: string }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  delivered: { label: "배송완료", color: "bg-green-500" },
  confirmed: { label: "구매확정", color: "bg-green-700" },
}

const PERIOD_OPTIONS = [
  { value: 'today', label: '오늘' },
  { value: 'yesterday', label: '어제' },
  { value: 'week', label: '최근 7일' },
  { value: 'prev_week', label: '지난 주' },
  { value: 'this_week', label: '이번 주' },
  { value: 'prev_month', label: '지난 달' },
  { value: 'month', label: '이번 달' },
  { value: 'year', label: '올해' },
  { value: 'custom', label: '직접 선택' },
]

export default function AdminSalesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = searchParams.get('tab') || 'summary'
  const periodParam = searchParams.get('period') || 'month'
  const [activeTab, setActiveTab] = useState(tabParam)
  const [period, setPeriod] = useState(periodParam)
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')

  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [ordersData, setOrdersData] = useState<OrdersData | null>(null)
  const [settlementData, setSettlementData] = useState<SettlementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        tab: activeTab,
        period,
        page: String(page),
        limit: '20',
        ...(search && { search }),
        ...(period === 'custom' && customDateFrom && { startDate: customDateFrom }),
        ...(period === 'custom' && customDateTo && { endDate: customDateTo }),
      })

      const res = await fetch(`/api/admin/shop/sales?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (activeTab === 'summary') {
          setSummaryData(data)
        } else if (activeTab === 'orders') {
          setOrdersData(data)
        } else if (activeTab === 'settlement') {
          setSettlementData(data)
        }
      }
    } catch (error) {
      console.error('매출 데이터 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [activeTab, period, page, search, customDateFrom, customDateTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setPage(1)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`/admin/shop/sales?${params}`)
  }

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    setPage(1)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const formatPrice = (price: number) => price.toLocaleString() + '원'
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }
  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleExportExcel = async () => {
    // 엑셀 다운로드 구현 (추후)
    alert('엑셀 다운로드 기능은 준비 중입니다.')
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                매출 관리
              </h1>
              <p className="text-muted-foreground">
                배송완료 및 구매확정된 주문의 매출 현황
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExportExcel}>
                <Download className="h-4 w-4 mr-2" />
                엑셀 다운로드
              </Button>
              <Button variant="outline" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                새로고침
              </Button>
            </div>
          </div>

          {/* 기간 선택 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">기간:</span>
                  <Select value={period} onValueChange={handlePeriodChange}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {period === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={customDateFrom}
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      className="w-[160px]"
                    />
                    <span>~</span>
                    <Input
                      type="date"
                      value={customDateTo}
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      className="w-[160px]"
                    />
                    <Button onClick={fetchData}>조회</Button>
                  </div>
                )}
                {summaryData?.period && (
                  <span className="text-sm text-muted-foreground">
                    {formatDate(summaryData.period.from)} ~ {formatDate(summaryData.period.to)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 탭 */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => handleTabChange('summary')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'summary'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="h-4 w-4 inline mr-2" />
              요약
            </button>
            <button
              onClick={() => handleTabChange('orders')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'orders'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              주문 내역
            </button>
            <button
              onClick={() => handleTabChange('settlement')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'settlement'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calculator className="h-4 w-4 inline mr-2" />
              정산
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* 요약 탭 */}
              {activeTab === 'summary' && summaryData && (
                <div className="space-y-6">
                  {/* 주요 지표 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">총 매출</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatPrice(summaryData.summary.totalSales)}
                        </div>
                        {summaryData.summary.growthRate && (
                          <p className={`text-xs flex items-center gap-1 ${
                            parseFloat(summaryData.summary.growthRate) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {parseFloat(summaryData.summary.growthRate) >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            전월 대비 {summaryData.summary.growthRate}%
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">주문 건수</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {summaryData.summary.orderCount.toLocaleString()}건
                        </div>
                        <p className="text-xs text-muted-foreground">
                          취소 {summaryData.summary.cancelledCount}건
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">평균 주문금액</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatPrice(summaryData.summary.averageOrderValue)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">순 매출</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatPrice(summaryData.summary.netSales)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          환불 {formatPrice(summaryData.summary.refundedAmount)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 일별 매출 & 인기 상품 */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* 일별 매출 */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">일별 매출 (최근 30일)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {summaryData.dailySales.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            매출 데이터가 없습니다.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {summaryData.dailySales.slice(0, 14).map((day) => (
                              <div
                                key={day.date}
                                className="flex items-center justify-between py-2 border-b last:border-0"
                              >
                                <div>
                                  <span className="font-medium">{formatDate(day.date)}</span>
                                  <span className="text-sm text-muted-foreground ml-2">
                                    ({day.count}건)
                                  </span>
                                </div>
                                <span className="font-medium">{formatPrice(day.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* 인기 상품 */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">인기 상품 TOP 10</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {summaryData.topProducts.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            판매 데이터가 없습니다.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {summaryData.topProducts.map((product, idx) => (
                              <Link
                                key={product.productId}
                                href={`/admin/shop/products/${product.productId}`}
                                className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                    idx < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  {product.thumbnail ? (
                                    <img
                                      src={product.thumbnail}
                                      alt=""
                                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <span className="font-medium line-clamp-1">
                                    {product.productName}
                                  </span>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="font-medium">{product.totalQty}개</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatPrice(product.totalAmount)}
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* 주문 내역 탭 */}
              {activeTab === 'orders' && ordersData && (
                <div className="space-y-4">
                  {/* 검색 */}
                  <Card>
                    <CardContent className="pt-6">
                      <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1 max-w-md">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="주문번호, 주문자명, 연락처 검색..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Button type="submit">검색</Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* 주문 목록 */}
                  <Card>
                    <CardContent className="p-0">
                      {ordersData.orders.length === 0 ? (
                        <div className="text-center py-20">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">주문이 없습니다.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[140px]">주문번호</TableHead>
                              <TableHead>주문상품</TableHead>
                              <TableHead>주문자</TableHead>
                              <TableHead className="text-right">결제금액</TableHead>
                              <TableHead>결제방법</TableHead>
                              <TableHead>상태</TableHead>
                              <TableHead>결제일시</TableHead>
                              <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ordersData.orders.map((order) => (
                              <TableRow key={order.id}>
                                <TableCell>
                                  <div className="font-mono text-sm leading-tight">
                                    <div>{order.orderNo.split('-')[0]}</div>
                                    <div className="text-muted-foreground">-{order.orderNo.split('-')[1]}</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {order.items[0]?.productImage ? (
                                      <img
                                        src={order.items[0].productImage}
                                        alt=""
                                        className="w-10 h-10 rounded object-cover"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                        <Package className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div>
                                      <p className="font-medium line-clamp-1">
                                        {order.items[0]?.productName}
                                        {order.items.length > 1 && ` 외 ${order.items.length - 1}건`}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        총 {order.items.reduce((sum, item) => sum + item.quantity, 0)}개
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{order.ordererName}</p>
                                    <p className="text-xs text-muted-foreground">{order.ordererPhone}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatPrice(order.finalPrice)}
                                </TableCell>
                                <TableCell>
                                  {order.paymentMethod === 'bank' ? '무통장' : '카드'}
                                </TableCell>
                                <TableCell>
                                  <Badge className={STATUS_LABELS[order.status]?.color || 'bg-gray-500'}>
                                    {STATUS_LABELS[order.status]?.label || order.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {order.paidAt ? formatDateTime(order.paidAt) : '-'}
                                </TableCell>
                                <TableCell>
                                  <Link href={`/admin/shop/orders/${order.orderNo}`}>
                                    <Button variant="ghost" size="icon">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  {/* 페이지네이션 */}
                  {ordersData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground px-4">
                        {page} / {ordersData.pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPage(p => Math.min(ordersData.pagination.totalPages, p + 1))}
                        disabled={page === ordersData.pagination.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 정산 탭 */}
              {activeTab === 'settlement' && settlementData && (
                <div className="space-y-6">
                  {/* 정산 요약 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">총 결제금액</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatPrice(settlementData.settlement.totalAmount)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {settlementData.settlement.orderCount}건
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">상품금액</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatPrice(settlementData.settlement.productAmount)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          배송비 {formatPrice(settlementData.settlement.deliveryFeeTotal)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600">PG 수수료</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          -{formatPrice(settlementData.settlement.pgFee)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          카드 결제 3.3%
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-primary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-primary">실 정산금액</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-primary">
                          {formatPrice(settlementData.settlement.netSettlement)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          총 결제금액 - PG 수수료
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 결제수단별 내역 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">결제수단별 내역</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>결제수단</TableHead>
                            <TableHead className="text-right">결제건수</TableHead>
                            <TableHead className="text-right">결제금액</TableHead>
                            <TableHead className="text-right">수수료율</TableHead>
                            <TableHead className="text-right">수수료</TableHead>
                            <TableHead className="text-right">정산금액</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                카드 결제
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {settlementData.settlement.paymentMethods.card.count}건
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPrice(settlementData.settlement.paymentMethods.card.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              {settlementData.settlement.paymentMethods.card.feeRate}%
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              -{formatPrice(settlementData.settlement.paymentMethods.card.fee)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatPrice(
                                settlementData.settlement.paymentMethods.card.amount -
                                settlementData.settlement.paymentMethods.card.fee
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4" />
                                무통장 입금
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {settlementData.settlement.paymentMethods.bank.count}건
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPrice(settlementData.settlement.paymentMethods.bank.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              {settlementData.settlement.paymentMethods.bank.feeRate}%
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              0원
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatPrice(settlementData.settlement.paymentMethods.bank.amount)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>합계</TableCell>
                            <TableCell className="text-right">
                              {settlementData.settlement.orderCount}건
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPrice(settlementData.settlement.totalAmount)}
                            </TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right text-red-600">
                              -{formatPrice(settlementData.settlement.pgFee)}
                            </TableCell>
                            <TableCell className="text-right text-primary">
                              {formatPrice(settlementData.settlement.netSettlement)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* 안내 */}
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>* 정산금액은 배송완료 및 구매확정된 주문 기준입니다.</p>
                        <p>* PG 수수료는 카드 결제 기준 3.3%로 계산됩니다. (실제 수수료율은 계약에 따라 다를 수 있습니다)</p>
                        <p>* 환불/취소된 주문은 정산에서 제외됩니다.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
