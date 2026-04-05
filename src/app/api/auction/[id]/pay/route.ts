import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import crypto from "crypto"

async function getShopSettings() {
  const settings = await prisma.shopSetting.findMany()
  const map: Record<string, string> = {}
  settings.forEach((s) => (map[s.key] = s.value))
  return map
}

async function generateOrderNo(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const MM = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const hh = String(now.getHours()).padStart(2, "0")
  const ii = String(now.getMinutes()).padStart(2, "0")

  for (let i = 0; i < 10; i++) {
    const rand = String(Math.floor(Math.random() * 100000)).padStart(5, "0")
    const orderNo = `${yy}${MM}${dd}${hh}-${ii}${rand}`
    const exists = await prisma.order.findUnique({ where: { orderNo } })
    if (!exists) return orderNo
  }

  const ss = String(now.getSeconds()).padStart(2, "0")
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0")
  return `${yy}${MM}${dd}${hh}-${ii}${ss}${rand}`
}

function sha256(str: string) {
  return crypto.createHash("sha256").update(str).digest("hex")
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
    }

    const { id } = await params
    const auctionId = parseInt(id)

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
    })

    if (!auction) {
      return NextResponse.json({ error: "경매를 찾을 수 없습니다." }, { status: 404 })
    }

    if (auction.winnerId !== user.id) {
      return NextResponse.json({ error: "낙찰자만 결제할 수 있습니다." }, { status: 403 })
    }

    if (auction.paymentStatus !== "pending") {
      return NextResponse.json({ error: "결제 대기 상태가 아닙니다." }, { status: 400 })
    }

    if (auction.paymentDeadline && auction.paymentDeadline < new Date()) {
      return NextResponse.json({ error: "결제 기한이 만료되었습니다." }, { status: 400 })
    }

    const body = await request.json()
    const {
      recipientName,
      recipientPhone,
      zipCode,
      address,
      addressDetail,
      deliveryMemo,
      deliveryFee: clientDeliveryFee,
      baseUrl: clientBaseUrl,
    } = body

    // 배송 상품이면 배송지 필수
    if (auction.requiresShipping) {
      if (!recipientName || !recipientPhone || !zipCode || !address) {
        return NextResponse.json({ error: "배송지 정보를 입력해주세요." }, { status: 400 })
      }
    }

    const totalPrice = auction.currentPrice
    const deliveryFee = auction.requiresShipping && typeof clientDeliveryFee === "number" ? clientDeliveryFee : 0
    const finalPrice = totalPrice + deliveryFee

    const orderNo = await generateOrderNo()

    // PendingOrder 생성
    await prisma.pendingOrder.upsert({
      where: { orderNo },
      create: {
        orderNo,
        userId: user.id,
        orderData: JSON.stringify({
          auctionId,
          ordererName: user.nickname,
          ordererPhone: "",
          ordererEmail: user.email,
          recipientName: auction.requiresShipping ? recipientName : user.nickname,
          recipientPhone: auction.requiresShipping ? recipientPhone : "",
          zipCode: auction.requiresShipping ? zipCode : "00000",
          address: auction.requiresShipping ? address : "디지털 상품",
          addressDetail: auction.requiresShipping ? (addressDetail || null) : null,
          deliveryMemo: auction.requiresShipping ? (deliveryMemo || null) : null,
          totalPrice,
          deliveryFee,
          finalPrice,
          items: [{
            productId: 0,
            productName: `[경매] ${auction.title}`,
            optionId: null,
            optionText: null,
            price: totalPrice,
            quantity: 1,
            subtotal: totalPrice,
          }],
        }),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
      update: {
        orderData: JSON.stringify({
          auctionId,
          ordererName: user.nickname,
          ordererPhone: "",
          ordererEmail: user.email,
          recipientName: auction.requiresShipping ? recipientName : user.nickname,
          recipientPhone: auction.requiresShipping ? recipientPhone : "",
          zipCode: auction.requiresShipping ? zipCode : "00000",
          address: auction.requiresShipping ? address : "디지털 상품",
          addressDetail: auction.requiresShipping ? (addressDetail || null) : null,
          deliveryMemo: auction.requiresShipping ? (deliveryMemo || null) : null,
          totalPrice,
          deliveryFee,
          finalPrice,
          items: [{
            productId: 0,
            productName: `[경매] ${auction.title}`,
            optionId: null,
            optionText: null,
            price: totalPrice,
            quantity: 1,
            subtotal: totalPrice,
          }],
        }),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    })

    // 이니시스 결제 데이터 생성
    const settings = await getShopSettings()
    const testMode = settings.pg_test_mode !== "false"
    const mid = testMode ? "INIpayTest" : (settings.pg_mid || "INIpayTest")
    const signKey = testMode ? "SU5JTElURV9UUklQTEVERVNfS0VZU1RS" : (settings.pg_signkey || "SU5JTElURV9UUklQTEVERVNfS0VZU1RS")

    const timestamp = Date.now().toString()
    const baseUrl = clientBaseUrl || process.env.NEXT_PUBLIC_URL || "http://localhost:3200"

    const signature = sha256(`oid=${orderNo}&price=${finalPrice}&timestamp=${timestamp}`)
    const mKey = sha256(signKey)

    const paymentData = {
      version: "1.0",
      mid,
      oid: orderNo,
      goodname: `[경매] ${auction.title}`,
      price: finalPrice,
      currency: "WON",
      buyername: user.nickname,
      buyertel: "",
      buyeremail: user.email || "",
      timestamp,
      signature,
      mKey,
      returnUrl: `${baseUrl}/api/auction/payment/return`,
      closeUrl: `${baseUrl}/api/auction/payment/close`,
      popupUrl: `${baseUrl}/api/auction/payment/popup`,
      gopaymethod: "Card",
      acceptmethod: "below1000:centerCd(Y)",
      payUrl: testMode
        ? "https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
        : "https://stdpay.inicis.com/stdjs/INIStdPay.js",
      testMode,
    }

    return NextResponse.json({
      success: true,
      order: { orderNo, finalPrice },
      payment: paymentData,
    })
  } catch (error) {
    console.error("경매 결제 준비 에러:", error)
    return NextResponse.json({ error: "결제 준비 중 오류가 발생했습니다." }, { status: 500 })
  }
}
