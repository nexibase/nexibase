"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { User, FileText, MessageSquare, Send } from "lucide-react"
import Link from "next/link"

interface UserNicknameProps {
  userId: number | string
  uuid?: string | null
  nickname: string | null
  image?: string | null
  showAvatar?: boolean
  avatarSize?: 'sm' | 'md'
  className?: string
}

// Module-level cache so /api/me is fetched at most once per page load,
// regardless of how many UserNickname components mount.
let mePromise: Promise<{ id: number } | null> | null = null
function loadMe(): Promise<{ id: number } | null> {
  if (!mePromise) {
    mePromise = fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.user ? { id: d.user.id } : null)
      .catch(() => null)
  }
  return mePromise
}

export function UserNickname({
  userId,
  uuid,
  nickname,
  image,
  showAvatar = false,
  avatarSize = 'sm',
  className = '',
}: UserNicknameProps) {
  const t = useTranslations('profile')
  const tc = useTranslations('common')
  const tMsg = useTranslations('mypage.messages')
  const router = useRouter()
  const [imgError, setImgError] = useState(false)
  const [me, setMe] = useState<{ id: number } | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    loadMe().then(setMe)
  }, [])

  const sizeClass = avatarSize === 'md' ? 'w-8 h-8' : 'w-5 h-5'
  const textClass = avatarSize === 'md' ? 'text-sm' : 'text-xs sm:text-sm'
  const initial = (nickname || '?').charAt(0)

  const targetIdNum = typeof userId === 'number' ? userId : parseInt(String(userId))
  const canDm = me != null && Number.isFinite(targetIdNum) && me.id !== targetIdNum

  async function openDm() {
    if (!canDm || starting) return
    setStarting(true)
    try {
      const res = await fetch('/api/messages/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: targetIdNum }),
      })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) return
      const data = await res.json()
      router.push(`/mypage/messages/${data.conversationUuid}`)
    } finally {
      setStarting(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-user-nickname
          onClick={(e) => { e.stopPropagation() }}
          className={`inline-flex items-center gap-1.5 hover:text-primary transition-colors ${className}`}
        >
          {showAvatar && (
            <span className={`${sizeClass} rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0`}>
              {image && !imgError ? (
                <img src={image} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
              ) : (
                <span className={`${avatarSize === 'md' ? 'text-xs' : 'text-[10px]'} font-medium text-primary`}>
                  {initial}
                </span>
              )}
            </span>
          )}
          <span className={`${textClass} truncate`}>{nickname || tc('anonymous')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start" onClick={(e) => e.stopPropagation()}>
        {uuid && (
          <Link
            href={`/profile/${uuid}`}
            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2"
          >
            <User className="h-4 w-4" /> {t('viewProfile')}
          </Link>
        )}
        <Link
          href={uuid ? `/posts/latest?uuid=${uuid}` : '#'}
          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2"
        >
          <FileText className="h-4 w-4" /> {t('viewPosts')}
        </Link>
        <Link
          href={uuid ? `/comments/latest?uuid=${uuid}` : '#'}
          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2"
        >
          <MessageSquare className="h-4 w-4" /> {t('viewComments')}
        </Link>
        {canDm && (
          <button
            type="button"
            onClick={openDm}
            disabled={starting}
            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {tMsg('sendAction')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
