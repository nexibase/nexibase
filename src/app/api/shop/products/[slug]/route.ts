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

    // 조회수 증가
    await prisma.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } }
    })

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

    return NextResponse.json({
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
        viewCount: product.viewCount + 1,
        soldCount: product.soldCount
      }
    })
  } catch (error) {
    console.error('상품 상세 조회 에러:', error)
    return NextResponse.json({ error: '상품 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
