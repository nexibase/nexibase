import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { mkdir } from 'fs/promises'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'
import sharp from 'sharp'

// 허용 이미지 타입
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const AVATAR_SIZE = 200 // 프로필 이미지 크기 (정사각형)
const QUALITY = 85 // 압축 품질

// NextAuth 세션에서 사용자 조회
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

// 프로필 이미지 업로드
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

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'JPG, PNG, GIF, WebP 파일만 업로드 가능합니다.' },
        { status: 400 }
      )
    }

    // 파일 크기 검증
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: '파일 크기는 2MB 이하여야 합니다.' },
        { status: 400 }
      )
    }

    // 프로필 이미지 저장 디렉토리
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles')

    // 디렉토리 생성
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 기존 프로필 이미지 삭제 (로컬 파일인 경우)
    if (user.image && user.image.startsWith('/uploads/profiles/')) {
      const oldPath = path.join(process.cwd(), 'public', user.image)
      try {
        if (existsSync(oldPath)) {
          unlinkSync(oldPath)
        }
      } catch (e) {
        console.error('기존 프로필 이미지 삭제 에러:', e)
      }
    }

    // 파일명 생성 (사용자 ID + 타임스탬프)
    const timestamp = Date.now()
    const filename = `${user.id}-${timestamp}.webp`

    // 이미지 리사이징 및 WebP 변환
    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    // 정사각형으로 크롭하고 WebP로 변환
    const outputBuffer = await sharp(inputBuffer)
      .resize({
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        fit: 'cover',
        position: 'centre'
      })
      .webp({ quality: QUALITY })
      .toBuffer()

    // 파일 저장
    const filePath = path.join(uploadDir, filename)
    await sharp(outputBuffer).toFile(filePath)

    // URL 생성
    const imageUrl = `/uploads/profiles/${filename}`

    // DB 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: { image: imageUrl }
    })

    console.log(`프로필 이미지 업로드: user=${user.id}, file=${filename} (${(outputBuffer.length / 1024).toFixed(1)}KB)`)

    return NextResponse.json({
      success: true,
      imageUrl
    })

  } catch (error) {
    console.error('프로필 이미지 업로드 에러:', error)
    return NextResponse.json(
      { error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 프로필 이미지 삭제
export async function DELETE() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 기존 프로필 이미지 삭제 (로컬 파일인 경우)
    if (user.image && user.image.startsWith('/uploads/profiles/')) {
      const oldPath = path.join(process.cwd(), 'public', user.image)
      try {
        if (existsSync(oldPath)) {
          unlinkSync(oldPath)
        }
      } catch (e) {
        console.error('프로필 이미지 삭제 에러:', e)
      }
    }

    // DB 업데이트 (이미지 null로)
    await prisma.user.update({
      where: { id: user.id },
      data: { image: null }
    })

    return NextResponse.json({
      success: true,
      message: '프로필 이미지가 삭제되었습니다.'
    })

  } catch (error) {
    console.error('프로필 이미지 삭제 에러:', error)
    return NextResponse.json(
      { error: '이미지 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
