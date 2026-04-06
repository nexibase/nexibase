import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// 배송비 정책 목록 조회
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const deliveryFees = await prisma.deliveryFee.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    })

    return NextResponse.json({
      success: true,
      deliveryFees: deliveryFees.map(fee => ({
        ...fee,
        regions: fee.regions ? JSON.parse(fee.regions) : []
      }))
    })
  } catch (error) {
    console.error('배송비 정책 조회 에러:', error)
    return NextResponse.json({ error: '배송비 정책 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 배송비 정책 생성
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { name, regions, fee, freeAmount, isDefault, isActive, sortOrder } = body

    if (!name || fee === undefined) {
      return NextResponse.json({ error: '이름과 배송비는 필수입니다.' }, { status: 400 })
    }

    // 기본 배송비로 설정할 경우 다른 기본 해제
    if (isDefault) {
      await prisma.deliveryFee.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }

    const deliveryFee = await prisma.deliveryFee.create({
      data: {
        name,
        regions: regions ? JSON.stringify(regions) : '[]',
        fee: parseInt(fee),
        freeAmount: freeAmount ? parseInt(freeAmount) : null,
        isDefault: isDefault === true,
        isActive: isActive !== false,
        sortOrder: sortOrder || 0
      }
    })

    return NextResponse.json({
      success: true,
      deliveryFee: {
        ...deliveryFee,
        regions: deliveryFee.regions ? JSON.parse(deliveryFee.regions) : []
      }
    }, { status: 201 })
  } catch (error) {
    console.error('배송비 정책 생성 에러:', error)
    return NextResponse.json({ error: '배송비 정책 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 배송비 정책 수정
export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, regions, fee, freeAmount, isDefault, isActive, sortOrder } = body

    if (!id) {
      return NextResponse.json({ error: '배송비 정책 ID가 필요합니다.' }, { status: 400 })
    }

    // 기본 배송비로 설정할 경우 다른 기본 해제
    if (isDefault) {
      await prisma.deliveryFee.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false }
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (regions !== undefined) updateData.regions = JSON.stringify(regions)
    if (fee !== undefined) updateData.fee = parseInt(fee)
    if (freeAmount !== undefined) updateData.freeAmount = freeAmount ? parseInt(freeAmount) : null
    if (isDefault !== undefined) updateData.isDefault = isDefault
    if (isActive !== undefined) updateData.isActive = isActive
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder

    const deliveryFee = await prisma.deliveryFee.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      deliveryFee: {
        ...deliveryFee,
        regions: deliveryFee.regions ? JSON.parse(deliveryFee.regions) : []
      }
    })
  } catch (error) {
    console.error('배송비 정책 수정 에러:', error)
    return NextResponse.json({ error: '배송비 정책 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 배송비 정책 삭제
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')?.split(',').map(Number).filter(Boolean)

    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: '삭제할 배송비 정책 ID가 필요합니다.' }, { status: 400 })
    }

    // 기본 배송비는 삭제 불가
    const defaultFee = await prisma.deliveryFee.findFirst({
      where: { id: { in: ids }, isDefault: true }
    })

    if (defaultFee) {
      return NextResponse.json({
        error: '기본 배송비 정책은 삭제할 수 없습니다. 다른 정책을 기본으로 설정한 후 삭제해주세요.'
      }, { status: 400 })
    }

    await prisma.deliveryFee.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({ success: true, deletedCount: ids.length })
  } catch (error) {
    console.error('배송비 정책 삭제 에러:', error)
    return NextResponse.json({ error: '배송비 정책 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
