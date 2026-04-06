import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { emitEnded } from "@/plugins/auction/lib/auction-events"
import { createNotification } from "@/lib/notification"

export async function POST(request: NextRequest) {
  try {
    // Cron 시크릿 검증
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "인증 실패" },
        { status: 401 }
      )
    }

    // 만료된 active 경매 조회
    const expiredAuctions = await prisma.auction.findMany({
      where: {
        status: "active",
        endsAt: { lte: new Date() },
      },
      include: {
        seller: { select: { id: true, nickname: true } },
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
          include: {
            user: { select: { id: true, nickname: true } },
          },
        },
      },
    })

    let closedCount = 0

    for (const auction of expiredAuctions) {
      const highestBid = auction.bids[0] || null
      const winnerId = highestBid?.userId || null
      const winnerNickname = highestBid?.user.nickname || null
      const finalPrice = highestBid?.amount || auction.startingPrice

      // 경매 종료 처리
      await prisma.auction.update({
        where: { id: auction.id },
        data: {
          status: "ended",
          winnerId,
          ...(winnerId ? {
            paymentStatus: "pending",
            paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          } : {}),
        },
      })

      // 모든 자동 입찰 비활성화
      await prisma.autoBid.updateMany({
        where: { auctionId: auction.id, isActive: true },
        data: { isActive: false },
      })

      // SSE 이벤트
      emitEnded({
        auctionId: auction.id,
        winnerId,
        winnerNickname,
        finalPrice,
      })

      // 알림 발송
      if (winnerId) {
        // 낙찰자 알림
        createNotification({
          userId: winnerId,
          type: "system",
          title: "경매 낙찰",
          message: `축하합니다! "${auction.title}" 경매에 ${finalPrice.toLocaleString()}원으로 낙찰되었습니다.`,
          link: `/auction/${auction.id}`,
        }).catch(() => {})

        // 판매자 알림
        createNotification({
          userId: auction.sellerId,
          type: "system",
          title: "경매 낙찰 완료",
          message: `"${auction.title}" 경매가 ${finalPrice.toLocaleString()}원에 낙찰되었습니다.`,
          link: `/auction/${auction.id}`,
        }).catch(() => {})
      } else {
        // 유찰 — 판매자에게만 알림
        createNotification({
          userId: auction.sellerId,
          type: "system",
          title: "경매 유찰",
          message: `"${auction.title}" 경매가 입찰 없이 종료되었습니다.`,
          link: `/auction/${auction.id}`,
        }).catch(() => {})
      }

      closedCount++
    }

    // pending → active 전환 (시작 시간 도래)
    const activatedCount = await prisma.auction.updateMany({
      where: {
        status: "pending",
        startsAt: { lte: new Date() },
      },
      data: { status: "active" },
    })

    // 미결제 만료 처리
    const expiredPayments = await prisma.auction.findMany({
      where: {
        paymentStatus: "pending",
        paymentDeadline: { lte: new Date() },
      },
      include: {
        seller: { select: { id: true } },
      },
    })

    let expiredPaymentCount = 0
    let reAuctionCount = 0

    for (const auction of expiredPayments) {
      // 1. 결제 상태를 expired로 변경
      await prisma.auction.update({
        where: { id: auction.id },
        data: { paymentStatus: "expired" },
      })

      // 2. 낙찰자 페널티 누적
      if (auction.winnerId) {
        const user = await prisma.user.findUnique({
          where: { id: auction.winnerId },
          select: { auctionPenaltyCount: true },
        })

        const newCount = (user?.auctionPenaltyCount || 0) + 1
        let banDays = 3
        if (newCount >= 3) banDays = 30
        else if (newCount >= 2) banDays = 10

        await prisma.user.update({
          where: { id: auction.winnerId },
          data: {
            auctionPenaltyCount: newCount,
            auctionBannedUntil: new Date(Date.now() + banDays * 24 * 60 * 60 * 1000),
          },
        })

        // 낙찰자 알림
        createNotification({
          userId: auction.winnerId,
          type: "system",
          title: "경매 미결제 제재",
          message: `미결제로 경매 이용이 ${banDays}일간 제한됩니다.`,
          link: `/auction/${auction.id}`,
        }).catch(() => {})
      }

      // 3. 동일 조건으로 자동 재등록
      const originalDuration = auction.endsAt.getTime() - auction.startsAt.getTime()
      const now = new Date()

      await prisma.auction.create({
        data: {
          sellerId: auction.sellerId,
          title: auction.title,
          description: auction.description,
          images: auction.images,
          startingPrice: auction.startingPrice,
          currentPrice: auction.startingPrice,
          buyNowPrice: auction.buyNowPrice,
          bidIncrement: auction.bidIncrement,
          bidCount: 0,
          startsAt: now,
          endsAt: new Date(now.getTime() + originalDuration),
          status: "active",
          requiresShipping: auction.requiresShipping,
        },
      })
      reAuctionCount++

      // 판매자 알림
      createNotification({
        userId: auction.sellerId,
        type: "system",
        title: "미결제 재경매 등록",
        message: `"${auction.title}" 낙찰자 미결제로 동일 조건으로 재경매가 등록되었습니다.`,
        link: `/auction/${auction.id}`,
      }).catch(() => {})

      expiredPaymentCount++
    }

    return NextResponse.json({
      success: true,
      closedCount,
      activatedCount: activatedCount.count,
      expiredPaymentCount,
      reAuctionCount,
    })
  } catch (error) {
    console.error("경매 자동 종료 에러:", error)
    return NextResponse.json(
      { error: "경매 자동 종료 처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
