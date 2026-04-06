"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  Package,
  Eye,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react"
import Link from "next/link"

interface Product {
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  originPrice: number | null
  images: string[]
  isActive: boolean
  isSoldOut: boolean
  sortOrder: number
  viewCount: number
  soldCount: number
  category: { id: number; name: string; slug: string } | null
  optionCount: number
  orderCount: number
  createdAt: string
  selected?: boolean
}

interface Category {
  id: number
  name: string
  slug: string
}

// 상품 생성 모달
function ProductModal({
  isOpen,
  onClose,
  categories,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  categories: Category[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (data: any) => void
}) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    categoryId: '',
    description: '',
    price: '',
    originPrice: '',
    isActive: true
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        slug: '',
        categoryId: '',
        description: '',
        price: '',
        originPrice: '',
        isActive: true
      })
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({
      ...formData,
      categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
      price: parseInt(formData.price) || 0,
      originPrice: formData.originPrice ? parseInt(formData.originPrice) : null
    })
    setSaving(false)
  }

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
          <h2 className="text-lg font-semibold">상품 추가</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label htmlFor="name">상품명 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  name: e.target.value,
                  slug: generateSlug(e.target.value)
                })
              }}
              placeholder="상품명"
              required
            />
          </div>

          <div>
            <Label htmlFor="slug">슬러그 *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="product-slug"
              required
            />
          </div>

          <div>
            <Label htmlFor="category">카테고리</Label>
            <Select
              value={formData.categoryId || 'none'}
              onValueChange={(value) => setFormData({ ...formData, categoryId: value === 'none' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">없음</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="price">판매가 *</Label>
            <Input
              id="price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0"
              required
            />
          </div>

          <div>
            <Label htmlFor="originPrice">정가 (할인 표시용)</Label>
            <Input
              id="originPrice"
              type="number"
              value={formData.originPrice}
              onChange={(e) => setFormData({ ...formData, originPrice: e.target.value })}
              placeholder="0"
            />
          </div>

          <div>
            <Label htmlFor="description">짧은 설명</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="상품 한 줄 설명"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">바로 판매 시작</Label>
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
              추가
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ShopProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState({ total: 0, active: 0, soldOut: 0 })
  const [modalOpen, setModalOpen] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search && { search }),
        ...(categoryFilter && { categoryId: categoryFilter }),
        ...(statusFilter === 'active' && { isActive: 'true' }),
        ...(statusFilter === 'inactive' && { isActive: 'false' }),
        ...(statusFilter === 'soldout' && { isSoldOut: 'true' })
      })

      const res = await fetch(`/api/admin/shop/products?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products.map((p: Product) => ({ ...p, selected: false })))
        setTotalPages(data.pagination.totalPages)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('상품 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [page, search, categoryFilter, statusFilter])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shop/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('카테고리 조회 에러:', error)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreateProduct = async (data: { categoryId: string | number | null; [key: string]: unknown }) => {
    try {
      const res = await fetch('/api/admin/shop/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          categoryId: data.categoryId === 'none' ? null : data.categoryId
        })
      })

      if (res.ok) {
        const result = await res.json()
        setModalOpen(false)
        // 새 상품 편집 페이지로 이동
        router.push(`/admin/shop/products/${result.product.id}`)
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
    if (!confirm(`${ids.length}개의 상품을 삭제하시겠습니까?`)) return

    try {
      const res = await fetch(`/api/admin/shop/products?ids=${ids.join(',')}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchProducts()
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
    const allSelected = products.every(p => p.selected)
    setProducts(products.map(p => ({ ...p, selected: !allSelected })))
  }

  const handleSelect = (id: number) => {
    setProducts(products.map(p =>
      p.id === id ? { ...p, selected: !p.selected } : p
    ))
  }

  const selectedProducts = products.filter(p => p.selected)

  const formatPrice = (price: number) => {
    return price.toLocaleString() + '원'
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">상품 관리</h1>
              <p className="text-muted-foreground">쇼핑몰 상품을 관리합니다.</p>
            </div>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              상품 추가
            </Button>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  전체 상품
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
                  판매중
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  품절
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.soldOut}</div>
              </CardContent>
            </Card>
          </div>

          {/* 필터 */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="상품 검색..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-10"
              />
            </div>

            <Select value={categoryFilter || 'all'} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="카테고리" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="active">판매중</SelectItem>
                <SelectItem value="inactive">비활성</SelectItem>
                <SelectItem value="soldout">품절</SelectItem>
              </SelectContent>
            </Select>

            {selectedProducts.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(selectedProducts.map(p => p.id))}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                선택 삭제 ({selectedProducts.length})
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
                        checked={products.length > 0 && products.every(p => p.selected)}
                        onChange={handleSelectAll}
                        className="rounded border-input"
                      />
                    </th>
                    <th className="p-3 text-left font-medium w-16">이미지</th>
                    <th className="p-3 text-left font-medium">상품명</th>
                    <th className="p-3 text-left font-medium">카테고리</th>
                    <th className="p-3 text-left font-medium">가격</th>
                    <th className="p-3 text-left font-medium">옵션</th>
                    <th className="p-3 text-left font-medium">상태</th>
                    <th className="p-3 text-left font-medium">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        상품이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={product.selected || false}
                            onChange={() => handleSelect(product.id)}
                            className="rounded border-input"
                          />
                        </td>
                        <td className="p-3">
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {product.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          {product.category?.name || '-'}
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{formatPrice(product.price)}</div>
                          {product.originPrice && product.originPrice > product.price && (
                            <div className="text-xs text-muted-foreground line-through">
                              {formatPrice(product.originPrice)}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {product.optionCount > 0 ? (
                            <span className="text-sm">{product.optionCount}개</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              product.isActive
                                ? 'bg-green-500/10 text-green-600'
                                : 'bg-gray-500/10 text-gray-600'
                            }`}>
                              {product.isActive ? '판매중' : '비활성'}
                            </span>
                            {product.isSoldOut && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-600">
                                품절
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Link href={`/admin/shop/products/${product.id}`}>
                              <Button variant="ghost" size="icon">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/shop/products/${product.slug}`} target="_blank">
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete([product.id])}
                              disabled={product.orderCount > 0}
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

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t">
                <Button
                  variant="outline"
                  size="icon"
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
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Card>
        </div>
      </main>

      <ProductModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categories}
        onSave={handleCreateProduct}
      />
    </div>
  )
}
