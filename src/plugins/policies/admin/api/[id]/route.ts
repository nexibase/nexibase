import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { autoTranslateEntity, invalidateAutoTranslations } from '@/lib/translation/auto-translate'

// 약관 상세 조회
export async function GET(
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
      where: { id: policyId },
      include: { translations: true }
    })

    if (!policy) {
      return NextResponse.json(
        { error: '약관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      policy
    })
  } catch (error) {
    console.error('약관 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 약관 수정
export async function PUT(
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

    const body = await request.json()
    const { title, content, translations } = body

    if (!title) {
      return NextResponse.json(
        { error: '제목은 필수입니다.' },
        { status: 400 }
      )
    }

    const existing = await prisma.policy.findUnique({
      where: { id: policyId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: '약관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const newTitle = title
    const newContent = content ?? existing.content
    const titleChanged = existing.title !== newTitle
    const contentChanged = existing.content !== newContent

    const updated = await prisma.policy.update({
      where: { id: policyId },
      data: {
        title: newTitle,
        content: newContent
      }
    })

    // title / content 변경 시 자동 번역 재실행
    if (titleChanged || contentChanged) {
      try {
        await invalidateAutoTranslations('policy', policyId)
        await autoTranslateEntity('policy', policyId, {
          title: updated.title,
          content: updated.content,
        })
      } catch (translateError) {
        console.error('[auto-translate] policy 수정 번역 실패:', translateError)
      }
    }

    // 수동 번역 저장 (source='manual')
    if (translations && typeof translations === 'object') {
      for (const [locale, fields] of Object.entries(translations as Record<string, { title: string; content: string }>)) {
        try {
          await prisma.policyTranslation.upsert({
            where: { policyId_locale: { policyId, locale } },
            create: { policyId, locale, title: fields.title, content: fields.content, source: 'manual' },
            update: { title: fields.title, content: fields.content, source: 'manual' },
          })
        } catch (upsertError) {
          console.error(`[manual-translate] policy locale=${locale} 저장 실패:`, upsertError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '약관이 수정되었습니다.',
      policy: updated
    })

  } catch (error) {
    console.error('약관 수정 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 약관 삭제
export async function DELETE(
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

    const existing = await prisma.policy.findUnique({
      where: { id: policyId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: '약관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await prisma.policy.delete({
      where: { id: policyId }
    })

    return NextResponse.json({
      success: true,
      message: '약관이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('약관 삭제 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
