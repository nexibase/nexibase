import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 찜 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const skip = (page - 1) * limit

    const [wishlists, total] = await Promise.all([
      prisma.wishlist.findMany({
        where: { userId: session.id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              originPrice: true,
              images: true,
              isActive: true,
              isSoldOut: true,
              stock: true,
              options: {
                where: { isActive: true },
                select: { stock: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.wishlist.count({
        where: { userId: session.id }
      })
    ])

    // 상품 정보 가공
    const items = wishlists.map(w => {
      const images = w.product.images ? JSON.parse(w.product.images) : []
      const totalStock = w.product.options.length > 0
        ? w.product.options.reduce((sum, o) => sum + o.stock, 0)
        : w.product.stock

      return {
        id: w.id,
        productId: w.product.id,
        productName: w.product.name,
        productSlug: w.product.slug,
        price: w.product.price,
        originPrice: w.product.originPrice,
        image: images[0] || null,
        isActive: w.product.isActive,
        isSoldOut: w.product.isSoldOut || totalStock <= 0,
        createdAt: w.createdAt
      }
    })

    return NextResponse.json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('찜 목록 조회 에러:', error)
    return NextResponse.json({ error: '찜 목록을 불러오는데 실패했습니다.' }, { status: 500 })
  }
}

// 찜하기 추가/토글
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { productId } = body

    if (!productId) {
      return NextResponse.json({ error: '상품 ID가 필요합니다.' }, { status: 400 })
    }

    // 상품 존재 확인
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 이미 찜했는지 확인
    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: session.id,
          productId
        }
      }
    })

    if (existing) {
      // 이미 찜함 -> 찜 해제
      await prisma.wishlist.delete({
        where: { id: existing.id }
      })
      return NextResponse.json({ success: true, isWished: false, message: '찜 해제되었습니다.' })
    } else {
      // 찜하기
      await prisma.wishlist.create({
        data: {
          userId: session.id,
          productId
        }
      })
      return NextResponse.json({ success: true, isWished: true, message: '찜 목록에 추가되었습니다.' })
    }
  } catch (error) {
    console.error('찜하기 에러:', error)
    return NextResponse.json({ error: '찜하기에 실패했습니다.' }, { status: 500 })
  }
}

// 찜 해제
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = parseInt(searchParams.get('productId') || '0')

    if (!productId) {
      return NextResponse.json({ error: '상품 ID가 필요합니다.' }, { status: 400 })
    }

    await prisma.wishlist.deleteMany({
      where: {
        userId: session.id,
        productId
      }
    })

    return NextResponse.json({ success: true, message: '찜 해제되었습니다.' })
  } catch (error) {
    console.error('찜 해제 에러:', error)
    return NextResponse.json({ error: '찜 해제에 실패했습니다.' }, { status: 500 })
  }
}
