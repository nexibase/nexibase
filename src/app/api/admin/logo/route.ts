import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { mkdir } from 'fs/promises'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'
import sharp from 'sharp'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

// Upload logo
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: '로고 파일을 선택해주세요.' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'JPG, PNG, GIF, WebP, SVG 파일만 업로드 가능합니다.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '파일 크기는 2MB 이하여야 합니다.' }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logo')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Delete the existing logo
    const existing = await prisma.setting.findUnique({ where: { key: 'site_logo' } })
    if (existing?.value && existing.value.startsWith('/uploads/logo/')) {
      const oldPath = path.join(process.cwd(), 'public', existing.value)
      try { if (existsSync(oldPath)) unlinkSync(oldPath) } catch { /* ignore */ }
    }

    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)
    const timestamp = Date.now()

    let filename: string
    let imageUrl: string

    if (file.type === 'image/svg+xml') {
      // Store SVGs verbatim
      filename = `logo-${timestamp}.svg`
      const filePath = path.join(uploadDir, filename)
      const { writeFile } = await import('fs/promises')
      await writeFile(filePath, inputBuffer)
      imageUrl = `/uploads/logo/${filename}`
    } else {
      // Raster images get converted to WebP (80px tall)
      filename = `logo-${timestamp}.webp`
      const outputBuffer = await sharp(inputBuffer)
        .resize({ height: 80, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer()
      const filePath = path.join(uploadDir, filename)
      await sharp(outputBuffer).toFile(filePath)
      imageUrl = `/uploads/logo/${filename}`
    }

    // Save DB setting
    await prisma.setting.upsert({
      where: { key: 'site_logo' },
      update: { value: imageUrl },
      create: { key: 'site_logo', value: imageUrl }
    })

    return NextResponse.json({ success: true, imageUrl })
  } catch (error) {
    console.error('logo upload error:', error)
    return NextResponse.json({ error: '로고 업로드에 실패했습니다.' }, { status: 500 })
  }
}

// Delete logo
export async function DELETE() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const existing = await prisma.setting.findUnique({ where: { key: 'site_logo' } })
    if (existing?.value && existing.value.startsWith('/uploads/logo/')) {
      const oldPath = path.join(process.cwd(), 'public', existing.value)
      try { if (existsSync(oldPath)) unlinkSync(oldPath) } catch { /* ignore */ }
    }

    await prisma.setting.upsert({
      where: { key: 'site_logo' },
      update: { value: '' },
      create: { key: 'site_logo', value: '' }
    })

    return NextResponse.json({ success: true, message: '로고가 삭제되었습니다.' })
  } catch (error) {
    console.error('failed to delete logo:', error)
    return NextResponse.json({ error: '로고 삭제에 실패했습니다.' }, { status: 500 })
  }
}
