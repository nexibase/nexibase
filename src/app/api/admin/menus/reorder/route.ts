import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// PUT /api/admin/menus/reorder — bulk update sortOrder and parentId
export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { items } = body as {
      items: Array<{ id: number; sortOrder: number; parentId: number | null }>
    }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.menu.update({
          where: { id: item.id },
          data: {
            sortOrder: item.sortOrder,
            parentId: item.parentId,
          },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('failed to reorder menus:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
