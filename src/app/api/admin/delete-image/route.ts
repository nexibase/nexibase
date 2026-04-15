import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { unlink } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    // Admin check
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { imageUrl } = await request.json()

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: '이미지 URL이 필요합니다.' }, { status: 400 })
    }

    // Validate URL: must start with /uploads/
    if (!imageUrl.startsWith('/uploads/')) {
      return NextResponse.json({ error: '잘못된 이미지 경로입니다.' }, { status: 400 })
    }

    // Build the file path
    const filePath = path.join(process.cwd(), 'public', imageUrl)
    // Thumbnail path: xxx.webp -> xxx-thumb.webp
    const thumbPath = filePath.replace(/(\.(webp|gif))$/i, '-thumb.webp')

    // Delete the original image
    try {
      await unlink(filePath)
      console.log(`image deleted: ${imageUrl}`)
    } catch (err) {
      // Ignore when the file does not exist
      console.log(`image delete skipped (file missing): ${imageUrl}`)
    }

    // Delete the thumbnail image
    try {
      await unlink(thumbPath)
      console.log(`thumbnail deleted: ${thumbPath}`)
    } catch {
      // Ignore missing thumbnails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('failed to delete image:', error)
    return NextResponse.json({ error: '이미지 삭제에 실패했습니다.' }, { status: 500 })
  }
}
