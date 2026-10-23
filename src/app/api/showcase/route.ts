import { NextResponse } from 'next/server'
import { getPublicShowcase } from '@/lib/showcase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getPublicShowcase())
  } catch (error) {
    console.error('Failed to load showcase:', error)
    return NextResponse.json({ error: 'Showcase unavailable' }, { status: 503 })
  }
}
