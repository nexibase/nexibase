import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 공개 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const categorySlug = searchParams.get('category')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'latest' // latest, popular, price_asc, price_desc

    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isActive: true
    }

    // 카테고리 필터
    if (categorySlug) {
      const category = await prisma.productCategory.findUnique({
        where: { slug: categorySlug }
      })
      if (category) {
        where.categoryId = category.id
      }
    }

    // 검색 (이름, 간단 설명, 상세 설명에서 검색)
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { content: { contains: search } }
      ]
    }

    // 정렬
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = { createdAt: 'desc' }
    switch (sort) {
      case 'popular':
        orderBy = { soldCount: 'desc' }
        break
      case 'price_asc':
        orderBy = { price: 'asc' }
        break
      case 'price_desc':
        orderBy = { price: 'desc' }
        break
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          options: {
            where: { isActive: true },
            select: { price: true, stock: true }
          }
        },
        orderBy: [{ sortOrder: 'asc' }, orderBy],
        skip,
        take: limit
      }),
      prisma.product.count({ where })
    ])

    // 상품별 가격 범위 및 재고 계산
    const formattedProducts = products.map(product => {
      const images = product.images ? JSON.parse(product.images) : []

      // 옵션이 있으면 옵션 기준, 없으면 기본 가격
      let minPrice = product.price
      let maxPrice = product.price
      let totalStock = 0

      if (product.options.length > 0) {
        const prices = product.options.map(o => o.price)
        minPrice = Math.min(...prices)
        maxPrice = Math.max(...prices)
        totalStock = product.options.reduce((sum, o) => sum + o.stock, 0)
      } else {
        // 옵션 없는 상품은 상품 재고 사용
        totalStock = product.stock
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
        isSoldOut: product.isSoldOut || totalStock <= 0,
        soldCount: product.soldCount,
        hasOptions: product.options.length > 0
      }
    })

    return NextResponse.json({
      success: true,
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('상품 목록 조회 에러:', error)
    return NextResponse.json({ error: '상품 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
