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

// Reaction type definitions
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

  // Fetch reactions
  const fetchReactions = useCallback(async () => {
    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}/comments/${commentId}/reaction`)
      const data = await response.json()
      if (data.success) {
        setReactions(data.reactions || {})
        setUserReactions(data.userReactions || [])
      }
    } catch (error) {
      console.error('failed to fetch comment reactions:', error)
    }
  }, [slug, postId, commentId])

  useEffect(() => {
    fetchReactions()
  }, [fetchReactions])

  // Toggle reaction
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
      console.error('comment reaction error:', error)
    }

    setIsOpen(false)
  }

  // Total reaction count
  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0)

  // Active reactions (those with a non-zero count)
  const activeReactions = REACTIONS.filter(r => reactions[r.type] > 0)

  return (
    <div className="flex items-center gap-1 mt-2">
      {/* Existing reactions */}
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

      {/* Add reaction button */}
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
