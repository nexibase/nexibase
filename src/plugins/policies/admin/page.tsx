"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TiptapEditor } from "@/components/editors/TiptapEditor"
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  FileText,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  Power,
  Sparkles,
  Scale,
} from "lucide-react"
import { useTranslations } from 'next-intl'

interface Policy {
  id: number
  slug: string
  version: string
  title: string
  content: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  selected?: boolean
}

interface SlugGroup {
  slug: string
  _count: { id: number }
}

// 약관 모달
function PolicyModal({
  isOpen,
  onClose,
  policy,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  policy: Policy | null
  onSave: (data: Partial<Policy>) => void
}) {
  const t = useTranslations('policies.admin')
  const [formData, setFormData] = useState({
    slug: '',
    version: '1.0',
    title: '',
    content: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (policy) {
      setFormData({
        slug: policy.slug || '',
        version: policy.version || '1.0',
        title: policy.title || '',
        content: policy.content || '',
      })
    } else {
      setFormData({
        slug: '',
        version: '1.0',
        title: '',
        content: '',
      })
    }
  }, [policy, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await onSave(formData)
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold">
            {policy ? t('editTitle') : t('createTitle')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">
                {t('slugRequired')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                placeholder="terms, privacy..."
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                className={policy ? 'bg-muted' : ''}
                disabled={!!policy}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('slugHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">
                {t('versionRequired')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="version"
                placeholder="1.0, 1.1, 2.0..."
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className={policy ? 'bg-muted' : ''}
                disabled={!!policy}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('versionHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">
                {t('titleRequired')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder={t('titlePlaceholder')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('content')}</Label>
            <TiptapEditor
              content={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              placeholder={t('contentPlaceholder')}
            />
          </div>

          {!policy && (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              {t('newPolicyNotice')}
            </p>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {policy ? t('editBtn') : t('addBtn')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PoliciesPage() {
  const t = useTranslations('policies.admin')
  const [policies, setPolicies] = useState<Policy[]>([])
  const [slugGroups, setSlugGroups] = useState<SlugGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
  const [selectedAll, setSelectedAll] = useState(false)
  const [activatingId, setActivatingId] = useState<number | null>(null)
  const [seedingPolicies, setSeedingPolicies] = useState(false)

  // 기본 약관 생성
  const handleSeedPolicies = async () => {
    if (!confirm(t('seedConfirm'))) return

    setSeedingPolicies(true)
    try {
      const response = await fetch('/api/admin/policies/seed', {
        method: 'POST'
      })
      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        fetchPolicies()
      } else {
        alert(data.error || t('seedFailed'))
      }
    } catch (error) {
      console.error('기본 약관 생성 에러:', error)
      alert(t('seedError'))
    } finally {
      setSeedingPolicies(false)
    }
  }

  // 약관 목록 조회
  const fetchPolicies = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })

      const response = await fetch(`/api/admin/policies?${params}`)
      const data = await response.json()

      if (data.success) {
        setPolicies(data.policies.map((p: Policy) => ({ ...p, selected: false })))
        setSlugGroups(data.slugGroups || [])
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('약관 목록 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchPolicies()
  }, [fetchPolicies])

  // 약관 저장
  const handleSavePolicy = async (formData: Partial<Policy>) => {
    try {
      const url = editingPolicy
        ? `/api/admin/policies/${editingPolicy.id}`
        : '/api/admin/policies'

      const response = await fetch(url, {
        method: editingPolicy ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setModalOpen(false)
        setEditingPolicy(null)
        fetchPolicies()
      } else {
        alert(data.error || t('saveFailed'))
      }
    } catch (error) {
      console.error('약관 저장 에러:', error)
      alert(t('saveError'))
    }
  }

  // 약관 활성화
  const handleActivate = async (policy: Policy) => {
    if (!confirm(t('activateConfirm', { title: policy.title, version: policy.version }))) return

    setActivatingId(policy.id)
    try {
      const response = await fetch(`/api/admin/policies/${policy.id}/activate`, {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        fetchPolicies()
      } else {
        alert(data.error || t('activateFailed'))
      }
    } catch (error) {
      console.error('약관 활성화 에러:', error)
      alert(t('activateError'))
    } finally {
      setActivatingId(null)
    }
  }

  // 약관 삭제
  const handleDelete = async (policy: Policy) => {
    if (!confirm(t('deleteOneConfirm', { title: policy.title, version: policy.version }))) return

    try {
      const response = await fetch(`/api/admin/policies/${policy.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchPolicies()
      } else {
        const data = await response.json()
        alert(data.error || t('deleteFailed'))
      }
    } catch (error) {
      console.error('약관 삭제 에러:', error)
      alert(t('deleteError'))
    }
  }

  // 선택 삭제
  const handleBulkDelete = async () => {
    const selectedIds = policies.filter(p => p.selected).map(p => p.id)
    if (selectedIds.length === 0) {
      alert(t('bulkSelectEmpty'))
      return
    }

    if (!confirm(t('bulkDeleteConfirm', { count: selectedIds.length }))) return

    try {
      const response = await fetch('/api/admin/policies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })

      if (response.ok) {
        setSelectedAll(false)
        fetchPolicies()
      } else {
        const data = await response.json()
        alert(data.error || t('deleteFailed'))
      }
    } catch (error) {
      console.error('일괄 삭제 에러:', error)
      alert(t('deleteError'))
    }
  }

  // 전체 선택
  const handleSelectAll = () => {
    const newSelected = !selectedAll
    setSelectedAll(newSelected)
    setPolicies(policies.map(p => ({ ...p, selected: newSelected })))
  }

  // 개별 선택
  const handleSelect = (id: number) => {
    setPolicies(policies.map(p =>
      p.id === id ? { ...p, selected: !p.selected } : p
    ))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar activeMenu="policies" />
        <main className="flex-1 lg:ml-0 p-6">
          {/* 헤더 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-6 w-6" />
              {t('title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('headerDesc')}</p>
          </div>

          {/* 슬러그 요약 */}
          {slugGroups.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {slugGroups.map(group => (
                <Card key={group.slug}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{group.slug}</p>
                        <p className="text-xl font-bold">{t('versionsCount', { count: group._count.id })}</p>
                      </div>
                      <History className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 액션 */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="text-sm text-muted-foreground">
                  {t('actionNotice')}
                </div>

                <div className="flex gap-2">
                  {policies.some(p => p.selected) && (
                    <Button variant="destructive" onClick={handleBulkDelete}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('bulkDelete')}
                    </Button>
                  )}
                  <Button onClick={() => { setEditingPolicy(null); setModalOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('createBtn')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 약관 목록 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t('listTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : policies.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">{t('empty')}</p>
                  <div className="flex justify-center gap-2">
                    <Button onClick={handleSeedPolicies} disabled={seedingPolicies}>
                      {seedingPolicies ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {t('seedCreate')}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditingPolicy(null); setModalOpen(true); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('addDirectly')}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('seedHint')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left w-10">
                            <input
                              type="checkbox"
                              checked={selectedAll}
                              onChange={handleSelectAll}
                              className="rounded border-gray-300"
                            />
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">{t('colSlug')}</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">{t('colVersion')}</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">{t('colTitle')}</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">{t('colStatus')}</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">{t('colUpdatedAt')}</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">{t('colActions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map((policy) => (
                          <tr key={policy.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={policy.selected}
                                onChange={() => handleSelect(policy.id)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="p-3">
                              <a
                                href={`/policies/${policy.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-muted hover:bg-primary/20 rounded text-sm transition-colors group"
                              >
                                <code className="group-hover:text-primary">{policy.slug}</code>
                                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                              </a>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline">v{policy.version}</Badge>
                            </td>
                            <td className="p-3">
                              <span className="font-medium text-foreground">{policy.title}</span>
                            </td>
                            <td className="p-3 text-center">
                              {policy.isActive ? (
                                <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/10 dark:bg-green-500/20 dark:text-green-400">
                                  <Check className="h-3 w-3 mr-1" />
                                  {t('statusActive')}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">{t('statusInactive')}</Badge>
                              )}
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {new Date(policy.updatedAt).toLocaleDateString('ko-KR')}
                            </td>
                            <td className="p-3">
                              <div className="flex justify-center gap-1">
                                {!policy.isActive && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleActivate(policy)}
                                    disabled={activatingId === policy.id}
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title={t('tooltipActivate')}
                                  >
                                    {activatingId === policy.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Power className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setEditingPolicy(policy); setModalOpen(true); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(policy)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* 모달 */}
      <PolicyModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingPolicy(null); }}
        policy={editingPolicy}
        onSave={handleSavePolicy}
      />
    </div>
  )
}
