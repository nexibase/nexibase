import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { getAuthUser } from '@/lib/auth'

// Path traversal guard: only allow safe path characters (alphanumerics, hyphens, underscores)
const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9_-]+$/

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB (리사이징 전)
const MAX_WIDTH = 1200 // 최대 너비
const THUMB_WIDTH = 200 // 썸네일 너비
const QUALITY = 80 // Archives 품질
const THUMB_QUALITY = 70 // 썸네일 압축 품질

export async function POST(request: NextRequest) {
  try {
    // Login check
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
    // Folder override (e.g. reviews)
    const folder = formData.get('folder') as string | null
    // Product ID (used when folder=reviews)
    const productId = formData.get('productId') as string | null

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

    // 파일명 생성 (타임스탬프 + 랜덤, webp로 변환)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const filename = `${timestamp}-${random}.webp`

    // Path traversal guard: validate productId
    if (productId && !SAFE_PATH_SEGMENT.test(productId)) {
      return NextResponse.json(
        { error: '잘못된 상품 ID 형식입니다.' },
        { status: 400 }
      )
    }

    // Path traversal guard: validate folder
    if (folder && !SAFE_PATH_SEGMENT.test(folder)) {
      return NextResponse.json(
        { error: '잘못된 폴더 이름입니다.' },
        { status: 400 }
      )
    }

    // Pick folder layout
    let uploadDir: string
    let urlPath: string

    if (folder === 'reviews' && productId) {
      // Review image: /uploads/shop/reviews/{productId}/
      uploadDir = path.join(process.cwd(), 'public', 'uploads', 'shop', 'reviews', productId)
      urlPath = `/uploads/shop/reviews/${productId}`
    } else if (folder === 'reviews') {
      // Review image (no ID): /uploads/shop/reviews/
      uploadDir = path.join(process.cwd(), 'public', 'uploads', 'shop', 'reviews')
      urlPath = '/uploads/shop/reviews'
    } else {
      // Default: year/month layout
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      uploadDir = path.join(process.cwd(), 'public', 'uploads', String(year), month)
      urlPath = `/uploads/${year}/${month}`
    }

    // Second path-traversal check: ensure the final path is inside uploads/
    const allowedBase = path.resolve(process.cwd(), 'public', 'uploads')
    const resolvedDir = path.resolve(uploadDir)
    if (!resolvedDir.startsWith(allowedBase + path.sep) && resolvedDir !== allowedBase) {
      return NextResponse.json(
        { error: '잘못된 업로드 경로입니다.' },
        { status: 400 }
      )
    }

    // Create directory
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Resize and convert to WebP
    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    // GIFs are stored as-is to preserve animation
    let outputBuffer: Buffer
    let thumbBuffer: Buffer
    let outputFilename = filename
    const thumbFilename = `${timestamp}-${random}-thumb.webp`

    if (file.type === 'image/gif') {
      // GIFs: resize only (keep animation)
      outputBuffer = await sharp(inputBuffer, { animated: true })
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .gif()
        .toBuffer()
      outputFilename = `${timestamp}-${random}.gif`
      // GIF thumbnail: extract the first frame and convert to WebP
      thumbBuffer = await sharp(inputBuffer, { animated: false })
        .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: 'cover' })
        .webp({ quality: THUMB_QUALITY })
        .toBuffer()
    } else {
      // Everything else: convert to WebP + resize
      outputBuffer = await sharp(inputBuffer)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer()
      // Generate thumbnail (square, center-cropped)
      thumbBuffer = await sharp(inputBuffer)
        .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: 'cover' })
        .webp({ quality: THUMB_QUALITY })
        .toBuffer()
    }

    // Save original file
    const filePath = path.join(uploadDir, outputFilename)
    await sharp(outputBuffer).toFile(filePath)

    // Save thumbnail file
    const thumbPath = path.join(uploadDir, thumbFilename)
    await sharp(thumbBuffer).toFile(thumbPath)

    // Return URL
    const url = `${urlPath}/${outputFilename}`
    const thumbnailUrl = `${urlPath}/${thumbFilename}`

    // Log the original and converted sizes
    console.log(`image upload: ${file.name} (${(file.size / 1024).toFixed(1)}KB) → ${outputFilename} (${(outputBuffer.length / 1024).toFixed(1)}KB), thumb: ${thumbFilename} (${(thumbBuffer.length / 1024).toFixed(1)}KB)`)

    return NextResponse.json({
      success: true,
      url,
      thumbnailUrl,
      originalSize: file.size,
      compressedSize: outputBuffer.length
    })

  } catch (error) {
    console.error('image upload error:', error)
    return NextResponse.json(
      { error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}
