import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 })
  }

  const period = request.nextUrl.searchParams.get("period") || "30" // 7, 30, 90
  const days = parseInt(period)

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  // Aggregate daily signups
  const users = await prisma.user.findMany({
    where: { createdAt: { gte: startDate }, deletedAt: null },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  // Aggregate by date
  const dateMap = new Map<string, number>()

  // Initialize every date in the range
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().split("T")[0]
    dateMap.set(key, 0)
  }

  // Aggregate actual signups
  for (const user of users) {
    const key = user.createdAt.toISOString().split("T")[0]
    dateMap.set(key, (dateMap.get(key) || 0) + 1)
  }

  const trends = Array.from(dateMap.entries()).map(([date, count]) => ({
    date,
    count,
  }))

  // Total signups
  const totalUsers = await prisma.user.count({ where: { deletedAt: null } })
  const periodUsers = users.length

  return NextResponse.json({
    success: true,
    trends,
    totalUsers,
    periodUsers,
    period: days,
  })
}
