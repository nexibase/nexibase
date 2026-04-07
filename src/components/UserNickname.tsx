"use client"

import { useState } from "react"

interface UserNicknameProps {
  userId: number | string
  nickname: string | null
  image?: string | null
  showAvatar?: boolean
  avatarSize?: 'sm' | 'md'
  onClick?: (userId: number) => void
  className?: string
}

export function UserNickname({
  userId,
  nickname,
  image,
  showAvatar = false,
  avatarSize = 'sm',
  onClick,
  className = '',
}: UserNicknameProps) {
  const [imgError, setImgError] = useState(false)
  const sizeClass = avatarSize === 'md' ? 'w-8 h-8' : 'w-5 h-5'
  const textClass = avatarSize === 'md' ? 'text-sm' : 'text-xs sm:text-sm'
  const initial = (nickname || '?').charAt(0)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (onClick) onClick(Number(userId))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
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
  )
}
