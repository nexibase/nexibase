"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Upload,
  GripVertical,
  Package,
  Settings,
  Image as ImageIcon,
  ExternalLink,
  FileText,
} from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const TiptapEditor = dynamic(
  () => import("@/components/editor/TiptapEditor").then(mod => mod.TiptapEditor),
  {
    ssr: false,
    loading: () => <div className="h-[400px] border rounded-md flex items-center justify-center text-muted-foreground">에디터 로딩 중...</div>
  }
)

interface Product {
  id: number
  name: string
  slug: string
  description: string | null
  content: string | null
  price: number
  originPrice: number | null
  stock: number
  images: string[]
  optionName1: string | null
  optionName2: string | null
  optionName3: string | null
  isActive: boolean
  isSoldOut: boolean
  sortOrder: number
  categoryId: number | null
  category: { id: number; name: string; slug: string } | null
  options: ProductOption[]
}

interface ProductOption {
  id: number
  option1: string | null
  option2: string | null
  option3: string | null
  price: number
  stock: number
  sku: string | null
  isActive: boolean
  sortOrder: number
}

interface Category {
  id: number
  name: string
  slug: string
}

// 드래그 가능한 이미지 컴포넌트
function SortableImage({
  id,
  url,
  index,
  isFirst,
  onRemove
}: {
  id: string
  url: string
  index: number
  isFirst: boolean
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isDragging ? 'ring-2 ring-primary' : ''}`}
    >
      <img
        src={url}
        alt={`상품 이미지 ${index + 1}`}
        className="w-full aspect-square object-cover rounded-lg border"
      />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="destructive"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {isFirst && (
        <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
          대표
        </span>
      )}
    </div>
  )
}

export default function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // URL에서 탭 상태 읽기
  const tabParam = searchParams.get('tab')
  const validTabs = ['basic', 'description', 'options', 'images'] as const
  type TabType = typeof validTabs[number]
  const activeTab: TabType = validTabs.includes(tabParam as TabType) ? (tabParam as TabType) : 'basic'

  // 탭 변경 시 URL 업데이트
  const setActiveTab = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'basic') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    router.replace(`/admin/shop/products/${id}${params.toString() ? `?${params}` : ''}`)
  }

  // 기본 정보 폼
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    categoryId: '',
    description: '',
    content: '',
    price: '',
    originPrice: '',
    stock: '',
    optionName1: '',
    optionName2: '',
    optionName3: '',
    isActive: true,
    isSoldOut: false,
    sortOrder: 0
  })

  // 옵션 상태
  const [options, setOptions] = useState<ProductOption[]>([])
  const [newOption, setNewOption] = useState({
    option1: '',
    option2: '',
    option3: '',
    price: '',
    stock: '',
    sku: ''
  })

  // 이미지 상태
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  // 드래그앤드랍 센서
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이동 후에 드래그 시작 (클릭과 구분)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 드래그 종료 핸들러
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/shop/products/${id}`)
      if (res.ok) {
        const data = await res.json()
        const p = data.product
        setProduct(p)
        setFormData({
          name: p.name,
          slug: p.slug,
          categoryId: p.categoryId ? String(p.categoryId) : '',
          description: p.description || '',
          content: p.content || '',
          price: String(p.price),
          originPrice: p.originPrice ? String(p.originPrice) : '',
          stock: String(p.stock || 0),
          optionName1: p.optionName1 || '',
          optionName2: p.optionName2 || '',
          optionName3: p.optionName3 || '',
          isActive: p.isActive,
          isSoldOut: p.isSoldOut,
          sortOrder: p.sortOrder
        })
        setOptions(p.options || [])
        setImages(p.images || [])
      }
    } catch (error) {
      console.error('상품 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [id])

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
    fetchProduct()
  }, [fetchCategories, fetchProduct])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/shop/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
          price: parseInt(formData.price) || 0,
          originPrice: formData.originPrice ? parseInt(formData.originPrice) : null,
          stock: parseInt(formData.stock) || 0,
          images
        })
      })

      if (res.ok) {
        alert('저장되었습니다.')
        fetchProduct()
      } else {
        const error = await res.json()
        alert(error.error || '저장 실패')
      }
    } catch (error) {
      console.error('저장 에러:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 옵션 추가
  const handleAddOption = async () => {
    if (!newOption.price) {
      alert('가격은 필수입니다.')
      return
    }

    try {
      const res = await fetch(`/api/admin/shop/products/${id}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          option1: newOption.option1 || null,
          option2: newOption.option2 || null,
          option3: newOption.option3 || null,
          price: parseInt(newOption.price),
          stock: parseInt(newOption.stock) || 0,
          sku: newOption.sku || null
        })
      })

      if (res.ok) {
        setNewOption({ option1: '', option2: '', option3: '', price: '', stock: '', sku: '' })
        fetchProduct()
      } else {
        const error = await res.json()
        alert(error.error || '추가 실패')
      }
    } catch (error) {
      console.error('옵션 추가 에러:', error)
    }
  }

  // 옵션 수정
  const handleUpdateOption = async (optionId: number, field: string, value: string | number) => {
    try {
      const res = await fetch(`/api/admin/shop/products/${id}/options`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionId,
          [field]: value
        })
      })

      if (res.ok) {
        fetchProduct()
      } else {
        const error = await res.json()
        alert(error.error || '수정 실패')
      }
    } catch (error) {
      console.error('옵션 수정 에러:', error)
    }
  }

  // 옵션 삭제
  const handleDeleteOption = async (optionId: number) => {
    if (!confirm('이 옵션을 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/admin/shop/products/${id}/options?optionIds=${optionId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchProduct()
      } else {
        const error = await res.json()
        alert(error.error || '삭제 실패')
      }
    } catch (error) {
      console.error('옵션 삭제 에러:', error)
    }
  }

  // 이미지 업로드
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const newImages: string[] = []

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'products')
      formData.append('productId', id)  // 상품별 폴더 분리

      try {
        const res = await fetch('/api/tiptap-image-upload', {
          method: 'POST',
          body: formData
        })

        if (res.ok) {
          const data = await res.json()
          newImages.push(data.url)
        } else {
          const error = await res.json()
          alert(error.error || '이미지 업로드 실패')
        }
      } catch (error) {
        console.error('이미지 업로드 에러:', error)
      }
    }

    setImages([...images, ...newImages])
    setUploading(false)
  }

  // 이미지 삭제
  const handleRemoveImage = async (index: number) => {
    const imageUrl = images[index]

    // 서버에서 파일 삭제
    try {
      await fetch('/api/admin/delete-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      })
    } catch (error) {
      console.error('이미지 삭제 에러:', error)
    }

    // 상태에서 제거
    setImages(images.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-muted/30">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex min-h-screen bg-muted/30">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <p className="text-muted-foreground">상품을 찾을 수 없습니다.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href="/admin/shop/products">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">상품 수정</h1>
                <p className="text-muted-foreground">{product.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/shop/${product.slug}`} target="_blank">
                <Button variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  바로가기
                </Button>
              </Link>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                저장
              </Button>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <Button
              variant={activeTab === 'basic' ? 'default' : 'outline'}
              onClick={() => setActiveTab('basic')}
            >
              <Package className="h-4 w-4 mr-2" />
              기본
            </Button>
            <Button
              variant={activeTab === 'description' ? 'default' : 'outline'}
              onClick={() => setActiveTab('description')}
            >
              <FileText className="h-4 w-4 mr-2" />
              설명
            </Button>
            <Button
              variant={activeTab === 'options' ? 'default' : 'outline'}
              onClick={() => setActiveTab('options')}
            >
              <Settings className="h-4 w-4 mr-2" />
              옵션 ({options.length})
            </Button>
            <Button
              variant={activeTab === 'images' ? 'default' : 'outline'}
              onClick={() => setActiveTab('images')}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              이미지 ({images.length})
            </Button>
          </div>

          {/* 기본 정보 탭 */}
          {activeTab === 'basic' && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">상품명 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="slug">슬러그 *</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">카테고리</Label>
                    <Select
                      value={formData.categoryId || 'none'}
                      onValueChange={(v) => setFormData({ ...formData, categoryId: v === 'none' ? '' : v })}
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
                    <Label htmlFor="sortOrder">정렬순서</Label>
                    <Input
                      id="sortOrder"
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">판매가 *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="originPrice">정가 (할인 표시용)</Label>
                    <Input
                      id="originPrice"
                      type="number"
                      value={formData.originPrice}
                      onChange={(e) => setFormData({ ...formData, originPrice: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock">재고 (옵션 없는 상품용)</Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      disabled={options.length > 0}
                    />
                    {options.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        옵션이 있는 상품은 옵션 탭에서 재고를 관리합니다.
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-3">옵션명 설정</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    3단계 옵션을 사용할 경우 각 단계의 이름을 설정하세요.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="optionName1">1단계 옵션명</Label>
                      <Input
                        id="optionName1"
                        value={formData.optionName1}
                        onChange={(e) => setFormData({ ...formData, optionName1: e.target.value })}
                        placeholder="예: 색상"
                      />
                    </div>
                    <div>
                      <Label htmlFor="optionName2">2단계 옵션명</Label>
                      <Input
                        id="optionName2"
                        value={formData.optionName2}
                        onChange={(e) => setFormData({ ...formData, optionName2: e.target.value })}
                        placeholder="예: 사이즈"
                      />
                    </div>
                    <div>
                      <Label htmlFor="optionName3">3단계 옵션명</Label>
                      <Input
                        id="optionName3"
                        value={formData.optionName3}
                        onChange={(e) => setFormData({ ...formData, optionName3: e.target.value })}
                        placeholder="예: 모델"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>판매 상태</Label>
                    <p className="text-sm text-muted-foreground">상품을 쇼핑몰에 표시합니다.</p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>품절 표시</Label>
                    <p className="text-sm text-muted-foreground">상품을 품절로 표시합니다.</p>
                  </div>
                  <Switch
                    checked={formData.isSoldOut}
                    onCheckedChange={(checked) => setFormData({ ...formData, isSoldOut: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 설명 탭 */}
          {activeTab === 'description' && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div>
                  <Label htmlFor="description">짧은 설명</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="상품 목록에 표시되는 한 줄 설명"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    상품 목록 및 검색 결과에서 상품명 아래에 표시됩니다.
                  </p>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="content">상세 설명</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    상품 상세 페이지에 표시되는 내용입니다. 이미지, 표, 동영상 등을 삽입할 수 있습니다.
                  </p>
                  <TiptapEditor
                    content={formData.content}
                    onChange={(content) => setFormData({ ...formData, content })}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 옵션 탭 */}
          {activeTab === 'options' && (
            <div className="space-y-6">
              {/* 옵션 추가 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">옵션 추가</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {formData.optionName1 && (
                      <div>
                        <Label>{formData.optionName1}</Label>
                        <Input
                          value={newOption.option1}
                          onChange={(e) => setNewOption({ ...newOption, option1: e.target.value })}
                          placeholder={`예: 빨강`}
                        />
                      </div>
                    )}
                    {formData.optionName2 && (
                      <div>
                        <Label>{formData.optionName2}</Label>
                        <Input
                          value={newOption.option2}
                          onChange={(e) => setNewOption({ ...newOption, option2: e.target.value })}
                          placeholder={`예: L`}
                        />
                      </div>
                    )}
                    {formData.optionName3 && (
                      <div>
                        <Label>{formData.optionName3}</Label>
                        <Input
                          value={newOption.option3}
                          onChange={(e) => setNewOption({ ...newOption, option3: e.target.value })}
                          placeholder={`예: 프리미엄`}
                        />
                      </div>
                    )}
                    <div>
                      <Label>가격 *</Label>
                      <Input
                        type="number"
                        value={newOption.price}
                        onChange={(e) => setNewOption({ ...newOption, price: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>재고</Label>
                      <Input
                        type="number"
                        value={newOption.stock}
                        onChange={(e) => setNewOption({ ...newOption, stock: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>SKU</Label>
                      <Input
                        value={newOption.sku}
                        onChange={(e) => setNewOption({ ...newOption, sku: e.target.value })}
                        placeholder="재고관리코드"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddOption}>
                    <Plus className="h-4 w-4 mr-2" />
                    옵션 추가
                  </Button>

                  {!formData.optionName1 && !formData.optionName2 && !formData.optionName3 && (
                    <p className="text-sm text-muted-foreground mt-4">
                      옵션을 사용하려면 먼저 기본 정보에서 옵션명을 설정하세요.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* 옵션 목록 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">등록된 옵션 ({options.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {options.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      등록된 옵션이 없습니다.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            {formData.optionName1 && <th className="p-2 text-left font-medium">{formData.optionName1}</th>}
                            {formData.optionName2 && <th className="p-2 text-left font-medium">{formData.optionName2}</th>}
                            {formData.optionName3 && <th className="p-2 text-left font-medium">{formData.optionName3}</th>}
                            <th className="p-2 text-left font-medium">가격</th>
                            <th className="p-2 text-left font-medium">재고</th>
                            <th className="p-2 text-left font-medium">SKU</th>
                            <th className="p-2 text-left font-medium w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {options.map((option) => (
                            <tr key={option.id} className="border-b hover:bg-muted/30">
                              {formData.optionName1 && <td className="p-2">{option.option1 || '-'}</td>}
                              {formData.optionName2 && <td className="p-2">{option.option2 || '-'}</td>}
                              {formData.optionName3 && <td className="p-2">{option.option3 || '-'}</td>}
                              <td className="p-2">
                                <Input
                                  type="number"
                                  defaultValue={option.price}
                                  className="w-24 h-8 text-sm"
                                  onBlur={(e) => {
                                    const newPrice = parseInt(e.target.value)
                                    if (newPrice !== option.price) {
                                      handleUpdateOption(option.id, 'price', newPrice)
                                    }
                                  }}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  defaultValue={option.stock}
                                  className={`w-20 h-8 text-sm ${option.stock <= 0 ? 'text-red-600' : ''}`}
                                  onBlur={(e) => {
                                    const newStock = parseInt(e.target.value)
                                    if (newStock !== option.stock) {
                                      handleUpdateOption(option.id, 'stock', newStock)
                                    }
                                  }}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="text"
                                  defaultValue={option.sku || ''}
                                  className="w-24 h-8 text-sm"
                                  placeholder="-"
                                  onBlur={(e) => {
                                    if (e.target.value !== (option.sku || '')) {
                                      handleUpdateOption(option.id, 'sku', e.target.value)
                                    }
                                  }}
                                />
                              </td>
                              <td className="p-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteOption(option.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 이미지 탭 */}
          {activeTab === 'images' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">상품 이미지</CardTitle>
              </CardHeader>
              <CardContent>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={images} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {images.map((image, index) => (
                        <SortableImage
                          key={image}
                          id={image}
                          url={image}
                          index={index}
                          isFirst={index === 0}
                          onRemove={() => handleRemoveImage(index)}
                        />
                      ))}

                      {/* 업로드 버튼 */}
                      <label className="w-full aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploading}
                        />
                        {uploading ? (
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">이미지 추가</span>
                          </>
                        )}
                      </label>
                    </div>
                  </SortableContext>
                </DndContext>

                <p className="text-sm text-muted-foreground">
                  첫 번째 이미지가 대표 이미지로 사용됩니다. 이미지 위에 마우스를 올리고 <GripVertical className="h-4 w-4 inline" /> 아이콘을 드래그하여 순서를 변경할 수 있습니다.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
