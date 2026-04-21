"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { useTranslations } from 'next-intl'
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Loader2, Save, Trash2, ExternalLink } from "lucide-react"
import Link from "next/link"

interface Board {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
  listMemberOnly: boolean
  readMemberOnly: boolean
  writeMemberOnly: boolean
  commentMemberOnly: boolean
  useComment: boolean
  useReaction: boolean
  useFile: boolean
  useSecret: boolean
  postsPerPage: number
  sortOrder: string
  displayType: string
  showPostNumber: boolean
  isActive: boolean
  postCount: number
}

export default function BoardEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const t = useTranslations('boards')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [board, setBoard] = useState<Board | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    listMemberOnly: false,
    readMemberOnly: false,
    writeMemberOnly: true,
    commentMemberOnly: true,
    useComment: true,
    useReaction: true,
    useFile: true,
    useSecret: false,
    postsPerPage: 20,
    sortOrder: 'latest',
    displayType: 'list',
    showPostNumber: false,
    isActive: true,
  })

  useEffect(() => {
    fetch(`/api/admin/boards/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.board) {
          const b = data.board
          setBoard(b)
          setFormData({
            name: b.name || '',
            description: b.description || '',
            category: b.category || '',
            listMemberOnly: b.listMemberOnly ?? false,
            readMemberOnly: b.readMemberOnly ?? false,
            writeMemberOnly: b.writeMemberOnly ?? true,
            commentMemberOnly: b.commentMemberOnly ?? true,
            useComment: b.useComment ?? true,
            useReaction: b.useReaction ?? true,
            useFile: b.useFile ?? true,
            useSecret: b.useSecret ?? false,
            postsPerPage: b.postsPerPage ?? 20,
            sortOrder: b.sortOrder || 'latest',
            displayType: b.displayType || 'list',
            showPostNumber: b.showPostNumber ?? false,
            isActive: b.isActive ?? true,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/boards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (res.ok) {
        alert(t('admin.savedDot'))
        router.push('/admin/boards')
      } else {
        alert(data.error || t('admin.saveFail'))
      }
    } catch {
      alert(t('admin.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!board) return
    const input = window.prompt(
      t('admin.deleteBoardConfirmWithSlug', { name: board.name, slug: board.slug })
    )
    if (input !== board.slug) {
      if (input !== null) alert(t('admin.slugMismatch'))
      return
    }
    try {
      const res = await fetch(`/api/admin/boards/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/boards')
      } else {
        alert(t('admin.deleteFail'))
      }
    } catch {
      alert(t('admin.deleteError'))
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-6 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-6">
          <p className="text-muted-foreground">{t('admin.boardNotFound')}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href="/admin/boards">
                <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">{t('admin.edit')}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>/{board.slug}</span>
                  <span>·</span>
                  <span>{t('admin.postsCount', { count: board.postCount })}</span>
                  <Link href={`/boards/${board.slug}`} target="_blank" className="hover:text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> {t('delete')}
            </Button>
          </div>

          {/* Basic info */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">{t('admin.basicInfo')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('admin.slug')}</Label>
                  <Input value={board.slug} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">{t('admin.slugCannotChange')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.boardName')} <span className="text-red-500">*</span></Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('admin.description')}</Label>
                  <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder={t('admin.descPlaceholderShort')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.category')}</Label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="">{t('admin.categoryNone')}</option>
                    <option value="community">{t('admin.categoryCommunity')}</option>
                    <option value="support">{t('admin.categorySupport')}</option>
                    <option value="notice">{t('admin.categoryNotice')}</option>
                    <option value="gallery">{t('admin.categoryGallery')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.postsPerPage')}</Label>
                  <Input type="number" min={5} max={100} value={formData.postsPerPage} onChange={e => setFormData({ ...formData, postsPerPage: parseInt(e.target.value) || 20 })} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permission settings */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">{t('admin.permissions')}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">{t('admin.permDescShort')}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center space-x-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50">
                  <input type="checkbox" checked={formData.listMemberOnly} onChange={e => setFormData({ ...formData, listMemberOnly: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">{t('admin.listView')}</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50">
                  <input type="checkbox" checked={formData.readMemberOnly} onChange={e => setFormData({ ...formData, readMemberOnly: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">{t('admin.readPost')}</span>
                </label>
                <label className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30 opacity-70">
                  <input type="checkbox" checked={true} disabled className="rounded border-gray-300" />
                  <span className="text-sm">{t('admin.writePost')}</span>
                </label>
                <label className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30 opacity-70">
                  <input type="checkbox" checked={true} disabled className="rounded border-gray-300" />
                  <span className="text-sm">{t('admin.commentWrite')}</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Feature settings */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">{t('admin.features')}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useComment} onChange={e => setFormData({ ...formData, useComment: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">{t('admin.useComment')}</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useReaction} onChange={e => setFormData({ ...formData, useReaction: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">{t('admin.useReaction')}</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useFile} onChange={e => setFormData({ ...formData, useFile: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">{t('admin.useFile')}</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useSecret} onChange={e => setFormData({ ...formData, useSecret: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">{t('admin.useSecret')}</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Display settings */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">{t('admin.displaySettings')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('admin.displayType')}</Label>
                  <select value={formData.displayType} onChange={e => setFormData({ ...formData, displayType: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="list">{t('admin.displayList')}</option>
                    <option value="gallery">{t('admin.displayGallery')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.sortOrder')}</Label>
                  <select value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="latest">{t('admin.sortLatest')}</option>
                    <option value="popular">{t('admin.sortPopular')}</option>
                    <option value="oldest">{t('admin.sortOldest')}</option>
                  </select>
                </div>
              </div>
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-gray-300"
                  checked={formData.showPostNumber}
                  onChange={e => setFormData({ ...formData, showPostNumber: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium">{t('admin.showPostNumberLabel')}</span>
                  <span className="block text-xs text-muted-foreground">{t('admin.showPostNumberHelp')}</span>
                </span>
              </label>
            </CardContent>
          </Card>

          {/* Status + save */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm font-medium">{t('admin.activate')}</span>
                </label>
                <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {t('admin.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
