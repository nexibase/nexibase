"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { User, FileText, MessageSquare, Calendar, Loader2 } from "lucide-react"
import Link from "next/link"

interface UserProfile {
  id: number
  uuid: string
  nickname: string
  image: string | null
  level: number
  createdAt: string
  postCount: number
  commentCount: number
}

export default function ProfilePage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    fetch(`/api/members/${uuid}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setProfile(data.user)
      })
      .finally(() => setLoading(false))
  }, [uuid])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">회원을 찾을 수 없습니다.</p>
        <Link href="/" className="text-primary hover:underline">홈으로</Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {profile.image && !imgError ? (
                <img src={profile.image} alt={profile.nickname} className="w-full h-full object-cover" onError={() => setImgError(true)} />
              ) : (
                <span className="text-3xl font-medium text-primary">{(profile.nickname || '?').charAt(0)}</span>
              )}
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold">{profile.nickname}</h1>
              <span className="text-sm text-muted-foreground">Lv.{profile.level}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{profile.postCount}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <FileText className="h-3.5 w-3.5" /> 게시글
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{profile.commentCount}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <MessageSquare className="h-3.5 w-3.5" /> 댓글
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(profile.createdAt)} 가입</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
