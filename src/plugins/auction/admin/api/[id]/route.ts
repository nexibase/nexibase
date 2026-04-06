import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminUser } from "@/lib/auth"
import { emitEnded } from "@/plugins/auction/lib/auction-events"
import { createNotification } from "@/lib/notification"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 401 }
      )
    }

    const { id } = await params
    const auctionId = parseInt(id)

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        seller: { select: { id: true, nickname: true, email: true } },
        winner: { select: { id: true, nickname: true } },
        bids: {
          include: { user: { select: { id: true, nickname: true } } },
          orderBy: { createdAt: "desc" },
        },
        autoBids: {
          include: { user: { select: { id: true, nickname: true } } },
        },
      },
    })

    if (!auction) {
      return NextResponse.json(
        { error: "경매를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, auction })
  } catch (error) {
    console.error("관리자 경매 상세 에러:", error)
    return NextResponse.json(
      { error: "경매 정보를 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 401 }
      )
    }

    const { id } = await params
    const auctionId = parseInt(id)
    const body = await request.json()
    const { action } = body

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        seller: { select: { id: true } },
        bids: { orderBy: { amount: "desc" }, take: 1, include: { user: { select: { id: true, nickname: true } } } },
      },
    })

    if (!auction) {
      return NextResponse.json(
        { error: "경매를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    // 강제 종료
    if (action === "force-end") {
      if (auction.status === "ended") {
        return NextResponse.json(
          { error: "이미 종료된 경매입니다." },
          { status: 400 }
        )
      }

      const highestBid = auction.bids[0] || null
      const winnerId = highestBid?.userId || null
      const winnerNickname = highestBid?.user.nickname || null

      await prisma.auction.update({
        where: { id: auctionId },
        data: { status: "ended", winnerId },
      })

      await prisma.autoBid.updateMany({
        where: { auctionId, isActive: true },
        data: { isActive: false },
      })

      emitEnded({
        auctionId,
        winnerId,
        winnerNickname,
        finalPrice: auction.currentPrice,
      })

      // 알림
      createNotification({
        userId: auction.seller.id,
        type: "system",
        title: "경매 강제 종료",
        message: `관리자에 의해 "${auction.title}" 경매가 종료되었습니다.`,
        link: `/auction/${auctionId}`,
      }).catch(() => {})

      if (winnerId) {
        createNotification({
          userId: winnerId,
          type: "system",
          title: "경매 낙찰 (관리자 종료)",
          message: `"${auction.title}" 경매가 관리자에 의해 종료되어 ${auction.currentPrice.toLocaleString()}원에 낙찰되었습니다.`,
          link: `/auction/${auctionId}`,
        }).catch(() => {})
      }

      return NextResponse.json({
        success: true,
        message: "경매가 강제 종료되었습니다.",
      })
    }

    return NextResponse.json(
      { error: "알 수 없는 액션입니다." },
      { status: 400 }
    )
  } catch (error) {
    console.error("관리자 경매 수정 에러:", error)
    return NextResponse.json(
      { error: "경매 수정 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
