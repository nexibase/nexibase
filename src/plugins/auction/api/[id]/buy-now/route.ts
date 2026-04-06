import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { emitBid, emitEnded } from "@/plugins/auction/lib/auction-events"
import { createNotification } from "@/lib/notification"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const { id } = await params
    const auctionId = parseInt(id)
    if (isNaN(auctionId)) {
      return NextResponse.json(
        { error: "잘못된 경매 ID입니다." },
        { status: 400 }
      )
    }

    // 이용 제한 체크
    const userWithPenalty = await prisma.user.findUnique({
      where: { id: user.id },
      select: { auctionBannedUntil: true },
    })
    if (userWithPenalty?.auctionBannedUntil && userWithPenalty.auctionBannedUntil > new Date()) {
      const bannedUntil = userWithPenalty.auctionBannedUntil.toLocaleDateString("ko-KR")
      return NextResponse.json(
        { error: `경매 이용이 제한되어 있습니다. (해제일: ${bannedUntil})` },
        { status: 403 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        {
          id: number
          sellerId: number
          title: string
          currentPrice: number
          buyNowPrice: number | null
          bidCount: number
          status: string
        }[]
      >`SELECT id, sellerId, title, currentPrice, buyNowPrice, bidCount, status
        FROM auctions WHERE id = ${auctionId} FOR UPDATE`

      if (!locked) {
        throw new Error("NOT_FOUND")
      }

      if (locked.status !== "active") {
        throw new Error("NOT_ACTIVE")
      }

      if (!locked.buyNowPrice) {
        throw new Error("NO_BUY_NOW")
      }

      if (locked.sellerId === user.id) {
        throw new Error("OWN_AUCTION")
      }

      // 즉시구매 입찰 생성
      await tx.bid.create({
        data: {
          auctionId,
          userId: user.id,
          amount: locked.buyNowPrice,
          isAutoBid: false,
        },
      })

      // 경매 종료
      await tx.auction.update({
        where: { id: auctionId },
        data: {
          currentPrice: locked.buyNowPrice,
          bidCount: locked.bidCount + 1,
          status: "ended",
          winnerId: user.id,
          paymentStatus: "pending",
          paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })

      // 모든 자동 입찰 비활성화
      await tx.autoBid.updateMany({
        where: { auctionId, isActive: true },
        data: { isActive: false },
      })

      return {
        sellerId: locked.sellerId,
        title: locked.title,
        buyNowPrice: locked.buyNowPrice,
      }
    })

    // SSE 이벤트 발행
    emitBid({
      auctionId,
      currentPrice: result.buyNowPrice,
      bidCount: 0,
      bidderNickname: user.nickname,
      amount: result.buyNowPrice,
      isAutoBid: false,
      time: new Date().toISOString(),
    })

    emitEnded({
      auctionId,
      winnerId: user.id,
      winnerNickname: user.nickname,
      finalPrice: result.buyNowPrice,
    })

    // 알림 발송 (비동기)
    createNotification({
      userId: user.id,
      type: "system",
      title: "즉시구매 완료",
      message: `"${result.title}" 경매를 ${result.buyNowPrice.toLocaleString()}원에 즉시구매했습니다.`,
      link: `/auction/${auctionId}`,
    }).catch(() => {})

    createNotification({
      userId: result.sellerId,
      type: "system",
      title: "경매 즉시구매 낙찰",
      message: `"${result.title}" 경매가 ${result.buyNowPrice.toLocaleString()}원에 즉시구매 낙찰되었습니다.`,
      link: `/auction/${auctionId}`,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: "즉시구매가 완료되었습니다.",
    })
  } catch (error) {
    if (error instanceof Error) {
      const errorMap: Record<string, { msg: string; status: number }> = {
        NOT_FOUND: { msg: "경매를 찾을 수 없습니다.", status: 404 },
        NOT_ACTIVE: { msg: "진행중인 경매가 아닙니다.", status: 400 },
        NO_BUY_NOW: { msg: "즉시구매가 설정되지 않은 경매입니다.", status: 400 },
        OWN_AUCTION: { msg: "본인의 경매는 즉시구매할 수 없습니다.", status: 400 },
      }
      const mapped = errorMap[error.message]
      if (mapped) {
        return NextResponse.json({ error: mapped.msg }, { status: mapped.status })
      }
    }
    console.error("즉시구매 에러:", error)
    return NextResponse.json(
      { error: "즉시구매 처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
