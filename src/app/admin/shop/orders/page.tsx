"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
  Eye,
  RefreshCw,
  Trash2,
  RotateCcw,
} from "lucide-react"

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
  createdAt: string
  items: {
    id: number
    productName: string
    quantity: number
    productImage: string | null
  }[]
  user: {
    id: number
    name: string
    email: string
  }
}

interface Stats {
  all: number
  pending: number
  paid: number
  preparing: number
  shipping: number
  delivered: number
  confirmed: number
  cancelled: number
  refund_requested: number
  refunded: number
  deleted: number
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

export default function AdminOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''
  const showDeleted = searchParams.get('deleted') === 'true'
  const [searchInput, setSearchInput] = useState(search)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(status && { status }),
        ...(search && { search }),
        ...(showDeleted && { deleted: 'true' }),
      })

      const res = await fetch(`/api/admin/shop/orders?${params}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('주문 목록 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [page, status, search, showDeleted])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    setPage(1)
  }, [status, search, showDeleted])

  const handleStatusChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams.toString())
    // 삭제된 주문 탭 클릭 시
    if (newStatus === 'deleted') {
      params.set('deleted', 'true')
      params.delete('status')
    } else {
      params.delete('deleted')
      if (newStatus && newStatus !== 'all') {
        params.set('status', newStatus)
      } else {
        params.delete('status')
      }
    }
    params.delete('page')
    router.push(`/admin/shop/orders?${params}`)
  }

  const handleRestore = async (orderId: number) => {
    if (!confirm('이 주문을 복원하시겠습니까?')) return

    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' })
      })

      if (res.ok) {
        fetchOrders()
      } else {
        const data = await res.json()
        alert(data.error || '복원에 실패했습니다.')
      }
    } catch (error) {
      console.error('복원 에러:', error)
      alert('복원 중 오류가 발생했습니다.')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (searchInput.trim()) {
      params.set('search', searchInput.trim())
    } else {
      params.delete('search')
    }
    params.delete('page')
    router.push(`/admin/shop/orders?${params}`)
  }

  const formatPrice = (price: number) => price.toLocaleString() + '원'
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {showDeleted ? (
              <span className="flex items-center gap-2">
                <Trash2 className="h-6 w-6 text-red-500" />
                삭제된 주문
              </span>
            ) : '주문 관리'}
          </h1>
          <p className="text-muted-foreground">
            총 {total}개의 {showDeleted ? '삭제된 ' : ''}주문
          </p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 상태별 통계 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-11 gap-2">
          <button
            onClick={() => handleStatusChange('all')}
            className={`p-3 rounded-lg text-center transition-colors ${
              !status && !showDeleted ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            <p className="text-lg font-bold">{stats.all}</p>
            <p className="text-xs">전체</p>
          </button>
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => handleStatusChange(key)}
              className={`p-3 rounded-lg text-center transition-colors ${
                status === key && !showDeleted ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <p className="text-lg font-bold">{stats[key as keyof Stats] || 0}</p>
              <p className="text-xs">{label}</p>
            </button>
          ))}
          {/* 삭제된 주문 탭 */}
          <button
            onClick={() => handleStatusChange('deleted')}
            className={`p-3 rounded-lg text-center transition-colors ${
              showDeleted ? 'bg-red-500 text-white' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            <p className="text-lg font-bold">{stats.deleted || 0}</p>
            <p className="text-xs flex items-center justify-center gap-1">
              <Trash2 className="h-3 w-3" />
              삭제됨
            </p>
          </button>
        </div>
      )}

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
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
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
                  <TableHead>주문일시</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
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
                      {formatDate(order.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/admin/shop/orders/${order.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {showDeleted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRestore(order.id)}
                            title="복원"
                          >
                            <RotateCcw className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
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
    </div>
  )
}
