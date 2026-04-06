import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// 카테고리 목록 조회
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const categories = await prisma.productCategory.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    })

    return NextResponse.json({
      success: true,
      categories: categories.map(cat => ({
        ...cat,
        productCount: cat._count.products
      }))
    })
  } catch (error) {
    console.error('카테고리 목록 조회 에러:', error)
    return NextResponse.json({ error: '카테고리 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 카테고리 생성
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug, description, sortOrder, isActive } = body

    if (!name || !slug) {
      return NextResponse.json({ error: '이름과 슬러그는 필수입니다.' }, { status: 400 })
    }

    // 슬러그 중복 체크
    const existing = await prisma.productCategory.findUnique({
      where: { slug }
    })
    if (existing) {
      return NextResponse.json({ error: '이미 존재하는 슬러그입니다.' }, { status: 400 })
    }

    const category = await prisma.productCategory.create({
      data: {
        name,
        slug,
        description: description || null,
        sortOrder: sortOrder || 0,
        isActive: isActive !== false
      }
    })

    return NextResponse.json({ success: true, category }, { status: 201 })
  } catch (error) {
    console.error('카테고리 생성 에러:', error)
    return NextResponse.json({ error: '카테고리 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 카테고리 수정
export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, slug, description, sortOrder, isActive } = body

    if (!id) {
      return NextResponse.json({ error: '카테고리 ID가 필요합니다.' }, { status: 400 })
    }

    // 슬러그 중복 체크 (자신 제외)
    if (slug) {
      const existing = await prisma.productCategory.findFirst({
        where: { slug, id: { not: id } }
      })
      if (existing) {
        return NextResponse.json({ error: '이미 존재하는 슬러그입니다.' }, { status: 400 })
      }
    }

    const category = await prisma.productCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        description: description !== undefined ? description : undefined,
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive })
      }
    })

    return NextResponse.json({ success: true, category })
  } catch (error) {
    console.error('카테고리 수정 에러:', error)
    return NextResponse.json({ error: '카테고리 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 카테고리 삭제
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')?.split(',').map(Number).filter(Boolean)

    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: '삭제할 카테고리 ID가 필요합니다.' }, { status: 400 })
    }

    // 카테고리에 속한 상품이 있는지 확인
    const categoriesWithProducts = await prisma.productCategory.findMany({
      where: { id: { in: ids } },
      include: { _count: { select: { products: true } } }
    })

    const hasProducts = categoriesWithProducts.some(cat => cat._count.products > 0)
    if (hasProducts) {
      return NextResponse.json({
        error: '상품이 포함된 카테고리는 삭제할 수 없습니다. 먼저 상품을 이동하거나 삭제해주세요.'
      }, { status: 400 })
    }

    await prisma.productCategory.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({ success: true, deletedCount: ids.length })
  } catch (error) {
    console.error('카테고리 삭제 에러:', error)
    return NextResponse.json({ error: '카테고리 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
