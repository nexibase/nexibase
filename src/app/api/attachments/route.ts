import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import { existsSync, writeFileSync } from 'fs'
import path from 'path'
import { getAuthUser } from '@/lib/auth'
import sharp from 'sharp'

// Thumbnail settings
const THUMBNAIL_SIZE = 400 // 썸네일 최대 크기 (px)
const THUMBNAIL_QUALITY = 80 // 썸네일 품질 (1-100)

// Allowed file types and sizes
const ALLOWED_EXTENSIONS = [
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.csv',
  // Archives
  '.zip', '.rar', '.7z',
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  // Other
  '.hwp', '.hwpx'
]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

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
    const file = formData.get('file') as File | null
    const boardSlug = formData.get('boardSlug') as string | null

    if (!file) {
      return NextResponse.json(
        { error: '파일을 선택해주세요.' },
        { status: 400 }
      )
    }

    // Validate board slug (only letters, digits, and hyphens allowed)
    if (boardSlug && !/^[a-z0-9-]+$/.test(boardSlug)) {
      return NextResponse.json(
        { error: '잘못된 게시판 정보입니다.' },
        { status: 400 }
      )
    }

    // Validate file extension
    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `허용되지 않는 파일 형식입니다. (허용: ${ALLOWED_EXTENSIONS.join(', ')})` },
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

    // Build filename (timestamp + random)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const storedName = `${timestamp}-${random}${ext}`

    // Per-board year/month layout: /uploads/boards/{boardSlug}/{year}/{month}
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')

    // When boardSlug is present use the per-board folder, otherwise the default files folder
    const basePath = boardSlug ? `boards/${boardSlug}` : 'files'
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', basePath, String(year), month)
    const urlPath = `/uploads/${basePath}/${year}/${month}`

    // Create directory
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = path.join(uploadDir, storedName)
    writeFileSync(filePath, buffer)

    // Return URL
    const url = `${urlPath}/${storedName}`
    let thumbnailPath: string | null = null

    // Generate a thumbnail for images
    const isImage = file.type.startsWith('image/')
    if (isImage) {
      try {
        const thumbnailName = `${timestamp}-${random}_thumb.webp`
        const thumbnailFilePath = path.join(uploadDir, thumbnailName)

        await sharp(buffer)
          .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
            fit: 'cover',
            position: 'center'
          })
          .webp({ quality: THUMBNAIL_QUALITY })
          .toFile(thumbnailFilePath)

        thumbnailPath = `${urlPath}/${thumbnailName}`
        console.log(`thumbnail created: ${thumbnailName}`)
      } catch (thumbError) {
        console.error('thumbnail generation failed:', thumbError)
        // If thumbnail generation fails, the original is still uploaded
      }
    }

    console.log(`file upload: ${file.name} (${(file.size / 1024).toFixed(1)}KB) → ${storedName}`)

    return NextResponse.json({
      success: true,
      file: {
        filename: file.name,
        storedName,
        filePath: url,
        thumbnailPath,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream'
      }
    })

  } catch (error) {
    console.error('file upload error:', error)
    return NextResponse.json(
      { error: '파일 업로드에 실패했습니다.' },
      { status: 500 }
    )
  }
}
