import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Activate policy (deactivates other versions of the same slug)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

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

    // Handle within a transaction: 같은 슬러그의 모든 버전 비활성화 후 해당 버전만 활성화
    await prisma.$transaction([
      // Deactivate every version of the same slug
      prisma.policy.updateMany({
        where: { slug: policy.slug },
        data: { isActive: false }
      }),
      // Activate the target version
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
    console.error('failed to activate policy:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
