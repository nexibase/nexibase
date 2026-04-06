import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 상품 찜 여부 확인
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ isWished: false })
    }

    const { searchParams } = new URL(request.url)
    const productId = parseInt(searchParams.get('productId') || '0')

    if (!productId) {
      return NextResponse.json({ isWished: false })
    }

    const wishlist = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: session.id,
          productId
        }
      }
    })

    return NextResponse.json({ isWished: !!wishlist })
  } catch (error) {
    console.error('찜 여부 확인 에러:', error)
    return NextResponse.json({ isWished: false })
  }
}
