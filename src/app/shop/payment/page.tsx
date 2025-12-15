"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Script from "next/script"

// 이니시스 결제 데이터 타입
interface PaymentData {
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
  verification: string
  mKey: string
  use_chkfake: string
  returnUrl: string
  popupUrl: string
  closeUrl: string
  gopaymethod: string
  payViewType: string
  acceptmethod: string
  quotabase: string
}

function PaymentContent() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const formRef = useRef<HTMLFormElement>(null)
  const [paymentStarted, setPaymentStarted] = useState(false)

  useEffect(() => {
    // URL 파라미터에서 결제 데이터 가져오기
    const paymentDataParam = searchParams.get("data")

    if (!paymentDataParam) {
      setError("결제 정보가 없습니다.")
      setLoading(false)
      return
    }

    try {
      const paymentData: PaymentData = JSON.parse(decodeURIComponent(paymentDataParam))

      // 폼에 데이터 설정
      const form = formRef.current
      if (!form) {
        setError("결제 폼을 찾을 수 없습니다.")
        setLoading(false)
        return
      }

      // 폼 필드 설정
      form.innerHTML = ""
      const fields = {
        version: paymentData.version,
        mid: paymentData.mid,
        oid: paymentData.oid,
        goodname: paymentData.goodname,
        price: paymentData.price.toString(),
        currency: paymentData.currency,
        buyername: paymentData.buyername,
        buyertel: paymentData.buyertel,
        buyeremail: paymentData.buyeremail,
        timestamp: paymentData.timestamp,
        signature: paymentData.signature,
        verification: paymentData.verification,
        mKey: paymentData.mKey,
        use_chkfake: paymentData.use_chkfake,
        returnUrl: paymentData.returnUrl,
        popupUrl: paymentData.popupUrl,
        closeUrl: paymentData.closeUrl,
        gopaymethod: paymentData.gopaymethod,
        payViewType: paymentData.payViewType,
        acceptmethod: paymentData.acceptmethod,
        quotabase: paymentData.quotabase,
      }

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement("input")
        input.type = "hidden"
        input.name = name
        input.value = value
        form.appendChild(input)
      })

      setLoading(false)
    } catch (e) {
      console.error("결제 데이터 파싱 에러:", e)
      setError("결제 정보를 처리할 수 없습니다.")
      setLoading(false)
    }
  }, [searchParams])

  const startPayment = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (win.INIStdPay) {
      setPaymentStarted(true)
      win.INIStdPay.pay("inicisPayForm")
    } else {
      setError("결제 모듈을 로딩 중입니다. 잠시 후 다시 시도해주세요.")
    }
  }

  const handleScriptLoad = () => {
    // 스크립트 로드 완료 후 자동으로 결제 시작
    if (!loading && !error && !paymentStarted) {
      setTimeout(startPayment, 500)
    }
  }

  useEffect(() => {
    // 스크립트가 이미 로드되어 있으면 결제 시작
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (!loading && !error && !paymentStarted && win.INIStdPay) {
      setTimeout(startPayment, 500)
    }
  }, [loading, error, paymentStarted])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            창 닫기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {/* 이니시스 결제 스크립트 */}
      <Script
        src="https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />

      {/* 이니시스 결제 폼 */}
      <form
        id="inicisPayForm"
        ref={formRef}
        method="post"
        acceptCharset="UTF-8"
      />

      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">결제 정보를 불러오는 중...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">결제창을 여는 중...</p>
            <p className="text-sm text-gray-400 mt-2">잠시만 기다려주세요.</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}
