import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { mkdir } from 'fs/promises'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'
import sharp from 'sharp'

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const AVATAR_SIZE = 200 // 프로필 이미지 크기 (정사각형)
const QUALITY = 85 // Archives 품질

// Fetch user from the NextAuth session
async function getUserFromSession() {
  const nextAuthSession = await getServerSession(authOptions)
  if (nextAuthSession?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: nextAuthSession.user.email }
    })
    if (user) return user
  }
  return null
}

// Upload profile image
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json(
        { error: '이미지 파일을 선택해주세요.' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'JPG, PNG, GIF, WebP 파일만 업로드 가능합니다.' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: '파일 크기는 2MB 이하여야 합니다.' },
        { status: 400 }
      )
    }

    // Profile image storage directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles')

    // Create directory
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Delete the existing profile image (only when it is a local file)
    if (user.image && user.image.startsWith('/uploads/profiles/')) {
      const oldPath = path.join(process.cwd(), 'public', user.image)
      try {
        if (existsSync(oldPath)) {
          unlinkSync(oldPath)
        }
      } catch (e) {
        console.error('failed to delete existing profile image:', e)
      }
    }

    // Build filename (user ID + timestamp)
    const timestamp = Date.now()
    const filename = `${user.id}-${timestamp}.webp`

    // Resize and convert to WebP
    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    // Crop to a square and convert to WebP
    const outputBuffer = await sharp(inputBuffer)
      .resize({
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        fit: 'cover',
        position: 'centre'
      })
      .webp({ quality: QUALITY })
      .toBuffer()

    // Save file
    const filePath = path.join(uploadDir, filename)
    await sharp(outputBuffer).toFile(filePath)

    // Build URL
    const imageUrl = `/uploads/profiles/${filename}`

    // Update DB
    await prisma.user.update({
      where: { id: user.id },
      data: { image: imageUrl }
    })

    console.log(`profile image upload: user=${user.id}, file=${filename} (${(outputBuffer.length / 1024).toFixed(1)}KB)`)

    return NextResponse.json({
      success: true,
      imageUrl
    })

  } catch (error) {
    console.error('profile image upload error:', error)
    return NextResponse.json(
      { error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// Delete profile image
export async function DELETE() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // Delete the existing profile image (only when it is a local file)
    if (user.image && user.image.startsWith('/uploads/profiles/')) {
      const oldPath = path.join(process.cwd(), 'public', user.image)
      try {
        if (existsSync(oldPath)) {
          unlinkSync(oldPath)
        }
      } catch (e) {
        console.error('failed to delete profile image:', e)
      }
    }

    // Update DB (set image to null)
    await prisma.user.update({
      where: { id: user.id },
      data: { image: null }
    })

    return NextResponse.json({
      success: true,
      message: '프로필 이미지가 삭제되었습니다.'
    })

  } catch (error) {
    console.error('failed to delete profile image:', error)
    return NextResponse.json(
      { error: '이미지 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
