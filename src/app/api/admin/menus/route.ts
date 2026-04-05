import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// GET /api/admin/menus — full menu tree for admin
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const menus = await prisma.menu.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }],
    })

    const header = menus.filter(m => m.position === 'header')
    const footer = menus.filter(m => m.position === 'footer')

    return NextResponse.json({ header, footer })
  } catch (error) {
    console.error('관리자 메뉴 조회 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// POST /api/admin/menus — create menu item
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { parentId, position, groupName, label, url, icon, target, visibility, isActive, sortOrder } = body

    if (!label || !url || !position) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }

    const menu = await prisma.menu.create({
      data: {
        parentId: parentId || null,
        position,
        groupName: groupName || null,
        label,
        url,
        icon: icon || null,
        target: target || '_self',
        visibility: visibility || 'all',
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder || 0,
      },
    })

    return NextResponse.json({ menu })
  } catch (error) {
    console.error('메뉴 생성 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
