import { NextRequest, NextResponse } from 'next/server'
import { runInstall, InstallError, InstallParams } from '@/lib/install/runInstall'
import { localeRegistry } from '@/lib/install/_generated-registry'

interface ValidationResult {
  ok: boolean
  errors?: Record<string, string>
  params?: InstallParams
}

function validateBody(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: { _: 'Invalid request body' } }
  }
  const b = body as Record<string, unknown>
  const errors: Record<string, string> = {}

  const locale = typeof b.locale === 'string' ? b.locale : ''
  if (!locale || !(locale in localeRegistry)) {
    errors.locale = 'Unsupported locale'
  }

  const adminEmail = typeof b.adminEmail === 'string' ? b.adminEmail.trim() : ''
  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) || adminEmail.length > 255) {
    errors.adminEmail = 'Invalid email format'
  }

  const adminPassword = typeof b.adminPassword === 'string' ? b.adminPassword : ''
  if (!adminPassword || adminPassword.length < 8) {
    errors.adminPassword = 'Password must be at least 8 characters'
  } else if (!/[a-zA-Z]/.test(adminPassword) || !/[0-9]/.test(adminPassword)) {
    errors.adminPassword = 'Password must include both letters and numbers'
  }

  const adminPasswordConfirm = typeof b.adminPasswordConfirm === 'string' ? b.adminPasswordConfirm : ''
  if (adminPassword !== adminPasswordConfirm) {
    errors.adminPasswordConfirm = 'Passwords do not match'
  }

  const adminNickname = typeof b.adminNickname === 'string' ? b.adminNickname.trim() : ''
  if (!adminNickname || adminNickname.length < 2 || adminNickname.length > 50) {
    errors.adminNickname = 'Nickname must be 2-50 characters'
  }

  const siteName = typeof b.siteName === 'string' ? b.siteName.trim() : ''
  if (!siteName || siteName.length < 1 || siteName.length > 100) {
    errors.siteName = 'Site name must be 1-100 characters'
  }

  const siteDescription = typeof b.siteDescription === 'string' ? b.siteDescription.trim() : ''
  if (siteDescription.length > 500) {
    errors.siteDescription = 'Site description must be 500 characters or less'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    params: {
      locale,
      adminEmail,
      adminPassword,
      adminNickname,
      siteName,
      siteDescription,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = validateBody(body)
    if (!validation.ok) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 })
    }
    await runInstall(validation.params!)
    const { markInstalled } = await import('@/proxy')
    markInstalled()
    // TODO(Task 7): setCachedLocale(validation.params!.locale) after it exists in request.ts
    return NextResponse.json({ success: true, redirectTo: '/admin/login' })
  } catch (err) {
    if (err instanceof InstallError) {
      if (err.code === 'ALREADY_INSTALLED') {
        return NextResponse.json({ error: 'Site is already installed' }, { status: 409 })
      }
      if (err.code === 'UNKNOWN_LOCALE') {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
    }
    console.error('[install] failed:', err)
    return NextResponse.json({ error: 'Installation failed' }, { status: 500 })
  }
}
