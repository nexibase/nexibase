"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
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
  const t = useTranslations('mypage')
  const tc = useTranslations('common')
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
        setMessage(t('saved'))
        const data = await res.json()
        if (data.user) setUser(data.user)
      } else {
        const data = await res.json()
        setMessage(data.error || t('saveFailed'))
      }
    } catch {
      setMessage(t('serverError'))
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
        setMessage(t('profileImageChanged'))
      } else {
        setMessage(data.error || t('imageUploadFailed'))
      }
    } catch {
      setMessage(t('imageUploadFailed'))
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
        setMessage(t('profileImageDeleted'))
      }
    } catch {
      setMessage(t('imageDeleteFailed'))
    } finally {
      setUploadingImage(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  if (loading) {
    return (
      <MyPageLayout>
        <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
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
          <h1 className="text-xl font-bold">{t('editProfile')}</h1>
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
              <Camera className="h-3.5 w-3.5 mr-1" /> {t('changeImage')}
            </Button>
            {user.image && (
              <Button variant="outline" size="sm" onClick={handleImageDelete} disabled={uploadingImage} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> {t('deleteImage')}
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('nickname')}</Label>
              <Input value={nickname} onChange={e => setNickname(e.target.value)} />
            </div>
            <div>
              <Label>{t('name')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('realNamePlaceholder')} />
            </div>
            <div>
              <Label>{t('phone')}</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('phonePlaceholder')} />
            </div>
            <div>
              <Label>{t('email')}</Label>
              <Input value={user.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">{t('emailReadonly')}</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('saving') : t('save')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MyPageLayout>
  )
}
