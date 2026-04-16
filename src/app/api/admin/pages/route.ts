import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { isValidTemplate } from '@/lib/widgets/layout-templates'
import { pluginManifest } from '@/plugins/_generated'

const SYSTEM_SLUGS = ['admin', 'login', 'signup', 'mypage', 'api', 'install', 'setup-required', 'verify-email', 'profile', 'search', 'new']
const PLUGIN_SLUGS = Object.values(pluginManifest).map(p => p.slug)
const RESERVED_SLUGS = [...SYSTEM_SLUGS, ...PLUGIN_SLUGS]

function isSlugReserved(slug: string): boolean {
  const firstSegment = slug.split('/')[0]
  return RESERVED_SLUGS.includes(firstSegment)
}

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const pages = await prisma.widgetPage.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { widgets: true } } },
    })
    return NextResponse.json({ pages })
  } catch (err) {
    console.error('[pages] failed to list pages:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { title, slug, layoutTemplate } = body as { title?: string; slug?: string; layoutTemplate?: string }

    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const normalizedSlug = (slug ?? '').trim().replace(/^\/+|\/+$/g, '').toLowerCase()

    if (normalizedSlug && isSlugReserved(normalizedSlug)) {
      return NextResponse.json({ error: `Slug "${normalizedSlug}" is reserved` }, { status: 400 })
    }

    const existing = await prisma.widgetPage.findUnique({ where: { slug: normalizedSlug } })
    if (existing) {
      return NextResponse.json({ error: `Slug "${normalizedSlug}" is already in use` }, { status: 400 })
    }

    const template = layoutTemplate && isValidTemplate(layoutTemplate) ? layoutTemplate : 'full-width'

    const page = await prisma.widgetPage.create({
      data: { title: title.trim(), slug: normalizedSlug, layoutTemplate: template },
    })

    return NextResponse.json({ page }, { status: 201 })
  } catch (err) {
    console.error('[pages] failed to create page:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
