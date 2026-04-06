"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Header, Footer } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  XCircle,
  AlertCircle,
} from "lucide-react"

interface OrderItem {
  productSlug: string | null
  optionText: string | null
}

export default function OrderCompletePage() {
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
      <OrderCompleteContent />
    </Suspense>
  )
}

function OrderCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderNo = searchParams.get("orderNo")
  const paymentError = searchParams.get("error")
  const errorMessage = searchParams.get("message")

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 결제 에러가 있는 경우 에러 화면 표시
    if (paymentError) {
      setLoading(false)
      return
    }

    if (!orderNo) {
      router.push("/shop")
      return
    }

    // 장바구니 정리 후 주문 상세 페이지로 리다이렉트
    clearCartAndRedirect()
  }, [orderNo, paymentError, errorMessage, router])

  // 장바구니 정리 후 주문 상세 페이지로 리다이렉트
  const clearCartAndRedirect = async () => {
    try {
      const res = await fetch(`/api/shop/orders/${orderNo}`)
      if (res.ok) {
        const data = await res.json()
        if (data.order) {
          clearOrderedItemsFromCart(data.order.items)
        }
      }
    } catch (err) {
      console.error("장바구니 정리 에러:", err)
    }
    // 주문 상세 페이지로 리다이렉트
    router.replace(`/shop/orders/${orderNo}`)
  }

  // 주문한 상품을 장바구니에서 삭제
  const clearOrderedItemsFromCart = (orderedItems: OrderItem[]) => {
    try {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]")
      const orderedKeys = new Set(
        orderedItems.map(item => `${item.productSlug || ""}-${item.optionText || ""}`)
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newCart = cart.filter((item: any) => {
        const key = `${item.productSlug || ""}-${item.optionText || ""}`
        return !orderedKeys.has(key)
      })

      localStorage.setItem("cart", JSON.stringify(newCart))
      localStorage.removeItem("orderItems")
      window.dispatchEvent(new Event("cartUpdated"))
    } catch (err) {
      console.error("장바구니 정리 에러:", err)
    }
  }

  // 로딩 중
  if (loading && !paymentError) {
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

  // 결제 실패 화면
  if (paymentError) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold mb-2">결제에 실패했습니다</h1>
              <p className="text-muted-foreground">
                {errorMessage || "결제 처리 중 오류가 발생했습니다."}
              </p>
            </div>

            <Card className="mb-6 border-red-200">
              <CardHeader className="bg-red-50">
                <CardTitle className="text-lg flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-5 w-5" />
                  결제 실패 안내
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm mb-4">
                  결제가 정상적으로 처리되지 않았습니다. 다시 시도해주세요.
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>카드 잔액이 충분한지 확인해주세요.</li>
                  <li>카드 한도를 초과하지 않았는지 확인해주세요.</li>
                  <li>문제가 지속되면 카드사에 문의해주세요.</li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/shop")}
              >
                쇼핑 계속하기
              </Button>
              <Button
                className="flex-1"
                onClick={() => router.push("/shop/cart")}
              >
                장바구니로 돌아가기
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // 기본 로딩 화면 (리다이렉트 전)
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
