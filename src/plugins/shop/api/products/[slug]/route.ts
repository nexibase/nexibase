import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 상품 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const product = await prisma.product.findUnique({
      where: { slug, isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        options: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
        }
      }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 조회수 증가 (IP 기반 중복 방지)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'
    const viewKey = `product_view_${product.id}_${clientIp}`
    const viewedCookie = request.cookies.get(viewKey)?.value

    const shouldIncrement = !viewedCookie
    let viewCount = product.viewCount

    if (shouldIncrement) {
      const updated = await prisma.product.update({
        where: { id: product.id },
        data: { viewCount: { increment: 1 } }
      })
      viewCount = updated.viewCount
    }

    const images = product.images ? JSON.parse(product.images) : []

    // 옵션값 그룹핑 (3단계 옵션 UI용)
    const optionValues: {
      option1: string[]
      option2: string[]
      option3: string[]
    } = {
      option1: [...new Set(product.options.map(o => o.option1).filter(Boolean))] as string[],
      option2: [...new Set(product.options.map(o => o.option2).filter(Boolean))] as string[],
      option3: [...new Set(product.options.map(o => o.option3).filter(Boolean))] as string[]
    }

    // 가격 범위 및 재고
    let minPrice = product.price
    let maxPrice = product.price
    let totalStock = product.stock // 옵션 없는 상품용 기본 재고

    if (product.options.length > 0) {
      const prices = product.options.map(o => o.price)
      minPrice = Math.min(...prices)
      maxPrice = Math.max(...prices)
      totalStock = product.options.reduce((sum, o) => sum + o.stock, 0)
    }

    // 리뷰/Q&A 개수 및 평균 평점 조회
    const [reviewStats, qnaCount] = await Promise.all([
      prisma.productReview.aggregate({
        where: { productId: product.id },
        _count: true,
        _avg: { rating: true }
      }),
      prisma.productQna.count({
        where: { productId: product.id }
      })
    ])

    const response = NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        content: product.content,
        price: product.price,
        originPrice: product.originPrice,
        minPrice,
        maxPrice,
        images,
        category: product.category,
        optionName1: product.optionName1,
        optionName2: product.optionName2,
        optionName3: product.optionName3,
        options: product.options.map(o => ({
          id: o.id,
          option1: o.option1,
          option2: o.option2,
          option3: o.option3,
          price: o.price,
          stock: o.stock,
          isAvailable: o.stock > 0
        })),
        optionValues,
        hasOptions: product.options.length > 0,
        stock: product.stock,
        totalStock,
        isSoldOut: product.isSoldOut || totalStock <= 0,
        viewCount,
        soldCount: product.soldCount,
        reviewCount: reviewStats._count,
        avgRating: reviewStats._avg.rating || 0,
        qnaCount
      }
    })

    // 조회 기록 쿠키 설정 (24시간)
    if (shouldIncrement) {
      response.cookies.set(viewKey, '1', {
        maxAge: 60 * 60 * 24, // 24시간
        httpOnly: true,
        sameSite: 'lax'
      })
    }

    return response
  } catch (error) {
    console.error('상품 상세 조회 에러:', error)
    return NextResponse.json({ error: '상품 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
