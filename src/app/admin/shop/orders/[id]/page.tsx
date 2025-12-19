"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/admin/Sidebar"
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
  Printer,
  ExternalLink,
} from "lucide-react"
import { DELIVERY_COMPANIES as DELIVERY_LIST, getTrackingUrlByName } from "@/lib/delivery"

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
    nickname: string
    email: string
    phone: string | null
  }
}

// 카드사 코드 -> 카드사명 매핑
const CARD_NAMES: Record<string, string> = {
  "01": "하나(외환)카드",
  "02": "KB국민카드",
  "03": "삼성카드",
  "04": "현대카드",
  "06": "롯데카드",
  "07": "신한카드",
  "08": "구)외환카드",
  "11": "BC카드",
  "12": "NH농협카드",
  "13": "한미카드",
  "14": "신세계한미카드",
  "15": "씨티카드",
  "16": "우리카드",
  "17": "하나SK카드",
  "21": "해외비자카드",
  "22": "해외마스터카드",
  "23": "JCB카드",
  "24": "해외아멕스카드",
  "25": "해외다이너스카드",
  "26": "중국은련카드",
  "27": "브이패스",
  "28": "마스터",
  "29": "디스커버",
  "31": "SK주유전용카드",
  "32": "S-OIL카드",
  "33": "현대오일뱅크",
  "34": "GS칼텍스",
  "35": "우리비씨카드",
  "36": "하이패스카드",
  "37": "저축은행카드",
  "38": "수협카드",
  "39": "전북은행카드",
  "40": "광주은행카드",
  "41": "제주은행카드",
  "42": "카카오뱅크카드",
  "43": "케이뱅크카드",
  "44": "토스뱅크카드",
}

const STATUS_OPTIONS = [
  { value: "pending", label: "결제대기" },
  { value: "paid", label: "결제완료" },
  { value: "preparing", label: "상품준비" },
  { value: "shipping", label: "배송중" },
  { value: "delivered", label: "배송완료" },
  { value: "confirmed", label: "구매확정" },
  { value: "cancel_requested", label: "취소요청" },
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
  cancel_requested: "bg-orange-500",
  cancelled: "bg-gray-500",
  refund_requested: "bg-orange-500",
  refunded: "bg-red-500",
}

const DELIVERY_COMPANIES = DELIVERY_LIST.map(c => c.name)

export default function AdminOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [bankInfo, setBankInfo] = useState<string | null>(null)
  const [cardInfo, setCardInfo] = useState<{
    cardName: string | null
    cardNo: string | null
    applNum: string | null
    cardQuota: string
    applDate: string | null
    applTime: string | null
    tid: string | null
  } | null>(null)
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

  // 취소/환불 요청 처리 상태
  const [processingAction, setProcessingAction] = useState<string | null>(null)

  // 관리자 주문 취소 다이얼로그
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

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
      setBankInfo(data.bankInfo)
      setCardInfo(data.cardInfo)
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

  // 무통장입금 입금확인
  const handleConfirmPayment = async () => {
    if (!order) return

    if (!confirm("입금을 확인하셨습니까?\n결제완료 상태로 변경됩니다.")) {
      return
    }

    setProcessingAction("confirm_payment")
    setError(null)

    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_payment",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "입금확인 처리에 실패했습니다.")
        return
      }

      setSuccessMessage("입금이 확인되었습니다.")
      fetchOrder()
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err) {
      setError("입금확인 처리 중 오류가 발생했습니다.")
    } finally {
      setProcessingAction(null)
    }
  }

  // 취소/환불 요청 처리 (승인/거절)
  const handleRequestAction = async (action: "approve" | "reject", requestType: "cancel" | "refund") => {
    if (!order) return

    const actionLabel = action === "approve" ? "승인" : "거절"
    const typeLabel = requestType === "cancel" ? "취소" : "환불"

    // 승인 시 카드 결제 안내 메시지 추가
    let confirmMessage = `${typeLabel} 요청을 ${actionLabel}하시겠습니까?`
    if (action === "approve" && order.paymentMethod === "card") {
      confirmMessage += `\n\n[카드 결제]\nPG사(이니시스)로 결제 승인 취소 요청이 함께 진행됩니다.`
    }

    if (!confirm(confirmMessage)) {
      return
    }

    setProcessingAction(`${requestType}_${action}`)
    setError(null)

    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: `${requestType}_${action}`,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `${actionLabel}에 실패했습니다.`)
        return
      }

      // 카드 결제 취소/환불 결과 메시지 생성
      let message = `${typeLabel} 요청이 ${actionLabel}되었습니다.`
      if (action === "approve" && data.pgCancelResult) {
        if (data.pgCancelResult.success) {
          message += " (카드 결제 승인 취소 완료)"
        } else {
          message += ` (카드 취소 실패: ${data.pgCancelResult.message})`
        }
      }

      setSuccessMessage(message)
      fetchOrder()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(`${actionLabel} 중 오류가 발생했습니다.`)
    } finally {
      setProcessingAction(null)
    }
  }

  // 관리자 주문 취소 처리
  const handleAdminCancel = async () => {
    if (!order || !cancelReason.trim()) return

    // 카드 결제 안내 메시지
    let confirmMessage = `주문번호 ${order.orderNo}을(를) 취소하시겠습니까?\n\n취소 사유: ${cancelReason}`
    if (order.paymentMethod === "card") {
      confirmMessage += `\n\n[카드 결제]\nPG사(이니시스)로 결제 승인 취소 요청이 함께 진행됩니다.`
    }

    if (!confirm(confirmMessage)) {
      return
    }

    setProcessingAction("admin_cancel")
    setError(null)

    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "admin_cancel",
          cancelReason: cancelReason.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "주문 취소에 실패했습니다.")
        return
      }

      // 성공 메시지
      let message = "주문이 취소되었습니다."
      if (data.pgCancelResult) {
        if (data.pgCancelResult.success) {
          message += " (카드 결제 승인 취소 완료)"
        } else {
          message += ` (카드 취소 실패: ${data.pgCancelResult.message})`
        }
      }

      setSuccessMessage(message)
      setCancelDialogOpen(false)
      setCancelReason("")
      fetchOrder()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError("주문 취소 중 오류가 발생했습니다.")
    } finally {
      setProcessingAction(null)
    }
  }

  const formatPrice = (price: number) => price.toLocaleString() + "원"
  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleString("ko-KR")
  }

  // paymentInfo에서 취소/환불 정보 파싱
  const getPaymentCancelInfo = () => {
    if (!order?.paymentInfo) return null
    try {
      const data = JSON.parse(order.paymentInfo)
      return data.cancelInfo || data.refundInfo || null
    } catch {
      return null
    }
  }
  const cancelInfo = order ? getPaymentCancelInfo() : null

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="text-center py-20">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push("/admin/shop/orders")}>
              목록으로
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (!order) return null

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">
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
            onClick={() => window.open(`/api/admin/shop/orders/${order.id}/label`, '_blank')}
          >
            <Printer className="h-4 w-4 mr-1" />
            라벨 출력
          </Button>
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
                    {order.user.nickname} ({order.user.email})
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

              {/* 카드 결제 정보 */}
              {cardInfo && (
                <div className="pt-3 mt-3 border-t space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">카드 결제 정보</p>
                  {cardInfo.cardName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">카드사</span>
                      <span>{CARD_NAMES[cardInfo.cardName] || cardInfo.cardName}</span>
                    </div>
                  )}
                  {cardInfo.cardNo && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">카드번호</span>
                      <span className="font-mono">{cardInfo.cardNo}</span>
                    </div>
                  )}
                  {cardInfo.applNum && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">승인번호</span>
                      <span className="font-mono">{cardInfo.applNum}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">할부</span>
                    <span>{cardInfo.cardQuota === "00" ? "일시불" : `${cardInfo.cardQuota}개월`}</span>
                  </div>
                  {cardInfo.tid && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">거래번호(TID)</span>
                      <span className="font-mono text-xs">{cardInfo.tid}</span>
                    </div>
                  )}
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

          {/* 취소/환불 사유 및 PG 처리 이력 */}
          {(order.cancelReason || cancelInfo) && (
            <Card>
              <CardHeader>
                <CardTitle>취소/환불 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.cancelReason && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">사유</p>
                    <p className="text-sm">{order.cancelReason}</p>
                  </div>
                )}
                {order.cancelledAt && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">취소일시</p>
                    <p className="text-sm">{formatDate(order.cancelledAt)}</p>
                  </div>
                )}
                {order.refundedAt && order.status === 'refunded' && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">환불일시</p>
                    <p className="text-sm">{formatDate(order.refundedAt)}</p>
                  </div>
                )}
                {cancelInfo && (
                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-2">PG 처리 이력</p>
                    <div className="text-xs space-y-1 bg-muted/50 p-3 rounded-lg">
                      <p>
                        <span className="text-muted-foreground">처리자:</span>{" "}
                        {cancelInfo.cancelledBy === 'admin' ? '관리자' : '고객'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">처리일시:</span>{" "}
                        {cancelInfo.cancelledAt || cancelInfo.refundedAt
                          ? formatDate(cancelInfo.cancelledAt || cancelInfo.refundedAt)
                          : '-'}
                      </p>
                      {cancelInfo.pgResult && (
                        <>
                          <p>
                            <span className="text-muted-foreground">PG 결과:</span>{" "}
                            <span className={cancelInfo.pgResult.success ? 'text-green-600' : 'text-red-600'}>
                              {cancelInfo.pgResult.success ? '성공' : '실패'}
                            </span>
                            {cancelInfo.pgResult.message && ` (${cancelInfo.pgResult.message})`}
                          </p>
                          {cancelInfo.pgResult.data?.tid && (
                            <p>
                              <span className="text-muted-foreground">TID:</span>{" "}
                              {cancelInfo.pgResult.data.tid}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
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
                    <div className="flex gap-2">
                      <Input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="송장번호 입력"
                      />
                      {trackingCompany && trackingNumber && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const url = getTrackingUrlByName(trackingCompany, trackingNumber)
                            if (url) window.open(url, '_blank')
                          }}
                          title="배송조회"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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

              {/* 무통장입금 입금확인 버튼 */}
              {order.paymentMethod === "bank" && order.status === "pending" && (
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-primary">
                    무통장입금 주문입니다.
                  </p>
                  {bankInfo && (
                    <div className="p-3 bg-background rounded border text-sm">
                      <p className="text-xs text-muted-foreground mb-1">입금 계좌</p>
                      <p className="whitespace-pre-line">{bankInfo}</p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    입금 확인 후 버튼을 눌러주세요.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => handleConfirmPayment()}
                    disabled={!!processingAction}
                  >
                    {processingAction === "confirm_payment" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    입금확인
                  </Button>
                </div>
              )}

              {/* 취소 요청 처리 버튼 */}
              {order.status === "cancel_requested" && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-orange-800">
                    고객이 취소를 요청했습니다.
                  </p>
                  {order.cancelReason && (
                    <p className="text-sm text-orange-700">사유: {order.cancelReason}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRequestAction("approve", "cancel")}
                      disabled={!!processingAction}
                      className="flex-1"
                    >
                      {processingAction === "cancel_approve" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "취소 승인"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestAction("reject", "cancel")}
                      disabled={!!processingAction}
                      className="flex-1"
                    >
                      {processingAction === "cancel_reject" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "거절 (배송중으로)"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* 환불 요청 처리 버튼 */}
              {order.status === "refund_requested" && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-orange-800">
                    고객이 환불을 요청했습니다.
                  </p>
                  {order.cancelReason && (
                    <p className="text-sm text-orange-700">사유: {order.cancelReason}</p>
                  )}
                  {order.refundAmount && (
                    <p className="text-sm text-orange-700">
                      예상 환불금액: {formatPrice(order.refundAmount)}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRequestAction("approve", "refund")}
                      disabled={!!processingAction}
                      className="flex-1"
                    >
                      {processingAction === "refund_approve" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "환불 승인"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestAction("reject", "refund")}
                      disabled={!!processingAction}
                      className="flex-1"
                    >
                      {processingAction === "refund_reject" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "거절"
                      )}
                    </Button>
                  </div>
                </div>
              )}

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

              {/* 관리자 주문 취소 버튼 (취소/환불 상태가 아닌 경우) */}
              {!["cancelled", "refunded", "cancel_requested", "refund_requested"].includes(order.status) && (
                <div className="pt-4 mt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={!!processingAction}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    관리자 주문 취소
                  </Button>
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

      {/* 관리자 주문 취소 다이얼로그 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>관리자 주문 취소</DialogTitle>
            <DialogDescription>
              주문자 <span className="font-bold">{order.ordererName}</span> 님, 주문번호 <span className="font-mono font-bold">{order.orderNo}</span>을(를) 취소합니다.
              <br />
              취소 사유는 고객에게 알림으로 전송됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="cancelReason">취소 사유 *</Label>
            <Textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="고객에게 전달할 취소 사유를 입력하세요"
              rows={3}
              className="mt-2"
            />
            {order.paymentMethod === "card" && (
              <p className="text-xs text-orange-600 mt-2">
                * 카드 결제 주문입니다. 취소 시 PG사로 환불 요청이 함께 진행됩니다.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false)
                setCancelReason("")
              }}
            >
              닫기
            </Button>
            <Button
              variant="destructive"
              onClick={handleAdminCancel}
              disabled={!cancelReason.trim() || processingAction === "admin_cancel"}
            >
              {processingAction === "admin_cancel" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              주문 취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  )
}
