import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status && ["pending", "active", "ended"].includes(status)) {
      where.status = status
    }
    if (search) {
      where.title = { contains: search }
    }

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: {
          seller: { select: { id: true, nickname: true, email: true } },
          winner: { select: { id: true, nickname: true } },
          _count: { select: { bids: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auction.count({ where }),
    ])

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
    console.error("관리자 경매 목록 에러:", error)
    return NextResponse.json(
      { error: "경매 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}
