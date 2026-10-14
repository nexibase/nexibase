import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isOfficialAdmin } from '@/lib/admin-identity'

export const dynamic = 'force-dynamic'

// Public identities only: never include email, password, notes or session data.
export async function GET() {
  const users = await prisma.user.findMany({
    where: { role: 'admin', status: 'active', deletedAt: null },
    select: { id: true, uuid: true, role: true, status: true, deletedAt: true },
  })
  return NextResponse.json({ admins: users.filter(isOfficialAdmin).map(({ id, uuid }) => ({ id, uuid })) }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
