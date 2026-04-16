import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '30')
    const status = searchParams.get('status') || ''

    const skip = (page - 1) * limit
    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    where.startedAt = { gte: thirtyDaysAgo }

    const [logs, total] = await Promise.all([
      prisma.vibeRecipeGenerationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      prisma.vibeRecipeGenerationLog.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Failed to fetch generation logs:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
