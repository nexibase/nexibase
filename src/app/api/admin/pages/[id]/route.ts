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

function parseId(raw: string) {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: raw } = await params
  const id = parseId(raw)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const page = await prisma.widgetPage.findUnique({
      where: { id },
      include: { widgets: { orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }] } },
    })
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ page })
  } catch (err) {
    console.error('[pages] failed to get page:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: raw } = await params
  const id = parseId(raw)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const body = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}

    if (body.title !== undefined) data.title = body.title.trim()
    if (body.slug !== undefined) {
      const normalizedSlug = body.slug.trim().replace(/^\/+|\/+$/g, '').toLowerCase()
      if (normalizedSlug && isSlugReserved(normalizedSlug)) {
        return NextResponse.json({ error: `Slug "${normalizedSlug}" is reserved` }, { status: 400 })
      }
      const existing = await prisma.widgetPage.findUnique({ where: { slug: normalizedSlug } })
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: `Slug "${normalizedSlug}" is already in use` }, { status: 400 })
      }
      data.slug = normalizedSlug
    }
    if (body.layoutTemplate !== undefined && isValidTemplate(body.layoutTemplate)) {
      data.layoutTemplate = body.layoutTemplate
    }
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder

    const seoFields = ['seoTitle', 'seoDescription', 'seoOgImage', 'seoOgTitle', 'seoOgDescription', 'seoCanonical']
    for (const field of seoFields) {
      if (body[field] !== undefined) data[field] = body[field] || null
    }
    if (body.seoNoIndex !== undefined) data.seoNoIndex = body.seoNoIndex
    if (body.seoNoFollow !== undefined) data.seoNoFollow = body.seoNoFollow

    const page = await prisma.widgetPage.update({ where: { id }, data })
    return NextResponse.json({ page })
  } catch (err) {
    console.error('[pages] failed to update page:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: raw } = await params
  const id = parseId(raw)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const page = await prisma.widgetPage.findUnique({ where: { id } })
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (page.slug === '') {
      return NextResponse.json({ error: 'Cannot delete the Home page' }, { status: 400 })
    }
    await prisma.widgetPage.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[pages] failed to delete page:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
