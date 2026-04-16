import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 20)

    const recipes = await prisma.vibeRecipe.findMany({
      take: limit,
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        titleEn: true,
        titleKo: true,
        descriptionEn: true,
        descriptionKo: true,
        difficulty: true,
        type: true,
        generatedAt: true,
      },
    })

    return NextResponse.json({ success: true, recipes })
  } catch (error) {
    console.error('Failed to fetch vibe recipes:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
