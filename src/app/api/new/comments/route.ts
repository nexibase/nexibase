import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  url.pathname = '/api/comments/latest'
  return NextResponse.redirect(url, 308)
}
