import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { emitBid, emitExtended } from "@/lib/auction-events"
import { checkBidRateLimit } from "@/lib/auction-rate-limit"

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

    // Rate limit 체크
    const rateCheck = checkBidRateLimit(user.id)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "입찰이 너무 빈번합니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
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
    const amount = parseInt(body.amount)

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "유효한 입찰 금액을 입력해주세요." },
        { status: 400 }
      )
    }

    if (amount > 999_999_999) {
      return NextResponse.json(
        { error: "입찰 금액이 한도를 초과했습니다." },
        { status: 400 }
      )
    }

    // 트랜잭션 + 비관적 잠금
    const result = await prisma.$transaction(async (tx) => {
      // SELECT ... FOR UPDATE
      const [locked] = await tx.$queryRaw<
        {
          id: number
          sellerId: number
          currentPrice: number
          bidIncrement: number
          bidCount: number
          endsAt: Date
          status: string
          buyNowPrice: number | null
        }[]
      >`SELECT id, sellerId, currentPrice, bidIncrement, bidCount, endsAt, status, buyNowPrice
        FROM auctions WHERE id = ${auctionId} FOR UPDATE`

      if (!locked) {
        throw new Error("NOT_FOUND")
      }

      if (locked.status !== "active") {
        throw new Error("NOT_ACTIVE")
      }

      if (locked.sellerId === user.id) {
        throw new Error("OWN_AUCTION")
      }

      const minBid = locked.currentPrice + locked.bidIncrement
      if (amount < minBid) {
        throw new Error(`MIN_BID:${minBid}`)
      }

      // 본인이 최고가 입찰자인지 확인
      const highestBid = await tx.bid.findFirst({
        where: { auctionId },
        orderBy: { amount: "desc" },
      })

      if (highestBid && highestBid.userId === user.id) {
        throw new Error("ALREADY_HIGHEST")
      }

      // 입찰 생성
      const bid = await tx.bid.create({
        data: {
          auctionId,
          userId: user.id,
          amount,
          isAutoBid: false,
        },
      })

      // 경매 업데이트
      const updateData: Record<string, unknown> = {
        currentPrice: amount,
        bidCount: locked.bidCount + 1,
      }

      // 마감 5분 전 입찰이면 5분 연장
      const fiveMinBefore = new Date(locked.endsAt.getTime() - 5 * 60 * 1000)
      const now = new Date()
      let extended = false
      let newEndsAt = locked.endsAt

      if (now >= fiveMinBefore) {
        newEndsAt = new Date(locked.endsAt.getTime() + 5 * 60 * 1000)
        updateData.endsAt = newEndsAt
        extended = true
      }

      await tx.auction.update({
        where: { id: auctionId },
        data: updateData,
      })

      return { bid, extended, newEndsAt }
    })

    // SSE 이벤트 발행 (트랜잭션 밖)
    emitBid({
      auctionId,
      currentPrice: amount,
      bidCount: result.bid.id, // 실제 bidCount는 DB에서 업데이트됨
      bidderNickname: user.nickname,
      amount,
      isAutoBid: false,
      time: result.bid.createdAt.toISOString(),
    })

    if (result.extended) {
      emitExtended({
        auctionId,
        newEndsAt: result.newEndsAt.toISOString(),
      })
    }

    // 자동 입찰 트리거 (비동기, 에러 무시)
    triggerAutoBids(auctionId, user.id, amount).catch((err) =>
      console.error("자동 입찰 트리거 에러:", err)
    )

    return NextResponse.json({
      success: true,
      bid: {
        id: result.bid.id,
        amount: result.bid.amount,
        createdAt: result.bid.createdAt,
      },
      extended: result.extended,
    })
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "NOT_FOUND":
          return NextResponse.json(
            { error: "경매를 찾을 수 없습니다." },
            { status: 404 }
          )
        case "NOT_ACTIVE":
          return NextResponse.json(
            { error: "진행중인 경매가 아닙니다." },
            { status: 400 }
          )
        case "OWN_AUCTION":
          return NextResponse.json(
            { error: "본인의 경매에는 입찰할 수 없습니다." },
            { status: 400 }
          )
        case "ALREADY_HIGHEST":
          return NextResponse.json(
            { error: "이미 최고가 입찰자입니다." },
            { status: 400 }
          )
        default:
          if (error.message.startsWith("MIN_BID:")) {
            const minBid = error.message.split(":")[1]
            return NextResponse.json(
              {
                error: `최소 입찰 금액은 ${parseInt(minBid).toLocaleString()}원입니다.`,
              },
              { status: 400 }
            )
          }
      }
    }
    console.error("입찰 에러:", error)
    return NextResponse.json(
      { error: "입찰 처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

async function triggerAutoBids(
  auctionId: number,
  lastBidderId: number,
  currentPrice: number
) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { bidIncrement: true, status: true },
  })

  if (!auction || auction.status !== "active") return

  // 현재가보다 높은 maxAmount를 가진 활성 자동 입찰 찾기 (방금 입찰한 사람 제외)
  const autoBids = await prisma.autoBid.findMany({
    where: {
      auctionId,
      isActive: true,
      userId: { not: lastBidderId },
      maxAmount: { gte: currentPrice + auction.bidIncrement },
    },
    include: {
      user: { select: { id: true, nickname: true } },
    },
    orderBy: { maxAmount: "desc" },
  })

  if (autoBids.length === 0) return

  const topAutoBid = autoBids[0]
  const bidAmount = Math.min(
    topAutoBid.maxAmount,
    currentPrice + auction.bidIncrement
  )

  // 자동 입찰 실행 (트랜잭션)
  await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<
      { currentPrice: number; bidCount: number; endsAt: Date; status: string }[]
    >`SELECT currentPrice, bidCount, endsAt, status FROM auctions WHERE id = ${auctionId} FOR UPDATE`

    if (!locked || locked.status !== "active") return
    if (bidAmount <= locked.currentPrice) return

    await tx.bid.create({
      data: {
        auctionId,
        userId: topAutoBid.userId,
        amount: bidAmount,
        isAutoBid: true,
      },
    })

    const updateData: Record<string, unknown> = {
      currentPrice: bidAmount,
      bidCount: locked.bidCount + 1,
    }

    // 자동 입찰도 마감 연장 체크
    const fiveMinBefore = new Date(locked.endsAt.getTime() - 5 * 60 * 1000)
    const now = new Date()
    let extended = false
    let newEndsAt = locked.endsAt

    if (now >= fiveMinBefore) {
      newEndsAt = new Date(locked.endsAt.getTime() + 5 * 60 * 1000)
      updateData.endsAt = newEndsAt
      extended = true
    }

    await tx.auction.update({
      where: { id: auctionId },
      data: updateData,
    })

    // maxAmount에 도달하면 비활성화
    if (bidAmount >= topAutoBid.maxAmount) {
      await tx.autoBid.update({
        where: { id: topAutoBid.id },
        data: { isActive: false },
      })
    }

    // SSE 이벤트
    emitBid({
      auctionId,
      currentPrice: bidAmount,
      bidCount: locked.bidCount + 1,
      bidderNickname: topAutoBid.user.nickname,
      amount: bidAmount,
      isAutoBid: true,
      time: new Date().toISOString(),
    })

    if (extended) {
      emitExtended({ auctionId, newEndsAt: newEndsAt.toISOString() })
    }
  })
}
