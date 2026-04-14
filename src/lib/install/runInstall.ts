import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { localeRegistry } from './_generated-registry'

export interface InstallParams {
  locale: string
  adminEmail: string
  adminPassword: string
  adminNickname: string
  siteName: string
  siteDescription: string
}

export class InstallError extends Error {
  constructor(public code: 'ALREADY_INSTALLED' | 'UNKNOWN_LOCALE' | 'DB_ERROR', message: string) {
    super(message)
    this.name = 'InstallError'
  }
}

export async function runInstall(params: InstallParams): Promise<void> {
  const entry = localeRegistry[params.locale]
  if (!entry) {
    throw new InstallError('UNKNOWN_LOCALE', `Unknown locale: ${params.locale}`)
  }

  const seed = entry.seed
  const hashedPw = await bcrypt.hash(params.adminPassword, 10)

  await prisma.$transaction(async (tx) => {
    // 0. 경쟁 상태 재확인
    const existing = await tx.setting.findUnique({ where: { key: 'site_initialized' } })
    if (existing?.value === 'true') {
      throw new InstallError('ALREADY_INSTALLED', 'Site is already initialized')
    }

    // 1. Admin 계정
    await tx.user.create({
      data: {
        email: params.adminEmail,
        password: hashedPw,
        nickname: params.adminNickname,
        role: 'admin',
        status: 'active',
        emailVerified: new Date(),
      },
    })

    // 2. 핵심 설정
    await tx.setting.createMany({
      data: [
        { key: 'site_name', value: params.siteName },
        { key: 'site_description', value: params.siteDescription || '' },
        { key: 'site_locale', value: params.locale },
        { key: 'signup_enabled', value: 'true' },
      ],
    })

    // 3. Seed 데이터 삽입
    for (const b of seed.boards) {
      await tx.board.create({
        data: {
          slug: b.slug,
          name: b.name,
          description: b.description ?? null,
          category: b.category ?? null,
          isActive: b.isActive ?? true,
          useComment: b.useComment ?? true,
          useReaction: b.useReaction ?? true,
        },
      })
    }

    for (const m of seed.menus) {
      await tx.menu.create({
        data: {
          position: m.position,
          label: m.label,
          url: m.url,
          sortOrder: m.sortOrder,
        },
      })
    }

    for (const w of seed.widgets) {
      await tx.homeWidget.create({
        data: {
          widgetKey: w.widgetKey,
          zone: w.zone,
          title: w.title,
          colSpan: w.colSpan,
          rowSpan: w.rowSpan,
          sortOrder: w.sortOrder,
          isActive: true,
        },
      })
    }

    for (const c of seed.contents) {
      await tx.content.create({
        data: {
          slug: c.slug,
          title: c.title,
          content: c.content,
          isPublic: c.isPublic,
        },
      })
    }

    for (const p of seed.policies) {
      await tx.policy.create({
        data: {
          slug: p.slug,
          version: p.version,
          title: p.title,
          content: p.content,
          isActive: p.isActive,
        },
      })
    }

    // 4. 마지막에 완료 플래그 (중간 실패 시 재시도 가능)
    await tx.setting.create({ data: { key: 'site_initialized', value: 'true' } })
  })
}
