import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { getAuthUser } from '@/lib/auth'

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB (before resizing)
const MAX_WIDTH = 1200 // max width
const THUMB_WIDTH = 200 // thumbnail width
const QUALITY = 80 // compression quality
const THUMB_QUALITY = 70 // thumbnail compression quality

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
    // Accept both 'file' and 'image' field names
    const file = (formData.get('file') || formData.get('image')) as File | null
    // Optional folder override (default: year/month)
    const folder = formData.get('folder') as string | null
    // Product ID (used when folder is 'products')
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
        { error: '파일 크기는 10MB 이하여야 합니다.' },
        { status: 400 }
      )
    }

    // Build filename (timestamp + random, converted to webp)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const filename = `${timestamp}-${random}.webp`

    // Pick folder layout
    let uploadDir: string
    let urlPath: string

    if (folder === 'products' && productId) {
      // Product image: /uploads/shop/products/{productId}/
      uploadDir = path.join(process.cwd(), 'public', 'uploads', 'shop', 'products', productId)
      urlPath = `/uploads/shop/products/${productId}`
    } else if (folder === 'products') {
      // Product image (no ID): /uploads/shop/products/
      uploadDir = path.join(process.cwd(), 'public', 'uploads', 'shop', 'products')
      urlPath = '/uploads/shop/products'
    } else {
      // Default: year/month layout
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      uploadDir = path.join(process.cwd(), 'public', 'uploads', String(year), month)
      urlPath = `/uploads/${year}/${month}`
    }

    // Ensure the directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Resize and convert to WebP
    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    // GIFs are kept as GIF to preserve animation
    let outputBuffer: Buffer
    let thumbBuffer: Buffer
    let outputFilename = filename
    const thumbFilename = `${timestamp}-${random}-thumb.webp`
    const isProductImage = folder === 'products'

    if (file.type === 'image/gif') {
      // GIFs: resize only, keep animation
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
      // Thumbnail (square, center-cropped)
      thumbBuffer = await sharp(inputBuffer)
        .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: 'cover' })
        .webp({ quality: THUMB_QUALITY })
        .toBuffer()
    }

    // Write the main file
    const filePath = path.join(uploadDir, outputFilename)
    await sharp(outputBuffer).toFile(filePath)

    // Write the thumbnail (only for product images)
    let thumbnailUrl: string | undefined
    if (isProductImage) {
      const thumbPath = path.join(uploadDir, thumbFilename)
      await sharp(thumbBuffer).toFile(thumbPath)
      thumbnailUrl = `${urlPath}/${thumbFilename}`
    }

    // Return the URL
    const url = `${urlPath}/${outputFilename}`

    // Log original and compressed sizes
    console.log(`image upload: ${file.name} (${(file.size / 1024).toFixed(1)}KB) → ${outputFilename} (${(outputBuffer.length / 1024).toFixed(1)}KB)${isProductImage ? `, thumb: ${thumbFilename}` : ''}`)

    return NextResponse.json({
      success: true,
      url,
      thumbnailUrl,
      originalSize: file.size,
      compressedSize: outputBuffer.length
    })

  } catch (error) {
    console.error('image upload failed:', error)
    return NextResponse.json(
      { error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}
