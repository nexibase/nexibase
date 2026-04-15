import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Default settings data
const DEFAULT_SETTINGS = [
  // Site basic settings
  { key: 'site_name', value: 'NexiBase' },
  { key: 'site_description', value: 'Next.js 기반의 확장 가능한 웹 서비스 플랫폼' },
  { key: 'site_logo', value: '' },

  // Member settings
  { key: 'signup_enabled', value: 'true' },
  { key: 'email_verification_required', value: 'false' },

  // Footer settings
  { key: 'footer_copyright', value: '© 2025 NexiBase. All rights reserved.' },
  { key: 'footer_links', value: JSON.stringify([
    { label: '이용약관', url: '/policy/terms' },
    { label: '개인정보처리방침', url: '/policy/privacy' }
  ])},
]

// Create default settings
export async function POST() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    // Check for existing setting keys
    const existingKeys = await prisma.setting.findMany({
      where: {
        key: { in: DEFAULT_SETTINGS.map(s => s.key) }
      },
      select: { key: true }
    })

    const existingKeySet = new Set(existingKeys.map(s => s.key))

    // Only create missing settings
    const settingsToCreate = DEFAULT_SETTINGS.filter(s => !existingKeySet.has(s.key))

    if (settingsToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 기본 설정이 이미 존재합니다.',
        created: 0
      })
    }

    // Create setting
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
    console.error('failed to create default settings:', error)
    return NextResponse.json(
      { error: '기본 설정 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
