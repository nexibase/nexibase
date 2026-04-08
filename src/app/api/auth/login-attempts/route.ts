import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")

  if (!email) {
    return NextResponse.json({ failCount: 0 })
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  // 최근 1시간 내 마지막 성공 로그인 시점 조회
  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: {
      email,
      success: true,
      createdAt: { gte: oneHourAgo },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  // 마지막 성공 이후 (또는 1시간 내) 실패 횟수
  const failCount = await prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: {
        gte: lastSuccess?.createdAt ?? oneHourAgo,
      },
    },
  })

  return NextResponse.json({ failCount })
}
