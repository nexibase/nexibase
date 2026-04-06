import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "12")
    const skip = (page - 1) * limit

    const statusFilter = status && ["pending", "active", "ended"].includes(status) ? status : null
    const whereClause = statusFilter
      ? Prisma.sql`WHERE a.status = ${statusFilter}`
      : Prisma.sql`WHERE 1=1`

    const [auctions, totalResult] = await Promise.all([
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          a.*,
          JSON_OBJECT('id', u.id, 'nickname', u.nickname, 'image', u.image) as seller
        FROM auctions a
        JOIN users u ON a.sellerId = u.id
        ${whereClause}
        ORDER BY FIELD(a.status, 'active', 'pending', 'ended'),
          CASE
            WHEN a.status = 'active' THEN a.endsAt
            WHEN a.status = 'pending' THEN a.startsAt
            ELSE NULL
          END ASC,
          CASE
            WHEN a.status = 'ended' THEN a.endsAt
            ELSE NULL
          END DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ cnt: bigint }]>`
        SELECT COUNT(*) as cnt FROM auctions a
        ${whereClause}
      `,
    ])

    const total = Number(totalResult[0].cnt)

    // seller JSON 파싱 + BigInt 변환
    const parsed = auctions.map((a) => {
      const obj: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(a)) {
        obj[key] = typeof val === "bigint" ? Number(val) : val
      }
      obj.seller = typeof obj.seller === "string" ? JSON.parse(obj.seller as string) : obj.seller
      return obj
    })

    return NextResponse.json({
      success: true,
      auctions: parsed,
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

    const body = await request.json()
    const {
      title,
      description,
      images,
      startingPrice,
      buyNowPrice,
      bidIncrement,
      startsAt,
      endsAt,
      requiresShipping,
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
        images: Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : null,
        startingPrice: parsedStartingPrice,
        currentPrice: parsedStartingPrice,
        buyNowPrice: parsedBuyNowPrice,
        bidIncrement: parsedBidIncrement,
        startsAt: parsedStartsAt,
        endsAt: parsedEndsAt,
        status,
        requiresShipping: requiresShipping !== false,
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
