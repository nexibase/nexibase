"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Search,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  FolderOpen,
  Package,
  Check,
  Eye,
} from "lucide-react"
import Link from "next/link"

interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isActive: boolean
  productCount: number
  createdAt: string
  selected?: boolean
}

// 카테고리 모달
function CategoryModal({
  isOpen,
  onClose,
  category,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  category: Category | null
  onSave: (data: Partial<Category>) => void
}) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    sortOrder: 0,
    isActive: true
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        sortOrder: category.sortOrder,
        isActive: category.isActive
      })
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        sortOrder: 0,
        isActive: true
      })
    }
  }, [category, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave(category ? { id: category.id, ...formData } : formData)
    setSaving(false)
  }

  // 이름에서 슬러그 자동 생성
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {category ? '카테고리 수정' : '카테고리 추가'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label htmlFor="name">이름 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  name: e.target.value,
                  slug: !category ? generateSlug(e.target.value) : formData.slug
                })
              }}
              placeholder="카테고리 이름"
              required
            />
          </div>

          <div>
            <Label htmlFor="slug">슬러그 *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="url-slug"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL에 사용됩니다. 영문, 숫자, 하이픈만 사용하세요.
            </p>
          </div>

          <div>
            <Label htmlFor="description">설명</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="카테고리 설명"
            />
          </div>

          <div>
            <Label htmlFor="sortOrder">정렬순서</Label>
            <Input
              id="sortOrder"
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">활성화</Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {category ? '수정' : '추가'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ShopCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shop/categories?includeInactive=true')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories.map((c: Category) => ({ ...c, selected: false })))
      }
    } catch (error) {
      console.error('카테고리 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleSaveCategory = async (data: Partial<Category>) => {
    try {
      const method = data.id ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/shop/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        setModalOpen(false)
        setEditingCategory(null)
        fetchCategories()
      } else {
        const error = await res.json()
        alert(error.error || '저장 실패')
      }
    } catch (error) {
      console.error('저장 에러:', error)
      alert('저장 중 오류가 발생했습니다.')
    }
  }

  const handleDelete = async (ids: number[]) => {
    if (!confirm(`${ids.length}개의 카테고리를 삭제하시겠습니까?`)) return

    try {
      const res = await fetch(`/api/admin/shop/categories?ids=${ids.join(',')}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchCategories()
      } else {
        const error = await res.json()
        alert(error.error || '삭제 실패')
      }
    } catch (error) {
      console.error('삭제 에러:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const handleSelectAll = () => {
    const allSelected = filteredCategories.every(c => c.selected)
    setCategories(categories.map(c =>
      filteredCategories.find(fc => fc.id === c.id)
        ? { ...c, selected: !allSelected }
        : c
    ))
  }

  const handleSelect = (id: number) => {
    setCategories(categories.map(c =>
      c.id === id ? { ...c, selected: !c.selected } : c
    ))
  }

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  )

  const selectedCategories = categories.filter(c => c.selected)
  const stats = {
    total: categories.length,
    active: categories.filter(c => c.isActive).length,
    totalProducts: categories.reduce((sum, c) => sum + c.productCount, 0)
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">상품 카테고리</h1>
              <p className="text-muted-foreground">쇼핑몰 상품 카테고리를 관리합니다.</p>
            </div>
            <Button onClick={() => { setEditingCategory(null); setModalOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              카테고리 추가
            </Button>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  전체 카테고리
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  활성 카테고리
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  등록 상품
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalProducts}</div>
              </CardContent>
            </Card>
          </div>

          {/* 검색/액션 */}
          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="카테고리 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {selectedCategories.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(selectedCategories.map(c => c.id))}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                선택 삭제 ({selectedCategories.length})
              </Button>
            )}
          </div>

          {/* 테이블 */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={filteredCategories.length > 0 && filteredCategories.every(c => c.selected)}
                        onChange={handleSelectAll}
                        className="rounded border-input"
                      />
                    </th>
                    <th className="p-3 text-left font-medium">이름</th>
                    <th className="p-3 text-left font-medium">슬러그</th>
                    <th className="p-3 text-left font-medium">상품수</th>
                    <th className="p-3 text-left font-medium">정렬</th>
                    <th className="p-3 text-left font-medium">상태</th>
                    <th className="p-3 text-left font-medium">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </td>
                    </tr>
                  ) : filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        카테고리가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((category) => (
                      <tr key={category.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={category.selected || false}
                            onChange={() => handleSelect(category.id)}
                            className="rounded border-input"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{category.name}</div>
                          {category.description && (
                            <div className="text-xs text-muted-foreground">{category.description}</div>
                          )}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{category.slug}</td>
                        <td className="p-3">{category.productCount}</td>
                        <td className="p-3">{category.sortOrder}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            category.isActive
                              ? 'bg-green-500/10 text-green-600'
                              : 'bg-red-500/10 text-red-600'
                          }`}>
                            {category.isActive ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingCategory(category); setModalOpen(true) }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Link href={`/shop/categories/${category.slug}`} target="_blank">
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete([category.id])}
                              disabled={category.productCount > 0}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>

      <CategoryModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingCategory(null) }}
        category={editingCategory}
        onSave={handleSaveCategory}
      />
    </div>
  )
}
