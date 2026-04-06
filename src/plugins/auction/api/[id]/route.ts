import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getViewerCount } from "@/plugins/auction/lib/auction-events"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auctionId = parseInt(id)

    if (isNaN(auctionId)) {
      return NextResponse.json(
        { error: "잘못된 경매 ID입니다." },
        { status: 400 }
      )
    }

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        seller: { select: { id: true, nickname: true, image: true } },
        winner: { select: { id: true, nickname: true } },
        order: { select: { orderNo: true } },
        bids: {
          include: {
            user: { select: { id: true, nickname: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    })

    if (!auction) {
      return NextResponse.json(
        { error: "경매를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    const viewerCount = getViewerCount(auctionId)

    const auctionData = {
      ...auction,
      images: typeof auction.images === "string"
        ? (() => { try { return JSON.parse(auction.images as string) } catch { return [] } })()
        : (auction.images ?? []),
    }

    return NextResponse.json({
      success: true,
      auction: auctionData,
      viewerCount,
    })
  } catch (error) {
    console.error("경매 상세 조회 에러:", error)
    return NextResponse.json(
      { error: "경매 정보를 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}
