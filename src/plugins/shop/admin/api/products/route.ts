import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId')
    const isActive = searchParams.get('isActive')
    const isSoldOut = searchParams.get('isSoldOut')

    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { description: { contains: search } }
      ]
    }

    if (categoryId) {
      where.categoryId = parseInt(categoryId)
    }

    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    if (isSoldOut !== null && isSoldOut !== '') {
      where.isSoldOut = isSoldOut === 'true'
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { options: true, orderItems: true } }
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit
      }),
      prisma.product.count({ where })
    ])

    // 통계
    const stats = await prisma.product.aggregate({
      _count: true,
      where: { isActive: true }
    })

    const soldOutCount = await prisma.product.count({
      where: { isSoldOut: true }
    })

    return NextResponse.json({
      success: true,
      products: products.map(product => ({
        ...product,
        images: product.images ? JSON.parse(product.images) : [],
        optionCount: product._count.options,
        orderCount: product._count.orderItems
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        total,
        active: stats._count,
        soldOut: soldOutCount
      }
    })
  } catch (error) {
    console.error('상품 목록 조회 에러:', error)
    return NextResponse.json({ error: '상품 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 상품 생성
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name, slug, categoryId, description, content,
      price, originPrice, images,
      optionName1, optionName2, optionName3,
      isActive, isSoldOut, sortOrder
    } = body

    if (!name || !slug || price === undefined) {
      return NextResponse.json({ error: '이름, 슬러그, 가격은 필수입니다.' }, { status: 400 })
    }

    // 슬러그 중복 체크
    const existing = await prisma.product.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ error: '이미 존재하는 슬러그입니다.' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        categoryId: categoryId || null,
        description: description || null,
        content: content || null,
        price: parseInt(price),
        originPrice: originPrice ? parseInt(originPrice) : null,
        images: images ? JSON.stringify(images) : null,
        optionName1: optionName1 || null,
        optionName2: optionName2 || null,
        optionName3: optionName3 || null,
        isActive: isActive !== false,
        isSoldOut: isSoldOut === true,
        sortOrder: sortOrder || 0
      },
      include: {
        category: { select: { id: true, name: true, slug: true } }
      }
    })

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        images: product.images ? JSON.parse(product.images) : []
      }
    }, { status: 201 })
  } catch (error) {
    console.error('상품 생성 에러:', error)
    return NextResponse.json({ error: '상품 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 상품 일괄 삭제
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')?.split(',').map(Number).filter(Boolean)

    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: '삭제할 상품 ID가 필요합니다.' }, { status: 400 })
    }

    // 주문된 상품인지 확인
    const productsWithOrders = await prisma.product.findMany({
      where: { id: { in: ids } },
      include: { _count: { select: { orderItems: true } } }
    })

    const hasOrders = productsWithOrders.some(p => p._count.orderItems > 0)
    if (hasOrders) {
      return NextResponse.json({
        error: '주문 내역이 있는 상품은 삭제할 수 없습니다. 비활성화로 처리해주세요.'
      }, { status: 400 })
    }

    // 옵션 먼저 삭제 (CASCADE가 있지만 명시적으로)
    await prisma.productOption.deleteMany({
      where: { productId: { in: ids } }
    })

    await prisma.product.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({ success: true, deletedCount: ids.length })
  } catch (error) {
    console.error('상품 삭제 에러:', error)
    return NextResponse.json({ error: '상품 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
