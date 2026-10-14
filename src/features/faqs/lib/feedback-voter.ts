import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createVisitor, readVisitor, FAQ_VOTER_COOKIE, FAQ_VOTER_MAX_AGE } from './feedback-identity'

export interface FeedbackVoter { voterKey: string; userId?: number; cookie?: string }

export async function getFeedbackVoter(request: NextRequest): Promise<FeedbackVoter> {
  const user = await getSession()
  if (user) return { voterKey: `user:${user.id}`, userId: user.id }
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('FAQ voter signing secret is unavailable')
  const id = readVisitor(request.cookies.get(FAQ_VOTER_COOKIE)?.value, secret)
  return id ? { voterKey: `guest:${id}` } : createVisitor(secret)
}

export function withVoterCookie(response: NextResponse, voter: FeedbackVoter, request: NextRequest) {
  if (voter.cookie) response.cookies.set(FAQ_VOTER_COOKIE, voter.cookie, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: FAQ_VOTER_MAX_AGE,
    secure: request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https',
  })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
