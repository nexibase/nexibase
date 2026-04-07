"use client"

import { User } from "lucide-react"

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
  const sizeClass = avatarSize === 'md' ? 'w-8 h-8' : 'w-5 h-5'
  const iconSize = avatarSize === 'md' ? 'h-4 w-4' : 'h-3 w-3'
  const textClass = avatarSize === 'md' ? 'text-sm' : 'text-xs sm:text-sm'

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
        <span className={`${sizeClass} rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0`}>
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className={iconSize + ' text-muted-foreground'} />
          )}
        </span>
      )}
      <span className={`${textClass} truncate`}>{nickname || '익명'}</span>
    </button>
  )
}
