import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const email = searchParams.get("email") || ""
  const ip = searchParams.get("ip") || ""
  const success = searchParams.get("success")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const where: Record<string, unknown> = {}

  if (email) {
    where.email = { contains: email }
  }
  if (ip) {
    where.ip = { contains: ip }
  }
  if (success === "true" || success === "false") {
    where.success = success === "true"
  }
  if (from || to) {
    where.createdAt = {}
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from)
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to)
  }

  const [logs, total] = await Promise.all([
    prisma.loginAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.loginAttempt.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
