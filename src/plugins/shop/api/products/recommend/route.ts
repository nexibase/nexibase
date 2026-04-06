import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 추천 상품 조회 (인기 상품, 최근 본 상품 기반)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'popular' // popular, recent
    const limit = parseInt(searchParams.get('limit') || '8')
    const excludeIds = searchParams.get('exclude')?.split(',').map(Number).filter(Boolean) || []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isActive: true,
      isSoldOut: false,
    }

    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds }
    }

    let orderBy = {}

    switch (type) {
      case 'popular':
        // 인기순: 판매량 + 조회수 기반
        orderBy = [
          { soldCount: 'desc' },
          { viewCount: 'desc' },
          { createdAt: 'desc' }
        ]
        break
      case 'new':
        // 신상품
        orderBy = { createdAt: 'desc' }
        break
      case 'viewed':
        // 조회수 기반
        orderBy = { viewCount: 'desc' }
        break
      default:
        orderBy = { soldCount: 'desc' }
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        options: {
          where: { isActive: true },
          select: { price: true, stock: true }
        }
      },
      orderBy,
      take: limit
    })

    // 상품 포맷팅
    const formattedProducts = products.map(product => {
      const images = product.images ? JSON.parse(product.images) : []

      let minPrice = product.price
      let maxPrice = product.price

      if (product.options.length > 0) {
        const prices = product.options.map(o => o.price)
        minPrice = Math.min(...prices)
        maxPrice = Math.max(...prices)
      }

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        originPrice: product.originPrice,
        minPrice,
        maxPrice,
        image: images[0] || null,
        category: product.category,
        isSoldOut: product.isSoldOut,
        soldCount: product.soldCount,
        viewCount: product.viewCount,
        hasOptions: product.options.length > 0
      }
    })

    return NextResponse.json({
      success: true,
      type,
      products: formattedProducts
    })
  } catch (error) {
    console.error('추천 상품 조회 에러:', error)
    return NextResponse.json({ error: '추천 상품 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 최근 본 상품 조회 (상품 ID 목록 기반)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productIds } = body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ success: true, products: [] })
    }

    // 최대 20개로 제한
    const ids = productIds.slice(0, 20).map(Number).filter(Boolean)

    const products = await prisma.product.findMany({
      where: {
        id: { in: ids },
        isActive: true
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        options: {
          where: { isActive: true },
          select: { price: true, stock: true }
        }
      }
    })

    // 원래 순서 유지 (최근 본 순서)
    const productMap = new Map(products.map(p => [p.id, p]))
    const orderedProducts = ids
      .map(id => productMap.get(id))
      .filter(Boolean)

    // 상품 포맷팅
    const formattedProducts = orderedProducts.map(product => {
      if (!product) return null
      const images = product.images ? JSON.parse(product.images) : []

      let minPrice = product.price
      let maxPrice = product.price

      if (product.options.length > 0) {
        const prices = product.options.map(o => o.price)
        minPrice = Math.min(...prices)
        maxPrice = Math.max(...prices)
      }

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        originPrice: product.originPrice,
        minPrice,
        maxPrice,
        image: images[0] || null,
        category: product.category,
        isSoldOut: product.isSoldOut,
        soldCount: product.soldCount,
        hasOptions: product.options.length > 0
      }
    }).filter(Boolean)

    return NextResponse.json({
      success: true,
      products: formattedProducts
    })
  } catch (error) {
    console.error('최근 본 상품 조회 에러:', error)
    return NextResponse.json({ error: '최근 본 상품 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
