"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  ChevronLeft,
  Package,
  User,
  Truck,
  CreditCard,
  Save,
  AlertCircle,
  Trash2,
} from "lucide-react"

interface Order {
  id: number
  orderNo: string
  ordererName: string
  ordererPhone: string
  ordererEmail: string | null
  recipientName: string
  recipientPhone: string
  zipCode: string
  address: string
  addressDetail: string | null
  deliveryMemo: string | null
  totalPrice: number
  deliveryFee: number
  finalPrice: number
  status: string
  paymentMethod: string
  paymentInfo: string | null
  paidAt: string | null
  trackingCompany: string | null
  trackingNumber: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelReason: string | null
  cancelledAt: string | null
  refundAmount: number | null
  refundedAt: string | null
  adminMemo: string | null
  createdAt: string
  updatedAt: string
  items: {
    id: number
    productName: string
    optionText: string | null
    price: number
    quantity: number
    subtotal: number
    productImage: string | null
    productSlug: string | null
  }[]
  user: {
    id: number
    name: string
    email: string
    phone: string | null
  }
}

const STATUS_OPTIONS = [
  { value: "pending", label: "결제대기" },
  { value: "paid", label: "결제완료" },
  { value: "preparing", label: "상품준비" },
  { value: "shipping", label: "배송중" },
  { value: "delivered", label: "배송완료" },
  { value: "confirmed", label: "구매확정" },
  { value: "cancelled", label: "주문취소" },
  { value: "refund_requested", label: "환불요청" },
  { value: "refunded", label: "환불완료" },
]

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  paid: "bg-blue-500",
  preparing: "bg-indigo-500",
  shipping: "bg-purple-500",
  delivered: "bg-green-500",
  confirmed: "bg-green-700",
  cancelled: "bg-gray-500",
  refund_requested: "bg-orange-500",
  refunded: "bg-red-500",
}

const DELIVERY_COMPANIES = [
  "CJ대한통운",
  "한진택배",
  "롯데택배",
  "우체국택배",
  "로젠택배",
  "경동택배",
]

export default function AdminOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 수정 폼 상태
  const [status, setStatus] = useState("")
  const [trackingCompany, setTrackingCompany] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [adminMemo, setAdminMemo] = useState("")

  // 삭제 다이얼로그 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchOrder()
  }, [orderId])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`)
      if (!res.ok) {
        setError("주문을 찾을 수 없습니다.")
        return
      }
      const data = await res.json()
      setOrder(data.order)
      setStatus(data.order.status)
      setTrackingCompany(data.order.trackingCompany || "")
      setTrackingNumber(data.order.trackingNumber || "")
      setAdminMemo(data.order.adminMemo || "")
    } catch (err) {
      setError("주문을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!order) return

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          trackingCompany: trackingCompany || null,
          trackingNumber: trackingNumber || null,
          adminMemo: adminMemo || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "저장에 실패했습니다.")
        return
      }

      setSuccessMessage("저장되었습니다.")
      fetchOrder()
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err) {
      setError("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "삭제에 실패했습니다.")
        setDeleteDialogOpen(false)
        return
      }

      router.push("/admin/shop/orders")
    } catch (err) {
      setError("삭제 중 오류가 발생했습니다.")
      setDeleteDialogOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const formatPrice = (price: number) => price.toLocaleString() + "원"
  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleString("ko-KR")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => router.push("/admin/shop/orders")}>
          목록으로
        </Button>
      </div>
    )
  }

  if (!order) return null

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/admin/shop/orders")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            목록
          </Button>
          <div>
            <h1 className="text-2xl font-bold">주문 상세</h1>
            <p className="text-muted-foreground font-mono">{order.orderNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_COLORS[order.status] || "bg-gray-500"}>
            {STATUS_OPTIONS.find(s => s.value === order.status)?.label || order.status}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            삭제
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽 컬럼 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 주문 상품 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                주문 상품
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
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
                  <div className="flex-1">
                    {item.productSlug ? (
                      <Link href={`/shop/${item.productSlug}`} target="_blank" className="hover:text-primary">
                        <h3 className="font-medium">{item.productName}</h3>
                      </Link>
                    ) : (
                      <h3 className="font-medium">{item.productName}</h3>
                    )}
                    {item.optionText && (
                      <p className="text-sm text-muted-foreground">{item.optionText}</p>
                    )}
                    <p className="text-sm">
                      {formatPrice(item.price)} × {item.quantity}개
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(item.subtotal)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 주문자 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                주문자 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex">
                <span className="w-24 text-muted-foreground">주문자</span>
                <span>{order.ordererName}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-muted-foreground">연락처</span>
                <span>{order.ordererPhone}</span>
              </div>
              {order.ordererEmail && (
                <div className="flex">
                  <span className="w-24 text-muted-foreground">이메일</span>
                  <span>{order.ordererEmail}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2">
                <div className="flex">
                  <span className="w-24 text-muted-foreground">회원정보</span>
                  <span>
                    {order.user.name} ({order.user.email})
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 배송지 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                배송지 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex">
                <span className="w-24 text-muted-foreground">받는 분</span>
                <span>{order.recipientName}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-muted-foreground">연락처</span>
                <span>{order.recipientPhone}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-muted-foreground">주소</span>
                <span>
                  [{order.zipCode}] {order.address}
                  {order.addressDetail && ` ${order.addressDetail}`}
                </span>
              </div>
              {order.deliveryMemo && (
                <div className="flex">
                  <span className="w-24 text-muted-foreground">배송 메모</span>
                  <span>{order.deliveryMemo}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 결제 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                결제 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">상품 금액</span>
                <span>{formatPrice(order.totalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">배송비</span>
                <span>{formatPrice(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">총 결제금액</span>
                <span className="text-lg font-bold text-primary">
                  {formatPrice(order.finalPrice)}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-muted-foreground">결제 방법</span>
                <span>{order.paymentMethod === "bank" ? "무통장입금" : "카드결제"}</span>
              </div>
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">결제일시</span>
                  <span>{formatDate(order.paidAt)}</span>
                </div>
              )}
              {order.refundAmount && (
                <div className="flex justify-between text-red-500">
                  <span>환불금액</span>
                  <span>{formatPrice(order.refundAmount)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 취소/환불 사유 */}
          {order.cancelReason && (
            <Card>
              <CardHeader>
                <CardTitle>취소/환불 사유</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.cancelReason}</p>
                {order.cancelledAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    취소일시: {formatDate(order.cancelledAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 오른쪽 컬럼 - 상태 관리 */}
        <div className="space-y-6">
          {/* 주문 상태 변경 */}
          <Card>
            <CardHeader>
              <CardTitle>주문 상태 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>주문 상태</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 배송 정보 (배송중일 때) */}
              {(status === "shipping" || status === "delivered") && (
                <>
                  <div>
                    <Label>택배사</Label>
                    <Select value={trackingCompany} onValueChange={setTrackingCompany}>
                      <SelectTrigger>
                        <SelectValue placeholder="택배사 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_COMPANIES.map((company) => (
                          <SelectItem key={company} value={company}>
                            {company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>송장번호</Label>
                    <Input
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="송장번호 입력"
                    />
                  </div>
                </>
              )}

              <div>
                <Label>관리자 메모</Label>
                <Textarea
                  value={adminMemo}
                  onChange={(e) => setAdminMemo(e.target.value)}
                  placeholder="내부 메모 (고객에게 보이지 않음)"
                  rows={4}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-100 text-red-800 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="flex items-center gap-2 p-3 bg-green-100 text-green-800 rounded-lg text-sm">
                  <Package className="h-4 w-4" />
                  {successMessage}
                </div>
              )}

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    저장
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 주문 이력 */}
          <Card>
            <CardHeader>
              <CardTitle>주문 이력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">주문일시</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">결제일시</span>
                  <span>{formatDate(order.paidAt)}</span>
                </div>
              )}
              {order.shippedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">배송시작</span>
                  <span>{formatDate(order.shippedAt)}</span>
                </div>
              )}
              {order.deliveredAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">배송완료</span>
                  <span>{formatDate(order.deliveredAt)}</span>
                </div>
              )}
              {order.cancelledAt && (
                <div className="flex justify-between text-red-500">
                  <span>취소일시</span>
                  <span>{formatDate(order.cancelledAt)}</span>
                </div>
              )}
              {order.refundedAt && (
                <div className="flex justify-between text-red-500">
                  <span>환불일시</span>
                  <span>{formatDate(order.refundedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>주문 삭제</DialogTitle>
            <DialogDescription>
              주문번호 <span className="font-mono font-bold">{order.orderNo}</span>을(를) 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "삭제"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
