import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 })
  }

  try {
    const { count = 1000, months = 3 } = await request.json().catch(() => ({}))
    const total = Math.min(count, 5000)
    const password = await bcrypt.hash("test1234", 10)

    const now = new Date()
    const startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - months)

    const totalMs = now.getTime() - startDate.getTime()
    const users = []

    for (let i = 0; i < total; i++) {
      // Random signup date (weighted toward more recent dates)
      const ratio = Math.pow(Math.random(), 0.7) // 최근에 더 많이 분포
      const createdAt = new Date(startDate.getTime() + totalMs * ratio)

      users.push({
        email: `seed_${i + 1}_${Date.now()}@test.com`,
        nickname: `시드유저${i + 1}`,
        password,
        role: "user",
        status: "active",
        level: Math.floor(Math.random() * 5) + 1,
        createdAt,
        updatedAt: createdAt,
      })
    }

    // Insert in batches of 100
    let created = 0
    for (let i = 0; i < users.length; i += 100) {
      const batch = users.slice(i, i + 100)
      const result = await prisma.user.createMany({
        data: batch,
        skipDuplicates: true,
      })
      created += result.count
    }

    return NextResponse.json({
      success: true,
      message: `${created}명의 시드 회원이 등록되었습니다.`,
      created,
    })
  } catch (error) {
    console.error("failed to seed:", error)
    return NextResponse.json(
      { success: false, message: "시드 생성 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

// Delete seed members
export async function DELETE() {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 })
  }

  try {
    const result = await prisma.user.deleteMany({
      where: { email: { startsWith: "seed_" } },
    })

    return NextResponse.json({
      success: true,
      message: `${result.count}명의 시드 회원이 삭제되었습니다.`,
      deleted: result.count,
    })
  } catch (error) {
    console.error("failed to delete seed:", error)
    return NextResponse.json(
      { success: false, message: "시드 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
