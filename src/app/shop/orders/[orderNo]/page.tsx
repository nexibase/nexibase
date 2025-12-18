"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header, Footer } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
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
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ExternalLink,
  ShoppingBag,
} from "lucide-react"
import { getTrackingUrlByName } from "@/lib/delivery"

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
  paidAt: string | null
  trackingCompany: string | null
  trackingNumber: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelReason: string | null
  cancelledAt: string | null
  refundAmount: number | null
  refundedAt: string | null
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
}

// 카드사 코드 -> 이름 변환
const CARD_NAMES: Record<string, string> = {
  "01": "하나(외환)카드",
  "02": "KB국민카드",
  "03": "삼성카드",
  "04": "현대카드",
  "06": "롯데카드",
  "07": "신한카드",
  "08": "NH농협카드",
  "11": "BC카드",
  "12": "씨티카드",
  "13": "카카오뱅크",
  "14": "케이뱅크",
  "15": "토스뱅크",
  "21": "해외비자",
  "22": "해외마스터",
  "23": "해외JCB",
  "24": "해외아멕스",
  "25": "해외다이너스",
  "26": "수협",
  "27": "신협",
  "28": "우리카드",
  "29": "하나카드",
  "30": "전북카드",
  "31": "광주카드",
  "32": "우체국",
  "33": "새마을금고",
  "34": "MG카드",
  "35": "제주카드",
  "36": "산업카드",
  "41": "BC(페이북)",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "결제대기", color: "bg-yellow-500", icon: AlertCircle },
  paid: { label: "결제완료", color: "bg-blue-500", icon: CreditCard },
  preparing: { label: "상품준비", color: "bg-indigo-500", icon: Package },
  shipping: { label: "배송중", color: "bg-purple-500", icon: Truck },
  delivered: { label: "배송완료", color: "bg-green-500", icon: CheckCircle2 },
  confirmed: { label: "구매확정", color: "bg-green-700", icon: CheckCircle2 },
  cancel_requested: { label: "취소요청", color: "bg-orange-500", icon: XCircle },
  cancelled: { label: "주문취소", color: "bg-gray-500", icon: XCircle },
  refund_requested: { label: "환불요청", color: "bg-orange-500", icon: RotateCcw },
  refunded: { label: "환불완료", color: "bg-red-500", icon: RotateCcw },
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderNo = params.orderNo as string

  const [order, setOrder] = useState<Order | null>(null)
  const [bankInfo, setBankInfo] = useState<string | null>(null)
  const [cardInfo, setCardInfo] = useState<{
    cardName: string | null
    cardNo: string | null
    applNum: string | null
    cardQuota: string
    applDate: string | null
    applTime: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 취소/환불 다이얼로그
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<"cancel" | "refund" | "confirm">("cancel")
  const [selectedReason, setSelectedReason] = useState("")
  const [customReason, setCustomReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  // 취소 사유 옵션
  const cancelReasons = [
    "주문 실수",
    "단순 변심",
    "다른 상품으로 재주문",
    "기타"
  ]

  // 환불 사유 옵션
  const refundReasons = [
    "상품이 설명과 다름",
    "상품 불량/파손",
    "오배송",
    "단순 변심",
    "기타"
  ]

  useEffect(() => {
    fetchOrder()
  }, [orderNo])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shop/orders/${orderNo}`)
      if (res.status === 401) {
        router.push(`/login?redirect=/shop/orders/${orderNo}`)
        return
      }
      if (!res.ok) {
        setError("주문을 찾을 수 없습니다.")
        return
      }
      const data = await res.json()
      setOrder(data.order)
      setBankInfo(data.bankInfo)
      setCardInfo(data.cardInfo)
    } catch (err) {
      setError("주문을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!order) return

    // 사유 조합
    let finalReason = ""
    if (dialogAction !== "confirm") {
      if (!selectedReason) {
        alert("사유를 선택해주세요.")
        return
      }
      if (selectedReason === "기타" && !customReason.trim()) {
        alert("기타 사유를 입력해주세요.")
        return
      }
      finalReason = selectedReason === "기타" ? customReason.trim() : selectedReason
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop/orders/${orderNo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: dialogAction === "refund" ? "refund_request" : dialogAction,
          cancelReason: finalReason || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || "처리에 실패했습니다.")
        return
      }

      setDialogOpen(false)
      setSelectedReason("")
      setCustomReason("")
      fetchOrder()
    } catch (err) {
      alert("처리 중 오류가 발생했습니다.")
    } finally {
      setActionLoading(false)
    }
  }

  const openDialog = (action: "cancel" | "refund" | "confirm") => {
    setDialogAction(action)
    setSelectedReason("")
    setCustomReason("")
    setDialogOpen(true)
  }

  const formatPrice = (price: number) => price.toLocaleString() + "원"
  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleString("ko-KR")
  }

  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">{error || "주문을 찾을 수 없습니다."}</p>
          <Button onClick={() => router.push("/shop/orders")}>주문 내역으로</Button>
        </main>
        <Footer />
      </div>
    )
  }

  const StatusIcon = STATUS_LABELS[order.status]?.icon || AlertCircle

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* 헤더 */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => router.push("/shop/orders")}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              주문 내역
            </Button>
          </div>

          {/* 주문 상태 */}
          <Card className="mb-6">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${STATUS_LABELS[order.status]?.color || 'bg-gray-500'}`}>
                  <StatusIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {STATUS_LABELS[order.status]?.label || order.status}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    주문번호: {order.orderNo}
                  </p>
                </div>
              </div>

              {/* 배송 정보 */}
              {order.trackingNumber && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="text-muted-foreground">택배사:</span>{" "}
                    {order.trackingCompany}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">송장번호:</span>{" "}
                    {order.trackingNumber}
                  </p>
                  {order.trackingCompany && (
                    <a
                      href={getTrackingUrlByName(order.trackingCompany, order.trackingNumber) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      배송 조회
                    </a>
                  )}
                </div>
              )}

              {/* 무통장입금 안내 */}
              {order.paymentMethod === "bank" && order.status === "pending" && bankInfo && (
                <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                  <p className="text-sm font-medium text-primary mb-2">입금 계좌 안내</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{bankInfo}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    * 입금 확인 후 결제 완료 처리됩니다.
                  </p>
                </div>
              )}

              {/* 취소/환불 사유 */}
              {order.cancelReason && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-800">
                    <span className="font-medium">취소/환불 사유:</span> {order.cancelReason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 주문 상품 */}
          <Card className="mb-6">
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
                  <div className="flex-1 min-w-0">
                    {item.productSlug ? (
                      <Link href={`/shop/${item.productSlug}`} className="hover:text-primary">
                        <h3 className="font-medium line-clamp-1">{item.productName}</h3>
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
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(item.subtotal)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 배송지 정보 */}
          <Card className="mb-6">
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
          <Card className="mb-6">
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

              {/* 무통장입금 계좌 정보 */}
              {order.paymentMethod === "bank" && bankInfo && (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <p className="text-sm text-muted-foreground mb-1">입금 계좌</p>
                  <p className="text-sm whitespace-pre-line">{bankInfo}</p>
                </div>
              )}

              {/* 카드결제 정보 */}
              {order.paymentMethod === "card" && cardInfo && (
                <div className="mt-3 pt-3 border-t border-dashed space-y-1">
                  <p className="text-sm font-medium mb-2">결제 카드 정보</p>
                  {cardInfo.cardName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">카드사</span>
                      <span>{CARD_NAMES[cardInfo.cardName] || cardInfo.cardName}</span>
                    </div>
                  )}
                  {cardInfo.cardNo && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">카드번호</span>
                      <span>{cardInfo.cardNo}</span>
                    </div>
                  )}
                  {cardInfo.applNum && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">승인번호</span>
                      <span>{cardInfo.applNum}</span>
                    </div>
                  )}
                  {cardInfo.cardQuota && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">할부</span>
                      <span>{cardInfo.cardQuota === "00" ? "일시불" : `${cardInfo.cardQuota}개월`}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 환불 정보 */}
              {(order.refundAmount !== null || ["cancelled", "refunded", "refund_requested"].includes(order.status)) && (
                <div className="pt-3 mt-3 border-t border-dashed space-y-2">
                  <h4 className="font-medium text-red-600">환불 정보</h4>
                  {order.refundAmount !== null && order.refundAmount < order.finalPrice && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>반품 배송비 차감</span>
                      <span>-{formatPrice(order.finalPrice - order.refundAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>{order.status === "refund_requested" ? "예상 환불금액" : "환불금액"}</span>
                    <span>{formatPrice(order.refundAmount || order.finalPrice)}</span>
                  </div>
                  {order.status === "refund_requested" && (
                    <p className="text-xs text-muted-foreground">
                      * 환불 요청이 승인되면 환불이 진행됩니다.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 주문 이력 */}
          <Card className="mb-6">
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

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            {/* 계속 쇼핑하기 - 취소/환불 가능 상태에서 표시 */}
            {["pending", "paid", "preparing", "shipping", "delivered"].includes(order.status) && (
              <Button
                className="flex-1"
                onClick={() => router.push("/shop")}
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                계속 쇼핑하기
              </Button>
            )}

            {/* 주문 취소 (결제대기/결제완료 상태) - 즉시 취소 */}
            {["pending", "paid"].includes(order.status) && (
              <Button
                variant="outline"
                className="flex-1 text-muted-foreground hover:text-destructive hover:border-destructive"
                onClick={() => openDialog("cancel")}
              >
                <XCircle className="h-4 w-4 mr-2" />
                주문 취소
              </Button>
            )}

            {/* 취소 요청 (준비중 상태) - 관리자 승인 필요 */}
            {order.status === "preparing" && (
              <Button
                variant="outline"
                className="flex-1 text-muted-foreground hover:text-destructive hover:border-destructive"
                onClick={() => openDialog("cancel")}
              >
                <XCircle className="h-4 w-4 mr-2" />
                취소 요청
              </Button>
            )}

            {/* 취소요청 중 안내 */}
            {order.status === "cancel_requested" && (
              <div className="flex-1 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 space-y-2">
                <p className="font-medium">취소 요청이 접수되었습니다</p>
                <div className="text-orange-700 space-y-1">
                  <p>요청일시: {formatDate(order.updatedAt)}</p>
                  {order.cancelReason && <p>취소사유: {order.cancelReason}</p>}
                </div>
                <p className="text-xs text-orange-600 pt-1 border-t border-orange-200">
                  관리자 확인 후 취소 또는 반품 처리가 진행됩니다.
                </p>
              </div>
            )}

            {/* 환불 요청 (배송중/배송완료 상태) */}
            {["shipping", "delivered"].includes(order.status) && (
              <Button
                variant="outline"
                className="flex-1 text-muted-foreground hover:text-destructive hover:border-destructive"
                onClick={() => openDialog("refund")}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                환불 요청
              </Button>
            )}

            {/* 환불요청 중 안내 */}
            {order.status === "refund_requested" && (
              <div className="flex-1 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 space-y-2">
                <p className="font-medium">환불 요청이 접수되었습니다</p>
                <div className="text-orange-700 space-y-1">
                  <p>요청일시: {formatDate(order.updatedAt)}</p>
                  {order.cancelReason && <p>환불사유: {order.cancelReason}</p>}
                  {order.refundAmount !== null && (
                    <p>예상 환불금액: {formatPrice(order.refundAmount)}</p>
                  )}
                </div>
                <p className="text-xs text-orange-600 pt-1 border-t border-orange-200">
                  관리자 확인 후 환불 처리가 진행됩니다.
                </p>
              </div>
            )}

            {/* 구매 확정 (배송완료 상태) */}
            {order.status === "delivered" && (
              <Button
                className="flex-1"
                onClick={() => openDialog("confirm")}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                구매 확정
              </Button>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* 액션 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "cancel" && "주문 취소"}
              {dialogAction === "refund" && "환불 요청"}
              {dialogAction === "confirm" && "구매 확정"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "cancel" && "주문을 취소하시겠습니까? 취소 사유를 입력해주세요."}
              {dialogAction === "refund" && "환불을 요청하시겠습니까? 환불 사유를 입력해주세요."}
              {dialogAction === "confirm" && "구매를 확정하시겠습니까? 확정 후에는 환불이 어려울 수 있습니다."}
            </DialogDescription>
          </DialogHeader>

          {/* 준비중 상태에서 취소 요청 안내 */}
          {dialogAction === "cancel" && order?.status === "preparing" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <p className="font-medium mb-1">안내</p>
              <p>
                상품 준비 중에는 이미 배송이 시작되었을 수 있어 즉시 취소가 어려울 수 있습니다.
                관리자 확인 후 취소 또는 반품(배송 후 환불) 처리가 진행되오니 이점 양지하시기 바랍니다.
              </p>
            </div>
          )}

          {dialogAction !== "confirm" && (
            <div className="space-y-4">
              <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
                {(dialogAction === "cancel" ? cancelReasons : refundReasons).map((reason) => (
                  <div key={reason} className="flex items-center space-x-2">
                    <RadioGroupItem value={reason} id={reason} />
                    <Label htmlFor={reason} className="cursor-pointer">{reason}</Label>
                  </div>
                ))}
              </RadioGroup>

              {selectedReason === "기타" && (
                <Textarea
                  placeholder="기타 사유를 입력해주세요"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={3}
                />
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading}
              variant={dialogAction === "confirm" ? "default" : "destructive"}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {dialogAction === "cancel" && "주문 취소"}
                  {dialogAction === "refund" && "환불 요청"}
                  {dialogAction === "confirm" && "구매 확정"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
