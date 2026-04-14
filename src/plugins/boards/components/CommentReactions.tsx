"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { SmilePlus } from "lucide-react"

// 리액션 타입 정의
const REACTIONS = [
  { type: 'like', emoji: '👍' },
  { type: 'haha', emoji: '😂' },
  { type: 'agree', emoji: '👌' },
  { type: 'thanks', emoji: '🙏' },
  { type: 'wow', emoji: '😮' },
] as const

interface CommentReactionsProps {
  slug: string
  postId: string
  commentId: string
  isLoggedIn: boolean
}

export function CommentReactions({ slug, postId, commentId, isLoggedIn }: CommentReactionsProps) {
  const t = useTranslations('boards')
  const [reactions, setReactions] = useState<Record<string, number>>({})
  const [userReactions, setUserReactions] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)

  // 리액션 조회
  const fetchReactions = useCallback(async () => {
    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}/comments/${commentId}/reaction`)
      const data = await response.json()
      if (data.success) {
        setReactions(data.reactions || {})
        setUserReactions(data.userReactions || [])
      }
    } catch (error) {
      console.error('댓글 리액션 조회 에러:', error)
    }
  }, [slug, postId, commentId])

  useEffect(() => {
    fetchReactions()
  }, [fetchReactions])

  // 리액션 토글
  const handleReaction = async (type: string) => {
    if (!isLoggedIn) {
      alert(t('errors.loginRequiredDot'))
      return
    }

    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}/comments/${commentId}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })

      const data = await response.json()

      if (response.ok) {
        setReactions(data.reactions || {})
        setUserReactions(data.userReactions || [])
      }
    } catch (error) {
      console.error('댓글 반응 에러:', error)
    }

    setIsOpen(false)
  }

  // 총 리액션 수
  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0)

  // 활성화된 리액션들 (수가 있는 것)
  const activeReactions = REACTIONS.filter(r => reactions[r.type] > 0)

  return (
    <div className="flex items-center gap-1 mt-2">
      {/* 기존 리액션 표시 */}
      {activeReactions.length > 0 && (
        <div className="flex items-center gap-1">
          {activeReactions.map(({ type, emoji }) => {
            const count = reactions[type] || 0
            const isActive = userReactions.includes(type)

            return (
              <button
                key={type}
                onClick={() => handleReaction(type)}
                className={cn(
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                <span>{emoji}</span>
                <span>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 리액션 추가 버튼 */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
              totalReactions === 0 && "ml-0"
            )}
          >
            <SmilePlus className="h-3.5 w-3.5" />
            {totalReactions === 0 && <span>{t('reactions.react')}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {REACTIONS.map(({ type, emoji }) => {
              const isActive = userReactions.includes(type)
              return (
                <button
                  key={type}
                  onClick={() => handleReaction(type)}
                  title={t(`reactions.${type}`)}
                  className={cn(
                    "p-2 rounded-lg text-xl hover:bg-muted transition-colors",
                    isActive && "bg-primary/20"
                  )}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
