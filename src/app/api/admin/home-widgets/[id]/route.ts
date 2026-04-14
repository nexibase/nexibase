import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// PUT /api/admin/home-widgets/[id] — update widget settings/zone/order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { id } = await params
    const widgetId = parseInt(id)
    const body = await request.json()

    const widget = await prisma.homeWidget.update({
      where: { id: widgetId },
      data: {
        ...(body.zone && { zone: body.zone }),
        ...(body.title && { title: body.title }),
        ...(body.settings !== undefined && { settings: typeof body.settings === 'string' ? body.settings : JSON.stringify(body.settings) }),
        ...(body.colSpan !== undefined && { colSpan: body.colSpan }),
        ...(body.rowSpan !== undefined && { rowSpan: body.rowSpan }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    })

    return NextResponse.json({ widget })
  } catch (error) {
    console.error('위젯 수정 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// DELETE /api/admin/home-widgets/[id] — 위젯 배치 해제 (DB에서 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { id } = await params
    const widgetId = parseInt(id)

    await prisma.homeWidget.delete({
      where: { id: widgetId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('위젯 삭제 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
