import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// PUT /api/admin/home-widgets/layout — bulk save layout
export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { items, create } = body as {
      items: Array<{
        id: number
        zone: string
        sortOrder: number
        colSpan?: number
        rowSpan?: number
        isActive?: boolean
      }>
      create?: {
        widgetKey: string
        zone: string
        title: string
      }
    }

    // 새 위젯 생성
    if (create) {
      const existing = await prisma.homeWidget.findFirst({
        where: { widgetKey: create.widgetKey }
      })
      if (!existing) {
        await prisma.homeWidget.create({
          data: {
            widgetKey: create.widgetKey,
            zone: create.zone,
            title: create.title,
            colSpan: 1,
            rowSpan: 1,
            isActive: true,
            sortOrder: 99,
          }
        })
      }
      return NextResponse.json({ success: true })
    }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.homeWidget.update({
          where: { id: item.id },
          data: {
            zone: item.zone,
            sortOrder: item.sortOrder,
            ...(item.colSpan !== undefined && { colSpan: item.colSpan }),
            ...(item.rowSpan !== undefined && { rowSpan: item.rowSpan }),
            ...(item.isActive !== undefined && { isActive: item.isActive }),
          },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('위젯 레이아웃 저장 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
