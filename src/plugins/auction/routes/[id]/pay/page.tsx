"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { UserLayout } from "@/components/layout/UserLayout"
import { AuctionTimer } from "@/plugins/auction/components/AuctionTimer"
import { Loader2 } from "lucide-react"

interface AuctionInfo {
  id: number
  title: string
  currentPrice: number
  requiresShipping: boolean
  paymentStatus: string | null
  paymentDeadline: string | null
  winnerId: number | null
}

export default function AuctionPayPage() {
  const params = useParams()
  const router = useRouter()
  const auctionId = parseInt(params.id as string)
  const paymentFormRef = useRef<HTMLFormElement>(null)

  const [auction, setAuction] = useState<AuctionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  // Shipping fields
  const [savedAddresses, setSavedAddresses] = useState<Array<{
    id: number; name: string; recipientName: string; recipientPhone: string
    zipCode: string; address: string; addressDetail: string | null; isDefault: boolean
  }>>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>("") // "" = 새 주소
  const [recipientName, setRecipientName] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [address, setAddress] = useState("")
  const [addressDetail, setAddressDetail] = useState("")
  const [deliveryMemo, setDeliveryMemo] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)

  // Load auction info
  useEffect(() => {
    const init = async () => {
      try {
        const [meRes, auctionRes] = await Promise.all([
          fetch("/api/me"),
          fetch(`/api/auction/${auctionId}`),
        ])

        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData.user) {
            setCurrentUserId(meData.user.id)
            // 기본 수령자 정보
            if (meData.user.name) setRecipientName(meData.user.name)
            if (meData.user.phone) setRecipientPhone(meData.user.phone)
          }
        }

        if (auctionRes.ok) {
          const data = await auctionRes.json()
          setAuction(data.auction)
        }

        // 저장된 배송지 목록 가져오기
        try {
          const addrRes = await fetch("/api/shop/addresses")
          if (addrRes.ok) {
            const addrData = await addrRes.json()
            const addrs = addrData.addresses || []
            setSavedAddresses(addrs)
            // 기본 배송지 자동 선택
            const defaultAddr = addrs.find((a: { isDefault: boolean }) => a.isDefault) || addrs[0]
            if (defaultAddr) {
              setSelectedAddressId(String(defaultAddr.id))
              setRecipientName(defaultAddr.recipientName || "")
              setRecipientPhone(defaultAddr.recipientPhone || "")
              setZipCode(defaultAddr.zipCode || "")
              setAddress(defaultAddr.address || "")
              setAddressDetail(defaultAddr.addressDetail || "")
            }
          }
        } catch {
          // 주소 로드 실패해도 무시
        }
      } catch {
        setError("데이터를 불러오는데 실패했습니다.")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [auctionId])

  // 배송지 선택 변경
  const handleAddressChange = (value: string) => {
    setSelectedAddressId(value)
    if (value === "") {
      // 새 주소 입력
      setRecipientName("")
      setRecipientPhone("")
      setZipCode("")
      setAddress("")
      setAddressDetail("")
    } else {
      const addr = savedAddresses.find((a) => String(a.id) === value)
      if (addr) {
        setRecipientName(addr.recipientName || "")
        setRecipientPhone(addr.recipientPhone || "")
        setZipCode(addr.zipCode || "")
        setAddress(addr.address || "")
        setAddressDetail(addr.addressDetail || "")
      }
    }
  }

  // Calculate delivery fee when zipCode changes
  useEffect(() => {
    if (!auction?.requiresShipping || zipCode.length !== 5) return

    fetch("/api/shop/delivery-fee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zipCode, totalPrice: auction.currentPrice }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setDeliveryFee(data.fee)
      })
      .catch(() => {})
  }, [zipCode, auction])

  // Load Inicis script
  const loadInicisScript = () => {
    return new Promise<void>((resolve, reject) => {
      const win = window as any
      if (win.INIStdPay) { resolve(); return }

      const existing = document.querySelector('script[src*="INIStdPay.js"]')
      if (existing) {
        const check = setInterval(() => {
          if (win.INIStdPay) { clearInterval(check); resolve() }
        }, 100)
        setTimeout(() => { clearInterval(check); reject(new Error("타임아웃")) }, 10000)
        return
      }

      const script = document.createElement("script")
      script.src = "https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
      script.type = "text/javascript"
      script.setAttribute("charset", "UTF-8")
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("스크립트 로드 실패"))
      document.head.appendChild(script)
    })
  }

  // Start Inicis payment
  const startInicisPayment = async (payment: any) => {
    try {
      await loadInicisScript()

      const form = paymentFormRef.current
      if (!form) { setError("결제 폼을 찾을 수 없습니다."); setSubmitting(false); return }

      form.innerHTML = ""

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

      const win = window as any
      win.INIStdPay.pay("auctionPayForm")
    } catch {
      setError("결제 모듈 로딩 실패. 페이지를 새로고침해주세요.")
      setSubmitting(false)
    }
  }

  // Daum address search
  const searchAddress = () => {
    const win = window as any
    const openPostcode = () => {
      new win.daum.Postcode({
        oncomplete: (data: any) => {
          setZipCode(data.zonecode)
          setAddress(data.roadAddress || data.jibunAddress)
        },
      }).open()
    }

    if (win.daum?.Postcode) {
      openPostcode()
    } else {
      const script = document.createElement("script")
      script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
      script.onload = openPostcode
      document.head.appendChild(script)
    }
  }

  // Submit payment
  const handleSubmit = async () => {
    setError("")

    if (auction?.requiresShipping) {
      if (!recipientName || !recipientPhone || !zipCode || !address) {
        setError("배송지 정보를 입력해주세요.")
        return
      }
    }

    setSubmitting(true)

    // 배송지 자동 저장 (중복 무시)
    if (auction?.requiresShipping && recipientName && zipCode) {
      fetch("/api/shop/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName,
          recipientPhone,
          zipCode,
          address,
          addressDetail: addressDetail || null,
          skipDuplicate: true,
        }),
      }).catch(() => {})
    }

    try {
      const res = await fetch(`/api/auction/${auctionId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName,
          recipientPhone,
          zipCode,
          address,
          addressDetail: addressDetail || null,
          deliveryMemo: deliveryMemo || null,
          deliveryFee,
          baseUrl: window.location.origin,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "결제 준비 중 오류가 발생했습니다.")
        setSubmitting(false)
        return
      }

      await startInicisPayment(data.payment)
    } catch {
      setError("네트워크 오류가 발생했습니다.")
      setSubmitting(false)
    }
  }

  // --- RENDER ---

  if (loading) {
    return (
      <UserLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      </UserLayout>
    )
  }

  if (!auction || auction.winnerId !== currentUserId) {
    return (
      <UserLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">결제 권한이 없습니다.</p>
          <a href="/auction" className="text-primary mt-4 inline-block">경매 목록</a>
        </div>
      </UserLayout>
    )
  }

  if (auction.paymentStatus !== "pending") {
    return (
      <UserLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">
            {auction.paymentStatus === "paid" ? "이미 결제가 완료되었습니다." : "결제 기한이 만료되었습니다."}
          </p>
          <a href={`/auction/${auctionId}`} className="text-primary mt-4 inline-block">경매 상세</a>
        </div>
      </UserLayout>
    )
  }

  const finalPrice = auction.currentPrice + deliveryFee

  return (
    <UserLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-6">경매 결제</h1>

        {/* 경매 정보 */}
        <div className="border border-border rounded-lg p-4 mb-6 space-y-2">
          <h2 className="font-medium">{auction.title}</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">낙찰가</span>
            <span className="text-lg font-bold text-red-500">{auction.currentPrice.toLocaleString()}원</span>
          </div>
          {auction.paymentDeadline && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">결제 기한</span>
              <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded text-xs font-mono">
                <AuctionTimer endsAt={auction.paymentDeadline} status="active" showFull />
              </span>
            </div>
          )}
        </div>

        {/* 배송 정보 (배송 상품만) */}
        {auction.requiresShipping && (
          <div className="border border-border rounded-lg p-4 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-sm">배송 정보</h2>
              {savedAddresses.length > 0 && (
                <select
                  value={selectedAddressId}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  className="px-2 py-1 border border-border rounded-md bg-background text-xs"
                >
                  {savedAddresses.map((addr) => (
                    <option key={addr.id} value={String(addr.id)}>
                      {addr.recipientName} — {addr.address.slice(0, 20)}...
                      {addr.isDefault ? " (기본)" : ""}
                    </option>
                  ))}
                  <option value="">+ 새 주소 입력</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">수령자 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                placeholder="수령자 이름"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">연락처 <span className="text-red-500">*</span></label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => {
                  const nums = e.target.value.replace(/[^0-9]/g, "")
                  let formatted = nums
                  if (nums.startsWith("02")) {
                    if (nums.length <= 2) formatted = nums
                    else if (nums.length <= 6) formatted = `${nums.slice(0,2)}-${nums.slice(2)}`
                    else formatted = `${nums.slice(0,2)}-${nums.slice(2,6)}-${nums.slice(6,10)}`
                  } else {
                    if (nums.length <= 3) formatted = nums
                    else if (nums.length <= 7) formatted = `${nums.slice(0,3)}-${nums.slice(3)}`
                    else formatted = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7,11)}`
                  }
                  setRecipientPhone(formatted)
                }}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                placeholder="010-0000-0000"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">주소 <span className="text-red-500">*</span></label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={zipCode}
                  readOnly
                  className="w-28 px-3 py-2 border border-border rounded-md bg-muted text-sm"
                  placeholder="우편번호"
                />
                <button
                  type="button"
                  onClick={searchAddress}
                  className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted"
                >
                  주소 검색
                </button>
              </div>
              <input
                type="text"
                value={address}
                readOnly
                className="w-full px-3 py-2 border border-border rounded-md bg-muted text-sm mb-2"
                placeholder="기본 주소"
              />
              <input
                type="text"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                placeholder="상세 주소 (선택)"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">배송 메모</label>
              <input
                type="text"
                value={deliveryMemo}
                onChange={(e) => setDeliveryMemo(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                placeholder="배송 시 요청사항 (선택)"
              />
            </div>

            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">배송비</span>
                <span>{deliveryFee.toLocaleString()}원</span>
              </div>
            )}
          </div>
        )}

        {/* 결제 요약 */}
        <div className="border border-border rounded-lg p-4 mb-6 space-y-2">
          <h2 className="font-medium text-sm">결제 요약</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">낙찰가</span>
            <span>{auction.currentPrice.toLocaleString()}원</span>
          </div>
          {auction.requiresShipping && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">배송비</span>
              <span>{deliveryFee.toLocaleString()}원</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
            <span>총 결제 금액</span>
            <span className="text-red-500 text-lg">{finalPrice.toLocaleString()}원</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        {/* 결제 버튼 */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? "결제 처리 중..." : `${finalPrice.toLocaleString()}원 카드결제`}
        </button>

        {/* 이니시스 결제 폼 (hidden) */}
        <form id="auctionPayForm" ref={paymentFormRef} className="hidden" />
      </div>
    </UserLayout>
  )
}
