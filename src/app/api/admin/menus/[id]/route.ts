import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { autoTranslateEntity, invalidateAutoTranslations } from '@/lib/translation/auto-translate'

// PUT /api/admin/menus/[id] — update menu item
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
    const menuId = parseInt(id)
    const body = await request.json()

    const labelChanged = body.label !== undefined

    const menu = await prisma.menu.update({
      where: { id: menuId },
      data: {
        ...(body.parentId !== undefined && { parentId: body.parentId || null }),
        ...(body.position && { position: body.position }),
        ...(body.groupName !== undefined && { groupName: body.groupName || null }),
        ...(body.label && { label: body.label }),
        ...(body.url && { url: body.url }),
        ...(body.icon !== undefined && { icon: body.icon || null }),
        ...(body.target && { target: body.target }),
        ...(body.visibility && { visibility: body.visibility }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    })

    // Upsert manual translations if provided
    if (body.translations) {
      for (const [locale, fields] of Object.entries(body.translations as Record<string, { label: string }>)) {
        await prisma.menuTranslation.upsert({
          where: { menuId_locale: { menuId: menu.id, locale } },
          create: { menuId: menu.id, locale, label: fields.label, source: 'manual' },
          update: { label: fields.label, source: 'manual' },
        })
      }
    }

    // If label changed, invalidate auto-translations and re-translate
    if (labelChanged) {
      try {
        await invalidateAutoTranslations('menu', menu.id)
        await autoTranslateEntity('menu', menu.id, { label: menu.label })
      } catch (e) {
        console.error('[menu PUT] auto-translate failed:', e)
      }
    }

    return NextResponse.json({ menu })
  } catch (error) {
    console.error('메뉴 수정 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// DELETE /api/admin/menus/[id] — delete menu item (cascade children)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { id } = await params
    const menuId = parseInt(id)

    await prisma.menu.delete({
      where: { id: menuId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('메뉴 삭제 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
