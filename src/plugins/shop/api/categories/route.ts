import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 공개 카테고리 목록 조회
export async function GET() {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            products: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    })

    return NextResponse.json({
      success: true,
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        productCount: cat._count.products
      }))
    })
  } catch (error) {
    console.error('카테고리 목록 조회 에러:', error)
    return NextResponse.json({ error: '카테고리 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
