import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const jobs = await prisma.withdrawalJob.findMany({
    orderBy: { id: 'desc' },
    take: 100,
    include: {
      user: { select: { nickname: true } },
    },
  })
  return NextResponse.json({
    jobs: jobs.map(j => ({
      id: j.id,
      userId: j.userId,
      anonNickname: j.user?.nickname ?? null,
      status: j.status,
      attempts: j.attempts,
      lastError: j.lastError,
      reasonCode: j.reasonCode,
      reasonText: j.reasonText,
      createdAt: j.createdAt,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
    })),
  })
}
