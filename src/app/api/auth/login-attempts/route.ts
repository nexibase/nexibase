import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")

  if (!email) {
    return NextResponse.json({ failCount: 0 })
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  // Look up the most recent successful login within the last hour
  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: {
      email,
      success: true,
      createdAt: { gte: oneHourAgo },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  // Count failures since the last success (or within the past hour)
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
