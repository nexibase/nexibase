"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { UserProfileModal } from "@/components/UserProfileModal"
import { User, FileText, MessageSquare } from "lucide-react"
import Link from "next/link"

interface UserNicknameProps {
  userId: number | string
  nickname: string | null
  image?: string | null
  showAvatar?: boolean
  avatarSize?: 'sm' | 'md'
  className?: string
}

export function UserNickname({
  userId,
  nickname,
  image,
  showAvatar = false,
  avatarSize = 'sm',
  className = '',
}: UserNicknameProps) {
  const [imgError, setImgError] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const sizeClass = avatarSize === 'md' ? 'w-8 h-8' : 'w-5 h-5'
  const textClass = avatarSize === 'md' ? 'text-sm' : 'text-xs sm:text-sm'
  const initial = (nickname || '?').charAt(0)

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
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
            <span className={`${textClass} truncate`}>{nickname || '익명'}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1" align="start" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setPopoverOpen(false); setShowProfile(true) }}
            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2"
          >
            <User className="h-4 w-4" /> 프로필 보기
          </button>
          <Link
            href={`/search?author=${nickname}`}
            onClick={() => setPopoverOpen(false)}
            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2"
          >
            <FileText className="h-4 w-4" /> 작성글 보기
          </Link>
          <Link
            href={`/search?author=${nickname}&type=comments`}
            onClick={() => setPopoverOpen(false)}
            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" /> 작성댓글 보기
          </Link>
        </PopoverContent>
      </Popover>
      <UserProfileModal userId={showProfile ? Number(userId) : null} onClose={() => setShowProfile(false)} />
    </>
  )
}
