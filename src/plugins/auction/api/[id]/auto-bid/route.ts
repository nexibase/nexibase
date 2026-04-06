import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

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

    const body = await request.json()
    const maxAmount = parseInt(body.maxAmount)

    if (isNaN(maxAmount) || maxAmount <= 0) {
      return NextResponse.json(
        { error: "유효한 최대 금액을 입력해주세요." },
        { status: 400 }
      )
    }

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: { status: true, currentPrice: true, bidIncrement: true, sellerId: true },
    })

    if (!auction) {
      return NextResponse.json(
        { error: "경매를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    if (auction.status !== "active") {
      return NextResponse.json(
        { error: "진행중인 경매가 아닙니다." },
        { status: 400 }
      )
    }

    if (auction.sellerId === user.id) {
      return NextResponse.json(
        { error: "본인의 경매에는 자동 입찰을 설정할 수 없습니다." },
        { status: 400 }
      )
    }

    if (maxAmount < auction.currentPrice + auction.bidIncrement) {
      return NextResponse.json(
        {
          error: `최대 금액은 ${(auction.currentPrice + auction.bidIncrement).toLocaleString()}원 이상이어야 합니다.`,
        },
        { status: 400 }
      )
    }

    // upsert: 기존 설정이 있으면 업데이트, 없으면 생성
    const autoBid = await prisma.autoBid.upsert({
      where: {
        auctionId_userId: { auctionId, userId: user.id },
      },
      update: {
        maxAmount,
        isActive: true,
      },
      create: {
        auctionId,
        userId: user.id,
        maxAmount,
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      autoBid: {
        id: autoBid.id,
        maxAmount: autoBid.maxAmount,
        isActive: autoBid.isActive,
      },
    })
  } catch (error) {
    console.error("자동 입찰 설정 에러:", error)
    return NextResponse.json(
      { error: "자동 입찰 설정에 실패했습니다." },
      { status: 500 }
    )
  }
}
