import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { autoTranslateEntity, invalidateAutoTranslations } from '@/lib/translation/auto-translate'

// 콘텐츠 상세 조회
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
    const contentId = parseInt(id)

    if (isNaN(contentId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { translations: true }
    })

    if (!content) {
      return NextResponse.json(
        { error: '콘텐츠를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      content
    })
  } catch (error) {
    console.error('콘텐츠 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 콘텐츠 수정
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
    const contentId = parseInt(id)

    if (isNaN(contentId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, content, isPublic, translations } = body

    if (!title) {
      return NextResponse.json(
        { error: '제목은 필수입니다.' },
        { status: 400 }
      )
    }

    const existing = await prisma.content.findUnique({
      where: { id: contentId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: '콘텐츠를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const newTitle = title
    const newContent = content ?? existing.content
    const titleChanged = existing.title !== newTitle
    const contentChanged = existing.content !== newContent

    const updated = await prisma.content.update({
      where: { id: contentId },
      data: {
        title: newTitle,
        content: newContent,
        isPublic: isPublic ?? existing.isPublic
      }
    })

    // title / content 변경 시 자동 번역 재실행
    if (titleChanged || contentChanged) {
      try {
        await invalidateAutoTranslations('content', contentId)
        await autoTranslateEntity('content', contentId, {
          title: updated.title,
          content: updated.content,
        })
      } catch (translateError) {
        console.error('[auto-translate] content 수정 번역 실패:', translateError)
      }
    }

    // 수동 번역 저장 (source='manual')
    if (translations && typeof translations === 'object') {
      for (const [locale, fields] of Object.entries(translations as Record<string, { title: string; content: string }>)) {
        try {
          await prisma.contentTranslation.upsert({
            where: { contentId_locale: { contentId, locale } },
            create: { contentId, locale, title: fields.title, content: fields.content, source: 'manual' },
            update: { title: fields.title, content: fields.content, source: 'manual' },
          })
        } catch (upsertError) {
          console.error(`[manual-translate] content locale=${locale} 저장 실패:`, upsertError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '콘텐츠가 수정되었습니다.',
      content: updated
    })

  } catch (error) {
    console.error('콘텐츠 수정 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 콘텐츠 삭제
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
    const contentId = parseInt(id)

    if (isNaN(contentId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const existing = await prisma.content.findUnique({
      where: { id: contentId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: '콘텐츠를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await prisma.content.delete({
      where: { id: contentId }
    })

    return NextResponse.json({
      success: true,
      message: '콘텐츠가 삭제되었습니다.'
    })

  } catch (error) {
    console.error('콘텐츠 삭제 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
