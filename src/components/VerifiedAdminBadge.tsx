"use client"

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

type Identity = { id: number; uuid: string }
let pending: Promise<Identity[]> | null = null

// Coalesce simultaneous badges into one request, without persisting role claims.
function loadAdminIdentities(): Promise<Identity[]> {
  if (!pending) {
    pending = fetch('/api/members/admin-identities', { cache: 'no-store' })
      .then(async response => response.ok ? (await response.json()).admins as Identity[] : [])
      .catch(() => [])
      .finally(() => { pending = null })
  }
  return pending
}

export function VerifiedAdminBadge({ userId }: { userId: number | string }) {
  const [verified, setVerified] = useState(false)
  useEffect(() => {
    let alive = true
    setVerified(false)
    const refresh = () => {
      loadAdminIdentities().then(admins => {
        if (alive) setVerified(admins.some(admin => String(admin.id) === String(userId) || admin.uuid === String(userId)))
      })
    }
    refresh()
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => { alive = false; window.removeEventListener('focus', refresh); window.clearInterval(timer) }
  }, [userId])
  if (!verified) return null
  return (
    <span data-verified-admin title="사이트에서 확인한 관리자 계정입니다." aria-label="사이트에서 확인한 관리자 계정입니다."
      className="inline-flex shrink-0 items-center gap-0.5 rounded border border-blue-500/30 bg-blue-500/10 px-1 py-0.5 text-[10px] font-semibold leading-none text-blue-700 dark:text-blue-300">
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />관리자
    </span>
  )
}
