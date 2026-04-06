import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// 상품 상세 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { id } = await params
    const productId = parseInt(id)

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        options: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
        },
        _count: { select: { orderItems: true } }
      }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        images: product.images ? JSON.parse(product.images) : [],
        orderCount: product._count.orderItems
      }
    })
  } catch (error) {
    console.error('상품 상세 조회 에러:', error)
    return NextResponse.json({ error: '상품 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 상품 수정
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { id } = await params
    const productId = parseInt(id)
    const body = await request.json()

    const {
      name, slug, categoryId, description, content,
      price, originPrice, stock, images,
      optionName1, optionName2, optionName3,
      isActive, isSoldOut, sortOrder
    } = body

    // 슬러그 중복 체크 (자신 제외)
    if (slug) {
      const existing = await prisma.product.findFirst({
        where: { slug, id: { not: productId } }
      })
      if (existing) {
        return NextResponse.json({ error: '이미 존재하는 슬러그입니다.' }, { status: 400 })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug
    if (categoryId !== undefined) updateData.categoryId = categoryId || null
    if (description !== undefined) updateData.description = description || null
    if (content !== undefined) updateData.content = content || null
    if (price !== undefined) updateData.price = parseInt(price)
    if (originPrice !== undefined) updateData.originPrice = originPrice ? parseInt(originPrice) : null
    if (stock !== undefined) updateData.stock = parseInt(stock) || 0
    if (images !== undefined) updateData.images = images ? JSON.stringify(images) : null
    if (optionName1 !== undefined) updateData.optionName1 = optionName1 || null
    if (optionName2 !== undefined) updateData.optionName2 = optionName2 || null
    if (optionName3 !== undefined) updateData.optionName3 = optionName3 || null
    if (isActive !== undefined) updateData.isActive = isActive
    if (isSoldOut !== undefined) updateData.isSoldOut = isSoldOut
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder

    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        options: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
        }
      }
    })

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        images: product.images ? JSON.parse(product.images) : []
      }
    })
  } catch (error) {
    console.error('상품 수정 에러:', error)
    return NextResponse.json({ error: '상품 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 상품 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { id } = await params
    const productId = parseInt(id)

    // 주문 내역 확인
    const orderCount = await prisma.orderItem.count({
      where: { productId }
    })

    if (orderCount > 0) {
      return NextResponse.json({
        error: '주문 내역이 있는 상품은 삭제할 수 없습니다. 비활성화로 처리해주세요.'
      }, { status: 400 })
    }

    await prisma.product.delete({
      where: { id: productId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('상품 삭제 에러:', error)
    return NextResponse.json({ error: '상품 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
