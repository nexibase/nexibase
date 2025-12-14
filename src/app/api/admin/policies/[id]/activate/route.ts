import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 약관 활성화 (해당 슬러그의 다른 버전은 비활성화)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const policyId = parseInt(id)

    if (isNaN(policyId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const policy = await prisma.policy.findUnique({
      where: { id: policyId }
    })

    if (!policy) {
      return NextResponse.json(
        { error: '약관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 트랜잭션으로 처리: 같은 슬러그의 모든 버전 비활성화 후 해당 버전만 활성화
    await prisma.$transaction([
      // 같은 슬러그의 모든 버전 비활성화
      prisma.policy.updateMany({
        where: { slug: policy.slug },
        data: { isActive: false }
      }),
      // 해당 버전 활성화
      prisma.policy.update({
        where: { id: policyId },
        data: { isActive: true }
      })
    ])

    return NextResponse.json({
      success: true,
      message: `${policy.title} (v${policy.version})이 활성화되었습니다.`
    })

  } catch (error) {
    console.error('약관 활성화 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
