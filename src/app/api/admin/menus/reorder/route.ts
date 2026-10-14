import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { MenuOrderError, parseMenuOrderRequest, validateMenuOrder } from '@/lib/menus/reorder'

// Apply ordering and hierarchy changes together; stale clients must reload.
export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    const payload = parseMenuOrderRequest(await request.json())
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM menus ORDER BY id FOR UPDATE`
      const menus = await tx.menu.findMany({ select: { id: true, parentId: true, position: true, sortOrder: true } })
      validateMenuOrder(menus, payload)
      for (const item of payload.items) {
        await tx.menu.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder, parentId: item.parentId } })
      }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof MenuOrderError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof SyntaxError) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    console.error('failed to reorder menus:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
