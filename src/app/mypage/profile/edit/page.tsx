"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save, User, Camera, Trash2, Loader2 } from "lucide-react"

interface UserInfo {
  id: number
  email: string
  nickname: string
  name: string | null
  phone: string | null
  image: string | null
}

export default function EditProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [nickname, setNickname] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(data.user)
          setNickname(data.user.nickname || '')
          setName(data.user.name || '')
          setPhone(data.user.phone || '')
        } else {
          router.push('/login')
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, name, phone }),
      })
      if (res.ok) {
        setMessage('저장되었습니다.')
        const data = await res.json()
        if (data.user) setUser(data.user)
      } else {
        const data = await res.json()
        setMessage(data.error || '저장 실패')
      }
    } catch {
      setMessage('서버 오류')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/me/profile-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data.imageUrl) {
        setUser(prev => prev ? { ...prev, image: data.imageUrl } : prev)
        setMessage('프로필 이미지가 변경되었습니다.')
      } else {
        setMessage(data.error || '이미지 업로드 실패')
      }
    } catch {
      setMessage('이미지 업로드 실패')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleImageDelete = async () => {
    if (!user?.image) return
    setUploadingImage(true)
    try {
      const res = await fetch('/api/me/profile-image', { method: 'DELETE' })
      if (res.ok) {
        setUser(prev => prev ? { ...prev, image: null } : prev)
        setMessage('프로필 이미지가 삭제되었습니다.')
      }
    } catch {
      setMessage('이미지 삭제 실패')
    } finally {
      setUploadingImage(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  if (loading) {
    return (
      <MyPageLayout>
        <div className="py-12 text-center text-muted-foreground">로딩 중...</div>
      </MyPageLayout>
    )
  }

  if (!user) return null

  return (
    <MyPageLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/mypage">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">프로필 수정</h1>
        </div>

        {message && (
          <div className="px-4 py-2 bg-primary/10 text-primary rounded-md text-sm">{message}</div>
        )}

        {/* 프로필 이미지 */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden cursor-pointer group"
            onClick={() => !uploadingImage && fileInputRef.current?.click()}
          >
            {uploadingImage ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : user.image ? (
              <img src={user.image} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              <User className="h-12 w-12 text-primary" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
              <Camera className="h-3.5 w-3.5 mr-1" /> 변경
            </Button>
            {user.image && (
              <Button variant="outline" size="sm" onClick={handleImageDelete} disabled={uploadingImage} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> 삭제
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>닉네임</Label>
              <Input value={nickname} onChange={e => setNickname(e.target.value)} />
            </div>
            <div>
              <Label>이름</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="실명" />
            </div>
            <div>
              <Label>연락처</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" />
            </div>
            <div>
              <Label>이메일</Label>
              <Input value={user.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">이메일은 변경할 수 없습니다</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? '저장 중...' : '저장'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MyPageLayout>
  )
}
