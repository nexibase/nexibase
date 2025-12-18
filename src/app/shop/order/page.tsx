"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Script from "next/script"
import { Header, Footer } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  ChevronLeft,
  Package,
  CreditCard,
  Building2,
  Truck,
  AlertCircle,
  Check,
  MapPin,
  Star,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// 이니시스 결제 데이터 타입 (데모와 동일하게)
interface InicisPaymentData {
  version: string
  mid: string
  oid: string
  goodname: string
  price: number
  currency: string
  buyername: string
  buyertel: string
  buyeremail: string
  timestamp: string
  signature: string
  mKey: string
  returnUrl: string
  closeUrl: string
  popupUrl: string
  gopaymethod: string
  acceptmethod: string
  payUrl: string
  testMode: boolean
}

interface OrderItem {
  productId: number
  productName: string
  productSlug: string
  productImage: string | null
  optionId: number | null
  optionText: string
  price: number
  quantity: number
}

interface ShopSettings {
  shop_name: string
  shop_tel: string
  bank_info: string
  delivery_notice: string
  refund_policy: string
  return_shipping_fee: string
  exchange_info: string
  return_info: string
  return_address: string
}

interface UserAddress {
  id: number
  name: string
  recipientName: string
  recipientPhone: string
  zipCode: string
  address: string
  addressDetail: string | null
  isDefault: boolean
}


export default function OrderPage() {
  const router = useRouter()
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 쇼핑몰 설정
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null)

  // 이니시스 결제 관련
  const paymentFormRef = useRef<HTMLFormElement>(null)


  // 배송비
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [deliveryInfo, setDeliveryInfo] = useState("")
  const [calculatingDelivery, setCalculatingDelivery] = useState(false)

  // 주문자 정보
  const [ordererName, setOrdererName] = useState("")
  const [ordererPhone, setOrdererPhone] = useState("")
  const [ordererEmail, setOrdererEmail] = useState("")

  // 배송지 정보
  const [sameAsOrderer, setSameAsOrderer] = useState(true)
  const [recipientName, setRecipientName] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [address, setAddress] = useState("")
  const [addressDetail, setAddressDetail] = useState("")
  const [deliveryMemo, setDeliveryMemo] = useState("")

  // 결제 방법 (기본값: 카드결제)
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "card">("card")

  // 주소록 관련 상태
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([])
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [saveAddress, setSaveAddress] = useState(false)
  const [addressName, setAddressName] = useState("")

  useEffect(() => {
    loadOrderItems()
    loadShopSettings()
    loadUserInfo()
    loadSavedAddresses()
  }, [])

  // 로그인한 사용자 정보 불러오기
  const loadUserInfo = async () => {
    try {
      const res = await fetch("/api/me")
      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          setOrdererName(data.user.name || "")
          setOrdererPhone(data.user.phone || "")
          setOrdererEmail(data.user.email || "")
        }
      }
    } catch (err) {
      console.error("사용자 정보 로드 에러:", err)
    }
  }

  // 저장된 주소록 불러오기
  const loadSavedAddresses = async () => {
    try {
      const res = await fetch("/api/shop/addresses")
      if (res.ok) {
        const data = await res.json()
        setSavedAddresses(data.addresses)
        // 기본 배송지가 있으면 자동으로 적용
        const defaultAddr = data.addresses.find((a: UserAddress) => a.isDefault)
        if (defaultAddr) {
          applyAddress(defaultAddr)
        }
      }
    } catch (err) {
      console.error("주소록 로드 에러:", err)
    }
  }

  // 주소 적용
  const applyAddress = (addr: UserAddress) => {
    setSameAsOrderer(false)
    setRecipientName(addr.recipientName)
    setRecipientPhone(addr.recipientPhone)
    setZipCode(addr.zipCode)
    setAddress(addr.address)
    setAddressDetail(addr.addressDetail || "")
    setAddressModalOpen(false)
  }

  // 주문자 정보와 배송지 동기화
  useEffect(() => {
    if (sameAsOrderer) {
      setRecipientName(ordererName)
      setRecipientPhone(ordererPhone)
    }
  }, [sameAsOrderer, ordererName, ordererPhone])

  // 우편번호 변경 시 배송비 계산
  useEffect(() => {
    if (zipCode.length === 5) {
      calculateDeliveryFee(zipCode)
    }
  }, [zipCode, orderItems])

  // 이니시스 iframe 스타일 강제 수정 (흰색 배경 문제 해결)
  useEffect(() => {
    // 이니시스 요소인지 확인
    const isInicisElement = (el: HTMLElement) =>
      el.id?.includes('INI') || el.className?.includes('INI') || el.className?.includes('inipay')

    const isInicisIframe = (iframe: HTMLIFrameElement) =>
      iframe.src?.includes('inicis') || iframe.name?.includes('INI') || isInicisElement(iframe)

    // iframe 투명화
    const makeIframeTransparent = (iframe: HTMLIFrameElement) => {
      iframe.style.backgroundColor = 'transparent'
      iframe.setAttribute('allowTransparency', 'true')
      iframe.setAttribute('frameBorder', '0')
    }

    // 모든 이니시스 요소 투명화
    const applyTransparency = () => {
      document.querySelectorAll('iframe').forEach(iframe => {
        if (isInicisIframe(iframe)) makeIframeTransparent(iframe)
      })
      document.querySelectorAll<HTMLElement>('#inicisModalDiv, .inipay_modal, .inipay_modal-body, .inipay_modal-content').forEach(el => {
        el.style.cssText = 'background-color: transparent !important; border: none !important; box-shadow: none !important;'
      })
    }

    // MutationObserver로 새로 추가되는 요소 감지
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(({ addedNodes }) => {
        addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          if (node.tagName === 'IFRAME' && isInicisIframe(node as HTMLIFrameElement)) {
            makeIframeTransparent(node as HTMLIFrameElement)
          }
          if (node.tagName === 'DIV' && isInicisElement(node)) {
            node.style.backgroundColor = 'transparent'
          }
        })
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })

    // 폴백: 주기적으로 체크 (Observer가 놓칠 경우 대비)
    const intervalId = setInterval(applyTransparency, 1000)

    return () => {
      observer.disconnect()
      clearInterval(intervalId)
    }
  }, [])

  const loadOrderItems = () => {
    const items: OrderItem[] = JSON.parse(localStorage.getItem("orderItems") || "[]")
    if (items.length === 0) {
      router.push("/shop/cart")
      return
    }
    setOrderItems(items)
    setLoading(false)
  }

  const loadShopSettings = async () => {
    try {
      const res = await fetch("/api/shop/settings")
      if (res.ok) {
        const data = await res.json()
        setShopSettings(data.settings)
      }
    } catch (err) {
      console.error("설정 로드 에러:", err)
    }
  }

  const calculateDeliveryFee = async (zip: string) => {
    setCalculatingDelivery(true)
    try {
      const totalPrice = getTotalPrice()
      const res = await fetch("/api/shop/delivery-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipCode: zip, totalPrice }),
      })
      if (res.ok) {
        const data = await res.json()
        setDeliveryFee(data.fee)
        setDeliveryInfo(data.policyName)
      }
    } catch (err) {
      console.error("배송비 계산 에러:", err)
    } finally {
      setCalculatingDelivery(false)
    }
  }

  const getTotalPrice = () => {
    return orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  const getFinalPrice = () => {
    return getTotalPrice() + deliveryFee
  }

  const formatPrice = (price: number) => price.toLocaleString() + "원"

  // 이니시스 스크립트 동적 로드
  const loadInicisScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any

      // 이미 로드됨
      if (win.INIStdPay) {
        resolve()
        return
      }

      // 이미 스크립트 태그가 있는지 확인
      const existingScript = document.querySelector('script[src*="INIStdPay.js"]')
      if (existingScript) {
        // 로드 대기
        const checkLoaded = setInterval(() => {
          if (win.INIStdPay) {
            clearInterval(checkLoaded)
            resolve()
          }
        }, 100)
        setTimeout(() => {
          clearInterval(checkLoaded)
          reject(new Error("스크립트 로드 타임아웃"))
        }, 10000)
        return
      }

      // 스크립트 동적 생성
      const script = document.createElement("script")
      script.src = "https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
      script.type = "text/javascript"
      script.setAttribute("charset", "UTF-8")
      script.onload = () => {
        console.log("이니시스 스크립트 로드 완료")
        resolve()
      }
      script.onerror = () => {
        reject(new Error("이니시스 스크립트 로드 실패"))
      }
      document.head.appendChild(script)
    })
  }

  // 이니시스 결제 시작 함수
  const startInicisPayment = async (payment: InicisPaymentData) => {
    try {
      // 스크립트 로드 확인/대기
      await loadInicisScript()

      // 폼에 데이터 설정
      const form = paymentFormRef.current
      if (!form) {
        setError("결제 폼을 찾을 수 없습니다.")
        setSubmitting(false)
        return
      }

      // 기존 폼 필드 제거
      form.innerHTML = ""

      // 폼 필드 추가
      const fields: Record<string, string> = {
        version: payment.version,
        mid: payment.mid,
        oid: payment.oid,
        goodname: payment.goodname,
        price: payment.price.toString(),
        currency: payment.currency,
        buyername: payment.buyername,
        buyertel: payment.buyertel,
        buyeremail: payment.buyeremail,
        timestamp: payment.timestamp,
        signature: payment.signature,
        mKey: payment.mKey,
        returnUrl: payment.returnUrl,
        closeUrl: payment.closeUrl,
        popupUrl: payment.popupUrl,
        payViewType: "overlay",
        gopaymethod: payment.gopaymethod,
        acceptmethod: payment.acceptmethod,
      }

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement("input")
        input.type = "hidden"
        input.name = name
        input.value = value
        form.appendChild(input)
      })

      // 이니시스 결제 호출
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      console.log("INIStdPay.pay 호출", win.INIStdPay)
      win.INIStdPay.pay("inicisPayForm")
    } catch (err) {
      console.error("결제 시작 에러:", err)
      setError("결제 모듈을 로딩하지 못했습니다. 페이지를 새로고침 후 다시 시도해주세요.")
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // 유효성 검사
    if (!ordererName || !ordererPhone) {
      setError("주문자 정보를 입력해주세요.")
      return
    }

    if (!recipientName || !recipientPhone || !zipCode || !address) {
      setError("배송지 정보를 입력해주세요.")
      return
    }

    setSubmitting(true)

    try {
      // 주소 저장 체크박스가 활성화된 경우 주소 저장
      if (saveAddress && addressName) {
        try {
          await fetch("/api/shop/addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: addressName,
              recipientName,
              recipientPhone,
              zipCode,
              address,
              addressDetail: addressDetail || null,
              isDefault: savedAddresses.length === 0, // 첫 번째 주소면 기본 배송지로
            }),
          })
        } catch (err) {
          console.error("주소 저장 에러:", err)
          // 주소 저장 실패해도 주문은 계속 진행
        }
      }

      // 카드결제인 경우 이니시스 결제 진행
      if (paymentMethod === "card") {
        // 현재 접속 URL을 자동으로 감지 (포트 변경에도 대응)
        const currentBaseUrl = window.location.origin

        const res = await fetch("/api/shop/payment/inicis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: orderItems.map(item => ({
              productId: item.productId,
              optionId: item.optionId,
              quantity: item.quantity,
            })),
            ordererName,
            ordererPhone,
            ordererEmail: ordererEmail || null,
            recipientName,
            recipientPhone,
            zipCode,
            address,
            addressDetail: addressDetail || null,
            deliveryMemo: deliveryMemo || null,
            deliveryFee,  // 화면에 표시된 배송비 전달
            baseUrl: currentBaseUrl,  // 현재 접속 URL 전달
          }),
        })

        console.log('결제 요청 - 상품금액:', getTotalPrice(), '배송비:', deliveryFee, '총액:', getFinalPrice())

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "결제 준비 중 오류가 발생했습니다.")
          setSubmitting(false)
          return
        }

        // 카드결제는 장바구니를 미리 삭제하지 않음 (결제 완료 페이지에서 삭제)
        // 결제 취소 시에도 장바구니가 유지됨

        // 이니시스 결제 시작 (스크립트 로드 포함)
        await startInicisPayment(data.payment)
        return
      }

      // 무통장입금인 경우 기존 로직
      const res = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: orderItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            optionId: item.optionId,
            quantity: item.quantity,
          })),
          ordererName,
          ordererPhone,
          ordererEmail: ordererEmail || null,
          recipientName,
          recipientPhone,
          zipCode,
          address,
          addressDetail: addressDetail || null,
          deliveryMemo: deliveryMemo || null,
          paymentMethod,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "주문 처리 중 오류가 발생했습니다.")
        setSubmitting(false)
        return
      }

      // 주문 성공 - 장바구니에서 주문 상품 제거
      const cart: OrderItem[] = JSON.parse(localStorage.getItem("cart") || "[]")
      const orderedKeys = new Set(
        orderItems.map(item => `${item.productId}-${item.optionId || "none"}`)
      )
      const newCart = cart.filter(
        item => !orderedKeys.has(`${item.productId}-${item.optionId || "none"}`)
      )
      localStorage.setItem("cart", JSON.stringify(newCart))
      localStorage.removeItem("orderItems")
      window.dispatchEvent(new Event("cartUpdated"))

      // 주문 완료 페이지로 이동
      router.push(`/shop/order/complete?orderNo=${data.order.orderNo}`)
    } catch (err) {
      setError("주문 처리 중 오류가 발생했습니다.")
      setSubmitting(false)
    }
  }

  // 다음 주소 검색 API
  const searchAddress = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (typeof window !== "undefined" && win.daum?.Postcode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new win.daum.Postcode({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oncomplete: (data: any) => {
          setZipCode(data.zonecode)
          setAddress(data.roadAddress || data.jibunAddress)
        },
      }).open()
    } else {
      // 다음 주소 API 스크립트 로드
      const script = document.createElement("script")
      script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win2 = window as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new win2.daum.Postcode({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          oncomplete: (data: any) => {
            setZipCode(data.zonecode)
            setAddress(data.roadAddress || data.jibunAddress)
          },
        }).open()
      }
      document.head.appendChild(script)
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* 헤더 */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              뒤로가기
            </Button>
            <h1 className="text-2xl font-bold mt-2">주문서 작성</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* 주문 상품 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      주문 상품
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {orderItems.map((item, index) => (
                      <div
                        key={`${item.productId}-${item.optionId || index}`}
                        className="flex gap-4 pb-4 border-b last:border-0"
                      >
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
                          <h3 className="font-medium line-clamp-1">{item.productName}</h3>
                          {item.optionText && (
                            <p className="text-sm text-muted-foreground">{item.optionText}</p>
                          )}
                          <p className="text-sm">
                            {formatPrice(item.price)} × {item.quantity}개
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatPrice(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* 주문자 정보 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">주문자 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ordererName">이름 *</Label>
                        <Input
                          id="ordererName"
                          value={ordererName}
                          onChange={(e) => setOrdererName(e.target.value)}
                          placeholder="주문자 이름"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="ordererPhone">연락처 *</Label>
                        <Input
                          id="ordererPhone"
                          value={ordererPhone}
                          onChange={(e) => setOrdererPhone(e.target.value)}
                          placeholder="010-0000-0000"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ordererEmail">이메일</Label>
                      <Input
                        id="ordererEmail"
                        type="email"
                        value={ordererEmail}
                        onChange={(e) => setOrdererEmail(e.target.value)}
                        placeholder="example@email.com"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* 배송지 정보 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      배송지 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 저장된 배송지 선택 */}
                    {savedAddresses.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">저장된 배송지</Label>
                        <div className="grid gap-2">
                          {savedAddresses.slice(0, 3).map((addr) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => applyAddress(addr)}
                              className={`w-full text-left p-3 rounded-lg border transition-colors hover:border-primary ${
                                zipCode === addr.zipCode && address === addr.address
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-border'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{addr.name}</span>
                                  {addr.isDefault && (
                                    <span className="inline-flex items-center text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                      <Star className="h-3 w-3 mr-0.5 fill-current" />
                                      기본
                                    </span>
                                  )}
                                </div>
                                {zipCode === addr.zipCode && address === addr.address && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {addr.recipientName} | {addr.recipientPhone}
                              </p>
                              <p className="text-xs mt-0.5 truncate">
                                [{addr.zipCode}] {addr.address}
                                {addr.addressDetail && `, ${addr.addressDetail}`}
                              </p>
                            </button>
                          ))}
                        </div>
                        {savedAddresses.length > 3 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => setAddressModalOpen(true)}
                          >
                            <MapPin className="h-4 w-4 mr-1" />
                            더보기 ({savedAddresses.length - 3}개)
                          </Button>
                        )}
                        <div className="border-t pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSameAsOrderer(false)
                              setRecipientName("")
                              setRecipientPhone("")
                              setZipCode("")
                              setAddress("")
                              setAddressDetail("")
                            }}
                          >
                            + 새 배송지 입력
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* 새 배송지 입력 또는 저장된 주소가 없을 때 */}
                    {(savedAddresses.length === 0 || (!zipCode && !address)) && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="sameAsOrderer"
                          checked={sameAsOrderer}
                          onChange={(e) => setSameAsOrderer(e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor="sameAsOrderer" className="text-sm cursor-pointer">
                          주문자 정보와 동일
                        </label>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="recipientName">받는 분 *</Label>
                        <Input
                          id="recipientName"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="받는 분 이름"
                          required
                          disabled={sameAsOrderer}
                        />
                      </div>
                      <div>
                        <Label htmlFor="recipientPhone">연락처 *</Label>
                        <Input
                          id="recipientPhone"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="010-0000-0000"
                          required
                          disabled={sameAsOrderer}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>주소 *</Label>
                      <div className="flex gap-2">
                        <Input
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          placeholder="우편번호"
                          className="w-32"
                          required
                          readOnly
                        />
                        <Button type="button" variant="outline" onClick={searchAddress}>
                          주소 검색
                        </Button>
                      </div>
                    </div>

                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="기본 주소"
                      required
                      readOnly
                    />

                    <Input
                      value={addressDetail}
                      onChange={(e) => setAddressDetail(e.target.value)}
                      placeholder="상세 주소 (선택)"
                    />

                    <div>
                      <Label htmlFor="deliveryMemo">배송 메모</Label>
                      <Select value={deliveryMemo || 'none'} onValueChange={(v) => setDeliveryMemo(v === 'none' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="배송 메모 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">선택 안함</SelectItem>
                          <SelectItem value="부재시 문앞에 놓아주세요">
                            부재시 문앞에 놓아주세요
                          </SelectItem>
                          <SelectItem value="경비실에 맡겨주세요">
                            경비실에 맡겨주세요
                          </SelectItem>
                          <SelectItem value="배송 전 연락 부탁드립니다">
                            배송 전 연락 부탁드립니다
                          </SelectItem>
                          <SelectItem value="직접 입력">직접 입력</SelectItem>
                        </SelectContent>
                      </Select>
                      {deliveryMemo === "직접 입력" && (
                        <Input
                          className="mt-2"
                          placeholder="배송 메모 입력"
                          onChange={(e) => setDeliveryMemo(e.target.value)}
                        />
                      )}
                    </div>

                    {deliveryInfo && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-green-500" />
                        배송비: {deliveryInfo} ({formatPrice(deliveryFee)})
                      </div>
                    )}

                    {/* 주소 저장 체크박스 */}
                    {zipCode && address && (
                      <div className="pt-4 border-t space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="saveAddress"
                            checked={saveAddress}
                            onChange={(e) => setSaveAddress(e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor="saveAddress" className="text-sm cursor-pointer">
                            이 주소를 주소록에 저장
                          </label>
                        </div>
                        {saveAddress && (
                          <Input
                            value={addressName}
                            onChange={(e) => setAddressName(e.target.value)}
                            placeholder="배송지명 (예: 집, 회사)"
                            className="max-w-xs"
                          />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 결제 방법 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      결제 방법
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("bank")}
                        className={`p-4 border rounded-lg text-left transition-colors ${paymentMethod === "bank"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                          }`}
                      >
                        <Building2 className="h-6 w-6 mb-2" />
                        <p className="font-medium">무통장입금</p>
                        <p className="text-sm text-muted-foreground">
                          계좌이체로 결제
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("card")}
                        className={`p-4 border rounded-lg text-left transition-colors ${paymentMethod === "card"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                          }`}
                      >
                        <CreditCard className="h-6 w-6 mb-2" />
                        <p className="font-medium">카드결제</p>
                        <p className="text-sm text-muted-foreground">
                          신용/체크카드
                        </p>
                      </button>
                    </div>

                    {paymentMethod === "bank" && shopSettings?.bank_info && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="font-medium mb-2">입금 계좌 안내</p>
                        <p className="text-sm whitespace-pre-wrap">
                          {shopSettings.bank_info}
                        </p>
                      </div>
                    )}

                    {paymentMethod === "card" && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          주문 완료 후 카드 결제 페이지로 이동합니다.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 배송/환불/반품교환 정책 */}
                {shopSettings && (shopSettings.delivery_notice || shopSettings.refund_policy || shopSettings.exchange_info || shopSettings.return_info) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        주문 안내
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      {shopSettings.delivery_notice && (
                        <div>
                          <h4 className="font-medium mb-1 flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            배송 안내
                          </h4>
                          <p className="text-muted-foreground whitespace-pre-wrap pl-6">
                            {shopSettings.delivery_notice}
                          </p>
                        </div>
                      )}
                      {shopSettings.refund_policy && (
                        <div>
                          <h4 className="font-medium mb-1">환불 정책</h4>
                          <p className="text-muted-foreground whitespace-pre-wrap pl-6">
                            {shopSettings.refund_policy}
                          </p>
                          {shopSettings.return_shipping_fee && (
                            <p className="text-muted-foreground pl-6 mt-1">
                              * 배송 후 취소/반품 시 반품 배송비 {parseInt(shopSettings.return_shipping_fee).toLocaleString()}원이 차감됩니다.
                            </p>
                          )}
                        </div>
                      )}
                      {(shopSettings.exchange_info || shopSettings.return_info) && (
                        <div>
                          <h4 className="font-medium mb-1">교환/반품 안내</h4>
                          {shopSettings.exchange_info && (
                            <div className="pl-6 mb-2">
                              <p className="text-xs font-medium text-muted-foreground">교환</p>
                              <p className="text-muted-foreground whitespace-pre-wrap">
                                {shopSettings.exchange_info}
                              </p>
                            </div>
                          )}
                          {shopSettings.return_info && (
                            <div className="pl-6 mb-2">
                              <p className="text-xs font-medium text-muted-foreground">반품</p>
                              <p className="text-muted-foreground whitespace-pre-wrap">
                                {shopSettings.return_info}
                              </p>
                            </div>
                          )}
                          {shopSettings.return_address && (
                            <div className="pl-6">
                              <p className="text-xs font-medium text-muted-foreground">반품/교환 주소</p>
                              <p className="text-muted-foreground">
                                {shopSettings.return_address}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* 결제 요약 */}
              <div className="lg:col-span-1">
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="text-lg">결제 금액</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>상품 금액</span>
                      <span>{formatPrice(getTotalPrice())}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>배송비</span>
                      <span>
                        {calculatingDelivery ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : zipCode ? (
                          formatPrice(deliveryFee)
                        ) : (
                          "주소 입력 시 계산"
                        )}
                      </span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">총 결제금액</span>
                        <span className="text-xl font-bold text-primary">
                          {formatPrice(getFinalPrice())}
                        </span>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-100 text-red-800 rounded-lg text-sm">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={submitting || !zipCode}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          처리 중...
                        </>
                      ) : (
                        <>
                          {formatPrice(getFinalPrice())} 결제하기
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      주문 내용을 확인하였으며, 결제에 동의합니다.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* 이니시스 스크립트 - beforeInteractive로 먼저 로드 */}
      <Script
        src="https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
        strategy="beforeInteractive"
      />

      {/* 이니시스 결제 폼 (숨김) */}
      <form
        id="inicisPayForm"
        ref={paymentFormRef}
        method="post"
        acceptCharset="UTF-8"
        style={{ display: "none" }}
      />

      {/* 주소록 선택 모달 */}
      <Dialog open={addressModalOpen} onOpenChange={setAddressModalOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              배송지 선택
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {savedAddresses.map((addr) => (
              <button
                key={addr.id}
                type="button"
                onClick={() => applyAddress(addr)}
                className={`w-full text-left p-4 rounded-lg border transition-colors hover:border-primary ${
                  addr.isDefault ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{addr.name}</span>
                  {addr.isDefault && (
                    <span className="inline-flex items-center text-xs text-primary">
                      <Star className="h-3 w-3 mr-0.5 fill-current" />
                      기본
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  {addr.recipientName} | {addr.recipientPhone}
                </p>
                <p className="text-sm">
                  [{addr.zipCode}] {addr.address}
                  {addr.addressDetail && `, ${addr.addressDetail}`}
                </p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}
