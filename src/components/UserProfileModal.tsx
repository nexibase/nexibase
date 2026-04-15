"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { User, FileText, MessageSquare, Calendar } from "lucide-react"

interface UserProfile {
  id: number
  nickname: string
  image: string | null
  level: number
  createdAt: string
  postCount: number
  commentCount: number
}

interface UserProfileModalProps {
  userId: number | null
  onClose: () => void
}

export function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const t = useTranslations('profile')
  const tc = useTranslations('common')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchProfile = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/members/${id}`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data.user)
      }
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userId) {
      fetchProfile(userId)
    } else {
      setProfile(null)
    }
  }, [userId, fetchProfile])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <Dialog open={!!userId} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-xs p-0 gap-0">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">{tc('loading')}</div>
        ) : profile ? (
          <div className="p-6">
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {profile.image ? (
                  <img src={profile.image} alt={profile.nickname} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-medium text-primary">{(profile.nickname || '?').charAt(0)}</span>
                )}
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{profile.nickname}</div>
                <div className="text-xs text-muted-foreground">Lv.{profile.level}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{t('posts')} <strong className="text-foreground">{profile.postCount}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>{t('comments')} <strong className="text-foreground">{profile.commentCount}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <Calendar className="h-4 w-4" />
                <span>{t('joinedAt')} {formatDate(profile.createdAt)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground text-sm">{t('notFound')}</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
