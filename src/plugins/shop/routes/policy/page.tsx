"use client"

import { useState, useEffect } from "react"
import { Header, Footer } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  Truck,
  XCircle,
  RotateCcw,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
} from "lucide-react"

interface ShopSettings {
  shop_name: string
  shop_tel: string
  shop_email: string
  delivery_notice: string
  refund_policy: string
  return_shipping_fee: string
  exchange_info: string
  return_info: string
  return_address: string
}

export default function ShopPolicyPage() {
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/shop/settings")
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      }
    } catch (err) {
      console.error("설정 로드 에러:", err)
    } finally {
      setLoading(false)
    }
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

  const returnShippingFee = settings?.return_shipping_fee
    ? parseInt(settings.return_shipping_fee).toLocaleString()
    : "5,000"

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-2">취소/반품/교환 정책</h1>
          <p className="text-muted-foreground mb-8">
            {settings?.shop_name || "쇼핑몰"}의 취소, 반품, 교환 관련 안내입니다.
          </p>

          <div className="space-y-6">
            {/* 배송 안내 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-blue-500" />
                  배송 안내
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {settings?.delivery_notice ? (
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                    {settings.delivery_notice}
                  </p>
                ) : (
                  <ul className="space-y-2 text-muted-foreground">
                    <li>- 주문 후 1~3일 이내 발송됩니다. (주말, 공휴일 제외)</li>
                    <li>- 제주/도서산간 지역은 추가 배송비가 발생할 수 있습니다.</li>
                    <li>- 배송 조회는 주문 내역에서 확인 가능합니다.</li>
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* 주문 취소 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <XCircle className="h-5 w-5 text-red-500" />
                  주문 취소
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">배송 전 취소</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>- 결제 완료 후 상품 준비 전까지 취소 가능합니다.</li>
                    <li>- 마이페이지 &gt; 주문내역에서 직접 취소할 수 있습니다.</li>
                    <li>- <span className="text-green-600 font-medium">전액 환불</span>됩니다.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">배송 후 취소</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>- 상품 발송 후에는 취소가 불가하며, 반품으로 처리됩니다.</li>
                    <li>- 반품 배송비 <span className="text-red-600 font-medium">{returnShippingFee}원</span>이 차감됩니다.</li>
                  </ul>
                </div>
                {settings?.refund_policy && (
                  <div className="pt-3 border-t">
                    <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                      {settings.refund_policy}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 반품 안내 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RotateCcw className="h-5 w-5 text-orange-500" />
                  반품 안내
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {settings?.return_info ? (
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                    {settings.return_info}
                  </p>
                ) : (
                  <>
                    <div>
                      <h4 className="font-medium mb-2">반품 가능 기간</h4>
                      <p className="text-muted-foreground">
                        상품 수령 후 7일 이내 반품 신청 가능합니다.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">반품 불가 사유</h4>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>- 고객 부주의로 인한 상품 훼손</li>
                        <li>- 포장을 개봉하여 사용한 경우</li>
                        <li>- 시간 경과로 재판매가 어려운 경우</li>
                      </ul>
                    </div>
                  </>
                )}
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">반품 배송비:</span>{" "}
                    <span className="text-red-600 font-medium">{returnShippingFee}원</span>
                    <span className="text-muted-foreground ml-1">(단순 변심의 경우)</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    * 상품 하자 및 오배송의 경우 배송비 무료
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 교환 안내 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RefreshCw className="h-5 w-5 text-purple-500" />
                  교환 안내
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {settings?.exchange_info ? (
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                    {settings.exchange_info}
                  </p>
                ) : (
                  <>
                    <div>
                      <h4 className="font-medium mb-2">교환 가능 기간</h4>
                      <p className="text-muted-foreground">
                        상품 수령 후 7일 이내 교환 신청 가능합니다.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">교환 절차</h4>
                      <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
                        <li>고객센터 또는 마이페이지에서 교환 신청</li>
                        <li>반품 주소로 상품 발송</li>
                        <li>상품 확인 후 교환 상품 발송</li>
                      </ol>
                    </div>
                  </>
                )}
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">교환 배송비:</span>{" "}
                    <span className="text-red-600 font-medium">왕복 {parseInt(returnShippingFee.replace(/,/g, '')) * 2 || 10000}원</span>
                    <span className="text-muted-foreground ml-1">(단순 변심의 경우)</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    * 상품 하자 및 오배송의 경우 배송비 무료
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 반품/교환 주소 및 연락처 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-green-500" />
                  반품/교환 안내
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {settings?.return_address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">반품/교환 주소</p>
                      <p className="text-muted-foreground">{settings.return_address}</p>
                    </div>
                  </div>
                )}
                {settings?.shop_tel && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">고객센터</p>
                      <p className="text-muted-foreground">{settings.shop_tel}</p>
                    </div>
                  </div>
                )}
                {settings?.shop_email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">이메일</p>
                      <p className="text-muted-foreground">{settings.shop_email}</p>
                    </div>
                  </div>
                )}
                {!settings?.return_address && !settings?.shop_tel && !settings?.shop_email && (
                  <p className="text-muted-foreground">
                    연락처 정보가 등록되지 않았습니다.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
