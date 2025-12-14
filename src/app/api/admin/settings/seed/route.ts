import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 기본 설정 데이터
const DEFAULT_SETTINGS = [
  // 사이트 기본 설정
  { key: 'site_name', value: 'NexiBase' },
  { key: 'site_description', value: 'Next.js 기반의 확장 가능한 웹 서비스 플랫폼' },
  { key: 'site_logo', value: '' },

  // 회원 설정
  { key: 'signup_enabled', value: 'true' },
  { key: 'email_verification_required', value: 'false' },

  // 푸터 설정
  { key: 'footer_copyright', value: '© 2025 NexiBase. All rights reserved.' },
  { key: 'footer_links', value: JSON.stringify([
    { label: '이용약관', url: '/policy/terms' },
    { label: '개인정보처리방침', url: '/policy/privacy' }
  ])},
]

// 기본 설정 생성
export async function POST() {
  try {
    // 이미 존재하는 설정 키 확인
    const existingKeys = await prisma.setting.findMany({
      where: {
        key: { in: DEFAULT_SETTINGS.map(s => s.key) }
      },
      select: { key: true }
    })

    const existingKeySet = new Set(existingKeys.map(s => s.key))

    // 존재하지 않는 설정만 생성
    const settingsToCreate = DEFAULT_SETTINGS.filter(s => !existingKeySet.has(s.key))

    if (settingsToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 기본 설정이 이미 존재합니다.',
        created: 0
      })
    }

    // 설정 생성
    const result = await prisma.setting.createMany({
      data: settingsToCreate
    })

    return NextResponse.json({
      success: true,
      message: `${result.count}개의 기본 설정이 생성되었습니다.`,
      created: result.count,
      settings: settingsToCreate.map(s => s.key)
    })

  } catch (error) {
    console.error('기본 설정 생성 에러:', error)
    return NextResponse.json(
      { error: '기본 설정 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
