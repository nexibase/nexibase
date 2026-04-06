import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// 상품 옵션 목록 조회
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

    const options = await prisma.productOption.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    })

    // 옵션값 그룹핑 (1단계, 2단계, 3단계 각각의 고유값)
    const option1Values = [...new Set(options.map(o => o.option1).filter(Boolean))]
    const option2Values = [...new Set(options.map(o => o.option2).filter(Boolean))]
    const option3Values = [...new Set(options.map(o => o.option3).filter(Boolean))]

    return NextResponse.json({
      success: true,
      options,
      optionValues: {
        option1: option1Values,
        option2: option2Values,
        option3: option3Values
      },
      stats: {
        total: options.length,
        active: options.filter(o => o.isActive).length,
        totalStock: options.reduce((sum, o) => sum + o.stock, 0)
      }
    })
  } catch (error) {
    console.error('옵션 목록 조회 에러:', error)
    return NextResponse.json({ error: '옵션 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 상품 옵션 생성
export async function POST(
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

    // 단일 옵션 또는 다중 옵션 처리
    const optionsToCreate = Array.isArray(body) ? body : [body]

    const createdOptions = []

    for (const optionData of optionsToCreate) {
      const { option1, option2, option3, price, stock, sku, isActive, sortOrder } = optionData

      if (price === undefined) {
        return NextResponse.json({ error: '가격은 필수입니다.' }, { status: 400 })
      }

      // 중복 체크
      const existing = await prisma.productOption.findFirst({
        where: {
          productId,
          option1: option1 || null,
          option2: option2 || null,
          option3: option3 || null
        }
      })

      if (existing) {
        continue // 중복은 건너뜀
      }

      const option = await prisma.productOption.create({
        data: {
          productId,
          option1: option1 || null,
          option2: option2 || null,
          option3: option3 || null,
          price: parseInt(price),
          stock: stock ? parseInt(stock) : 0,
          sku: sku || null,
          isActive: isActive !== false,
          sortOrder: sortOrder || 0
        }
      })

      createdOptions.push(option)
    }

    return NextResponse.json({
      success: true,
      options: createdOptions,
      createdCount: createdOptions.length
    }, { status: 201 })
  } catch (error) {
    console.error('옵션 생성 에러:', error)
    return NextResponse.json({ error: '옵션 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 상품 옵션 수정 (단일 또는 일괄)
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

    // 단일 옵션 수정
    if (body.optionId) {
      const { optionId, option1, option2, option3, price, stock, sku, isActive, sortOrder } = body

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {}
      if (option1 !== undefined) updateData.option1 = option1 || null
      if (option2 !== undefined) updateData.option2 = option2 || null
      if (option3 !== undefined) updateData.option3 = option3 || null
      if (price !== undefined) updateData.price = parseInt(price)
      if (stock !== undefined) updateData.stock = parseInt(stock)
      if (sku !== undefined) updateData.sku = sku || null
      if (isActive !== undefined) updateData.isActive = isActive
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder

      const option = await prisma.productOption.update({
        where: { id: optionId, productId },
        data: updateData
      })

      return NextResponse.json({ success: true, option })
    }

    // 일괄 수정 (전체 옵션 교체)
    if (body.options && Array.isArray(body.options)) {
      // 기존 옵션 삭제
      await prisma.productOption.deleteMany({
        where: { productId }
      })

      // 새 옵션 생성
      const createdOptions = await prisma.productOption.createMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: body.options.map((opt: any, index: number) => ({
          productId,
          option1: opt.option1 || null,
          option2: opt.option2 || null,
          option3: opt.option3 || null,
          price: parseInt(opt.price),
          stock: opt.stock ? parseInt(opt.stock) : 0,
          sku: opt.sku || null,
          isActive: opt.isActive !== false,
          sortOrder: opt.sortOrder ?? index
        }))
      })

      const options = await prisma.productOption.findMany({
        where: { productId },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
      })

      return NextResponse.json({
        success: true,
        options,
        updatedCount: createdOptions.count
      })
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  } catch (error) {
    console.error('옵션 수정 에러:', error)
    return NextResponse.json({ error: '옵션 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 상품 옵션 삭제
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

    const url = new URL(_request.url!)
    const { searchParams } = url
    const optionIds = searchParams.get('optionIds')?.split(',').map(Number).filter(Boolean)

    if (!optionIds || optionIds.length === 0) {
      return NextResponse.json({ error: '삭제할 옵션 ID가 필요합니다.' }, { status: 400 })
    }

    await prisma.productOption.deleteMany({
      where: {
        id: { in: optionIds },
        productId
      }
    })

    return NextResponse.json({ success: true, deletedCount: optionIds.length })
  } catch (error) {
    console.error('옵션 삭제 에러:', error)
    return NextResponse.json({ error: '옵션 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
