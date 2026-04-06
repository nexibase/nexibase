import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { unlink } from 'fs/promises'
import path from 'path'

// 상품 리뷰 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 리뷰 조회
    const [reviews, total] = await Promise.all([
      prisma.productReview.findMany({
        where: {
          productId: product.id,
          isActive: true
        },
        include: {
          user: {
            select: { id: true, nickname: true, image: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.productReview.count({
        where: {
          productId: product.id,
          isActive: true
        }
      })
    ])

    // 평균 별점 계산
    const avgRating = await prisma.productReview.aggregate({
      where: {
        productId: product.id,
        isActive: true
      },
      _avg: { rating: true }
    })

    // 현재 사용자의 리뷰 여부 확인
    const currentUserId = session ? session.id : null

    return NextResponse.json({
      reviews: reviews.map(review => ({
        ...review,
        user: {
          ...review.user,
          nickname: maskName(review.user.nickname || '익명')
        },
        isOwner: currentUserId !== null && currentUserId === review.userId
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      avgRating: avgRating._avg.rating || 0
    })
  } catch (error) {
    console.error('리뷰 목록 조회 에러:', error)
    return NextResponse.json({ error: '리뷰를 불러오는데 실패했습니다.' }, { status: 500 })
  }
}

// 리뷰 작성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { slug } = await params
    const body = await request.json()
    const { orderItemId, rating, content, images } = body

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 주문 상품 확인 (배송완료 상태인지)
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          select: { id: true, userId: true, status: true }
        }
      }
    })

    if (!orderItem) {
      return NextResponse.json({ error: '주문 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (orderItem.order.userId !== session.id) {
      return NextResponse.json({ error: '본인의 주문만 리뷰할 수 있습니다.' }, { status: 403 })
    }

    if (!['delivered', 'confirmed'].includes(orderItem.order.status)) {
      return NextResponse.json({ error: '배송완료 후 리뷰를 작성할 수 있습니다.' }, { status: 400 })
    }

    if (orderItem.productId !== product.id) {
      return NextResponse.json({ error: '해당 상품의 주문이 아닙니다.' }, { status: 400 })
    }

    // 이미 리뷰 작성했는지 확인
    const existingReview = await prisma.productReview.findUnique({
      where: { orderItemId }
    })

    if (existingReview) {
      return NextResponse.json({ error: '이미 리뷰를 작성하셨습니다.' }, { status: 400 })
    }

    // 리뷰 생성
    const review = await prisma.productReview.create({
      data: {
        productId: product.id,
        userId: session.id,
        orderId: orderItem.order.id,
        orderItemId,
        rating: Math.min(5, Math.max(1, rating)),
        content,
        images: images ? JSON.stringify(images) : null
      },
      include: {
        user: {
          select: { id: true, nickname: true, image: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      review: {
        ...review,
        user: {
          ...review.user,
          nickname: maskName(review.user.nickname || '익명')
        }
      }
    })
  } catch (error) {
    console.error('리뷰 작성 에러:', error)
    return NextResponse.json({ error: '리뷰 작성에 실패했습니다.' }, { status: 500 })
  }
}

// 리뷰 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { slug } = await params
    const body = await request.json()
    const { reviewId, rating, content, images } = body

    if (!reviewId) {
      return NextResponse.json({ error: '리뷰 ID가 필요합니다.' }, { status: 400 })
    }

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 리뷰 찾기
    const existingReview = await prisma.productReview.findUnique({
      where: { id: reviewId },
      include: {
        user: {
          select: { id: true, nickname: true, image: true }
        }
      }
    })

    if (!existingReview) {
      return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 본인 리뷰인지 확인
    if (existingReview.userId !== session.id) {
      return NextResponse.json({ error: '본인의 리뷰만 수정할 수 있습니다.' }, { status: 403 })
    }

    // 해당 상품의 리뷰인지 확인
    if (existingReview.productId !== product.id) {
      return NextResponse.json({ error: '해당 상품의 리뷰가 아닙니다.' }, { status: 400 })
    }

    // 기존 이미지와 새 이미지 비교하여 삭제된 이미지 처리
    const newImages: string[] = images || []
    if (existingReview.images) {
      try {
        const oldImages: string[] = JSON.parse(existingReview.images)
        // 기존 이미지 중 새 이미지에 없는 것들 삭제
        const deletedImages = oldImages.filter(img => !newImages.includes(img))
        for (const imageUrl of deletedImages) {
          const filePath = path.join(process.cwd(), 'public', imageUrl)
          const thumbPath = filePath.replace(/(\.(webp|gif))$/i, '-thumb.webp')
          try {
            await unlink(filePath)
          } catch {
            // 파일이 없어도 무시
          }
          try {
            await unlink(thumbPath)
          } catch {
            // 파일이 없어도 무시
          }
        }
      } catch {
        // JSON 파싱 에러 무시
      }
    }

    // 리뷰 수정
    const review = await prisma.productReview.update({
      where: { id: reviewId },
      data: {
        rating: Math.min(5, Math.max(1, rating)),
        content,
        images: images && images.length > 0 ? JSON.stringify(images) : null
      },
      include: {
        user: {
          select: { id: true, nickname: true, image: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      review: {
        ...review,
        user: {
          ...review.user,
          nickname: maskName(review.user.nickname || '익명')
        }
      }
    })
  } catch (error) {
    console.error('리뷰 수정 에러:', error)
    return NextResponse.json({ error: '리뷰 수정에 실패했습니다.' }, { status: 500 })
  }
}

// 리뷰 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const reviewId = parseInt(searchParams.get('reviewId') || '0')

    if (!reviewId) {
      return NextResponse.json({ error: '리뷰 ID가 필요합니다.' }, { status: 400 })
    }

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 리뷰 찾기
    const existingReview = await prisma.productReview.findUnique({
      where: { id: reviewId }
    })

    if (!existingReview) {
      return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 본인 리뷰인지 확인
    if (existingReview.userId !== session.id) {
      return NextResponse.json({ error: '본인의 리뷰만 삭제할 수 있습니다.' }, { status: 403 })
    }

    // 해당 상품의 리뷰인지 확인
    if (existingReview.productId !== product.id) {
      return NextResponse.json({ error: '해당 상품의 리뷰가 아닙니다.' }, { status: 400 })
    }

    // 리뷰 이미지 삭제
    if (existingReview.images) {
      try {
        const images = JSON.parse(existingReview.images)
        if (Array.isArray(images)) {
          for (const imageUrl of images) {
            // /uploads/2025/12/xxx.webp -> public/uploads/2025/12/xxx.webp
            const filePath = path.join(process.cwd(), 'public', imageUrl)
            // 썸네일 경로: xxx.webp -> xxx-thumb.webp
            const thumbPath = filePath.replace(/(\.(webp|gif))$/i, '-thumb.webp')

            // 원본 이미지 삭제
            try {
              await unlink(filePath)
            } catch {
              // 파일이 없어도 무시
            }
            // 썸네일 이미지 삭제
            try {
              await unlink(thumbPath)
            } catch {
              // 파일이 없어도 무시
            }
          }
        }
      } catch {
        // JSON 파싱 에러 무시
      }
    }

    // 리뷰 삭제 (소프트 삭제)
    await prisma.productReview.update({
      where: { id: reviewId },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('리뷰 삭제 에러:', error)
    return NextResponse.json({ error: '리뷰 삭제에 실패했습니다.' }, { status: 500 })
  }
}

// 이름 마스킹 (홍*동)
function maskName(name: string): string {
  if (name.length <= 1) return '*'
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}
