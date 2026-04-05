import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/home-widgets — active widgets by zone, sorted
export async function GET() {
  try {
    const widgets = await prisma.homeWidget.findMany({
      where: { isActive: true },
      orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
    })

    // Group by zone
    const grouped: Record<string, typeof widgets> = {}
    for (const widget of widgets) {
      if (!grouped[widget.zone]) grouped[widget.zone] = []
      grouped[widget.zone].push({
        ...widget,
        settings: widget.settings ? widget.settings : null,
      })
    }

    return NextResponse.json({ widgets: grouped })
  } catch (error) {
    console.error('위젯 조회 에러:', error)
    return NextResponse.json({ widgets: {} })
  }
}
