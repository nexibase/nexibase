import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "12")
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status && ["pending", "active", "ended"].includes(status)) {
      where.status = status
    }

    // 상태 우선순위: active → pending → ended, 같은 상태 내에서는 마감 임박순
    const statusOrder = { active: 0, pending: 1, ended: 2 } as Record<string, number>

    const [rawAuctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: {
          seller: { select: { id: true, nickname: true, image: true } },
        },
        orderBy: [{ endsAt: "asc" }],
        skip,
        take: limit,
      }),
      prisma.auction.count({ where }),
    ])

    // 특정 상태 필터가 없을 때만 상태 우선순위 정렬 적용
    const auctions = status
      ? rawAuctions
      : [...rawAuctions].sort((a: typeof rawAuctions[number], b: typeof rawAuctions[number]) => {
          const orderDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
          if (orderDiff !== 0) return orderDiff
          // 같은 상태면: active는 마감 임박순, pending은 시작 빠른순, ended는 최근 종료순
          if (a.status === "ended") return new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime()
          return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime()
        })

    return NextResponse.json({
      success: true,
      auctions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("경매 목록 조회 에러:", error)
    return NextResponse.json(
      { error: "경매 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      image,
      startingPrice,
      buyNowPrice,
      bidIncrement,
      startsAt,
      endsAt,
    } = body

    if (!title || !description || !startingPrice || !startsAt || !endsAt) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      )
    }

    const parsedStartingPrice = parseInt(startingPrice)
    const parsedBuyNowPrice = buyNowPrice ? parseInt(buyNowPrice) : null
    const parsedBidIncrement = bidIncrement ? parseInt(bidIncrement) : 1000
    const parsedStartsAt = new Date(startsAt)
    const parsedEndsAt = new Date(endsAt)

    if (parsedStartingPrice < 1000) {
      return NextResponse.json(
        { error: "시작가는 1,000원 이상이어야 합니다." },
        { status: 400 }
      )
    }

    if (parsedBuyNowPrice && parsedBuyNowPrice <= parsedStartingPrice) {
      return NextResponse.json(
        { error: "즉시구매가는 시작가보다 높아야 합니다." },
        { status: 400 }
      )
    }

    if (parsedEndsAt <= parsedStartsAt) {
      return NextResponse.json(
        { error: "종료 시간은 시작 시간 이후여야 합니다." },
        { status: 400 }
      )
    }

    // 시작 시간이 현재 이전이면 바로 active
    const now = new Date()
    const status = parsedStartsAt <= now ? "active" : "pending"

    const auction = await prisma.auction.create({
      data: {
        sellerId: user.id,
        title,
        description,
        image: image || null,
        startingPrice: parsedStartingPrice,
        currentPrice: parsedStartingPrice,
        buyNowPrice: parsedBuyNowPrice,
        bidIncrement: parsedBidIncrement,
        startsAt: parsedStartsAt,
        endsAt: parsedEndsAt,
        status,
      },
      include: {
        seller: { select: { id: true, nickname: true } },
      },
    })

    return NextResponse.json(
      { success: true, auction },
      { status: 201 }
    )
  } catch (error) {
    console.error("경매 등록 에러:", error)
    return NextResponse.json(
      { error: "경매 등록에 실패했습니다." },
      { status: 500 }
    )
  }
}
