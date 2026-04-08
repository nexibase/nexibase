import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
  }

  const page = parseInt(request.nextUrl.searchParams.get("page") || "1")
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20")

  const where = { email: session.email }

  const [logs, total] = await Promise.all([
    prisma.loginAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        ip: true,
        success: true,
        createdAt: true,
      },
    }),
    prisma.loginAttempt.count({ where }),
  ])

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
