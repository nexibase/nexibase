import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { getAuthUser } from '@/lib/auth'

// Path Traversal 방지: 안전한 경로 문자만 허용 (영숫자, 하이픈, 언더스코어)
const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9_-]+$/

// 허용 이미지 타입
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB (리사이징 전)
const MAX_WIDTH = 1200 // 최대 너비
const THUMB_WIDTH = 200 // 썸네일 너비
const QUALITY = 80 // 압축 품질
const THUMB_QUALITY = 70 // 썸네일 압축 품질

export async function POST(request: NextRequest) {
  try {
    // 로그인 확인
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    // 'file' 또는 'image' 필드명 지원
    const file = (formData.get('file') || formData.get('image')) as File | null
    // 폴더 지정 (reviews 등)
    const folder = formData.get('folder') as string | null
    // 상품 ID (reviews 폴더일 때 사용)
    const productId = formData.get('productId') as string | null

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

    // 파일명 생성 (타임스탬프 + 랜덤, webp로 변환)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const filename = `${timestamp}-${random}.webp`

    // Path Traversal 방지: productId 검증
    if (productId && !SAFE_PATH_SEGMENT.test(productId)) {
      return NextResponse.json(
        { error: '잘못된 상품 ID 형식입니다.' },
        { status: 400 }
      )
    }

    // Path Traversal 방지: folder 검증
    if (folder && !SAFE_PATH_SEGMENT.test(folder)) {
      return NextResponse.json(
        { error: '잘못된 폴더 이름입니다.' },
        { status: 400 }
      )
    }

    // 폴더 구조 결정
    let uploadDir: string
    let urlPath: string

    if (folder === 'reviews' && productId) {
      // 리뷰 이미지: /uploads/shop/reviews/{productId}/
      uploadDir = path.join(process.cwd(), 'public', 'uploads', 'shop', 'reviews', productId)
      urlPath = `/uploads/shop/reviews/${productId}`
    } else if (folder === 'reviews') {
      // 리뷰 이미지 (ID 없음): /uploads/shop/reviews/
      uploadDir = path.join(process.cwd(), 'public', 'uploads', 'shop', 'reviews')
      urlPath = '/uploads/shop/reviews'
    } else {
      // 기본: 년/월 폴더 구조
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      uploadDir = path.join(process.cwd(), 'public', 'uploads', String(year), month)
      urlPath = `/uploads/${year}/${month}`
    }

    // Path Traversal 이중 검증: 최종 경로가 uploads/ 내부인지 확인
    const allowedBase = path.resolve(process.cwd(), 'public', 'uploads')
    const resolvedDir = path.resolve(uploadDir)
    if (!resolvedDir.startsWith(allowedBase + path.sep) && resolvedDir !== allowedBase) {
      return NextResponse.json(
        { error: '잘못된 업로드 경로입니다.' },
        { status: 400 }
      )
    }

    // 디렉토리 생성
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 이미지 리사이징 및 WebP 변환
    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    // GIF는 애니메이션 유지를 위해 그대로 저장
    let outputBuffer: Buffer
    let thumbBuffer: Buffer
    let outputFilename = filename
    const thumbFilename = `${timestamp}-${random}-thumb.webp`

    if (file.type === 'image/gif') {
      // GIF는 리사이징만 (애니메이션 유지)
      outputBuffer = await sharp(inputBuffer, { animated: true })
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .gif()
        .toBuffer()
      outputFilename = `${timestamp}-${random}.gif`
      // GIF 썸네일은 첫 프레임만 추출해서 WebP로 변환
      thumbBuffer = await sharp(inputBuffer, { animated: false })
        .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: 'cover' })
        .webp({ quality: THUMB_QUALITY })
        .toBuffer()
    } else {
      // 나머지는 WebP로 변환 + 리사이징
      outputBuffer = await sharp(inputBuffer)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer()
      // 썸네일 생성 (정사각형, 중앙 크롭)
      thumbBuffer = await sharp(inputBuffer)
        .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: 'cover' })
        .webp({ quality: THUMB_QUALITY })
        .toBuffer()
    }

    // 원본 파일 저장
    const filePath = path.join(uploadDir, outputFilename)
    await sharp(outputBuffer).toFile(filePath)

    // 썸네일 파일 저장
    const thumbPath = path.join(uploadDir, thumbFilename)
    await sharp(thumbBuffer).toFile(thumbPath)

    // URL 반환
    const url = `${urlPath}/${outputFilename}`
    const thumbnailUrl = `${urlPath}/${thumbFilename}`

    // 원본 크기와 변환 후 크기 로깅
    console.log(`이미지 업로드: ${file.name} (${(file.size / 1024).toFixed(1)}KB) → ${outputFilename} (${(outputBuffer.length / 1024).toFixed(1)}KB), 썸네일: ${thumbFilename} (${(thumbBuffer.length / 1024).toFixed(1)}KB)`)

    return NextResponse.json({
      success: true,
      url,
      thumbnailUrl,
      originalSize: file.size,
      compressedSize: outputBuffer.length
    })

  } catch (error) {
    console.error('이미지 업로드 에러:', error)
    return NextResponse.json(
      { error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}
