"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  Truck,
  Check,
  MapPin,
} from "lucide-react"

interface DeliveryFee {
  id: number
  name: string
  regions: string[]
  fee: number
  freeAmount: number | null
  isDefault: boolean
  isActive: boolean
  sortOrder: number
}

// 배송비 정책 모달
function DeliveryModal({
  isOpen,
  onClose,
  delivery,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  delivery: DeliveryFee | null
  onSave: (data: Partial<DeliveryFee>) => void
}) {
  const [formData, setFormData] = useState({
    name: '',
    regions: '',
    fee: '',
    freeAmount: '',
    isDefault: false,
    isActive: true,
    sortOrder: 0
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (delivery) {
      setFormData({
        name: delivery.name,
        regions: delivery.regions.join('\n'),
        fee: String(delivery.fee),
        freeAmount: delivery.freeAmount ? String(delivery.freeAmount) : '',
        isDefault: delivery.isDefault,
        isActive: delivery.isActive,
        sortOrder: delivery.sortOrder
      })
    } else {
      setFormData({
        name: '',
        regions: '',
        fee: '',
        freeAmount: '',
        isDefault: false,
        isActive: true,
        sortOrder: 0
      })
    }
  }, [delivery, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const regions = formData.regions
      .split('\n')
      .map(r => r.trim())
      .filter(Boolean)

    await onSave({
      ...(delivery && { id: delivery.id }),
      name: formData.name,
      regions,
      fee: parseInt(formData.fee) || 0,
      freeAmount: formData.freeAmount ? parseInt(formData.freeAmount) : null,
      isDefault: formData.isDefault,
      isActive: formData.isActive,
      sortOrder: formData.sortOrder
    })
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {delivery ? '배송비 정책 수정' : '배송비 정책 추가'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label htmlFor="name">정책 이름 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="예: 기본, 제주, 도서산간"
              required
            />
          </div>

          <div>
            <Label htmlFor="fee">배송비 *</Label>
            <Input
              id="fee"
              type="number"
              value={formData.fee}
              onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
              placeholder="0"
              required
            />
          </div>

          <div>
            <Label htmlFor="freeAmount">무료배송 기준금액</Label>
            <Input
              id="freeAmount"
              type="number"
              value={formData.freeAmount}
              onChange={(e) => setFormData({ ...formData, freeAmount: e.target.value })}
              placeholder="비워두면 무료배송 없음"
            />
            <p className="text-xs text-muted-foreground mt-1">
              이 금액 이상 구매 시 무료배송
            </p>
          </div>

          <div>
            <Label htmlFor="regions">적용 지역 (우편번호)</Label>
            <textarea
              id="regions"
              value={formData.regions}
              onChange={(e) => setFormData({ ...formData, regions: e.target.value })}
              className="w-full min-h-[120px] p-3 border rounded-md bg-background text-sm"
              placeholder={`우편번호 범위를 한 줄에 하나씩 입력
예시:
63000-63644
69000-69999
40000`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              기본 배송비는 지역을 비워두세요. 지역별 배송비는 우편번호 범위(63000-63644) 또는 단일 우편번호를 입력하세요.
            </p>
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
            <div>
              <Label htmlFor="isDefault">기본 배송비로 설정</Label>
              <p className="text-xs text-muted-foreground">지역 매칭이 안 될 때 적용</p>
            </div>
            <Switch
              id="isDefault"
              checked={formData.isDefault}
              onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
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
              {delivery ? '수정' : '추가'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ShopDeliveryPage() {
  const [deliveryFees, setDeliveryFees] = useState<DeliveryFee[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState<DeliveryFee | null>(null)

  const fetchDeliveryFees = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shop/delivery')
      if (res.ok) {
        const data = await res.json()
        setDeliveryFees(data.deliveryFees)
      }
    } catch (error) {
      console.error('배송비 정책 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeliveryFees()
  }, [fetchDeliveryFees])

  const handleSave = async (data: Partial<DeliveryFee>) => {
    try {
      const method = data.id ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/shop/delivery', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        setModalOpen(false)
        setEditingDelivery(null)
        fetchDeliveryFees()
      } else {
        const error = await res.json()
        alert(error.error || '저장 실패')
      }
    } catch (error) {
      console.error('저장 에러:', error)
      alert('저장 중 오류가 발생했습니다.')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('이 배송비 정책을 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/admin/shop/delivery?ids=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchDeliveryFees()
      } else {
        const error = await res.json()
        alert(error.error || '삭제 실패')
      }
    } catch (error) {
      console.error('삭제 에러:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  // 기본 배송비 정책 생성
  const handleCreateDefaults = async () => {
    if (!confirm('기본 배송비 정책(기본, 제주, 도서산간)을 생성하시겠습니까?')) return

    const defaults = [
      { name: '기본', fee: 3000, freeAmount: 50000, regions: [], isDefault: true, sortOrder: 0 },
      { name: '제주', fee: 6000, freeAmount: 50000, regions: ['63000-63644'], sortOrder: 1 },
      { name: '도서산간', fee: 8000, freeAmount: null, regions: ['23000-23010', '40200-40240'], sortOrder: 2 }
    ]

    for (const policy of defaults) {
      await fetch('/api/admin/shop/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      })
    }

    fetchDeliveryFees()
  }

  const formatPrice = (price: number) => price.toLocaleString() + '원'

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">배송비 정책</h1>
              <p className="text-muted-foreground">지역별 배송비를 설정합니다.</p>
            </div>
            <div className="flex gap-2">
              {deliveryFees.length === 0 && (
                <Button variant="outline" onClick={handleCreateDefaults}>
                  기본 정책 생성
                </Button>
              )}
              <Button onClick={() => { setEditingDelivery(null); setModalOpen(true) }}>
                <Plus className="h-4 w-4 mr-2" />
                정책 추가
              </Button>
            </div>
          </div>

          {/* 안내 */}
          <Card className="mb-6 bg-muted/50">
            <CardContent className="p-4">
              <h3 className="font-medium mb-2">배송비 계산 방식</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>1. 주문 시 입력된 우편번호로 지역을 판단합니다.</li>
                <li>2. 우편번호가 매칭되는 정책의 배송비를 적용합니다.</li>
                <li>3. 매칭되는 정책이 없으면 기본 배송비가 적용됩니다.</li>
                <li>4. 무료배송 기준금액 이상 구매 시 해당 지역은 무료배송됩니다.</li>
              </ul>
            </CardContent>
          </Card>

          {/* 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  전체 정책
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deliveryFees.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  활성 정책
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {deliveryFees.filter(d => d.isActive).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  지역 정책
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {deliveryFees.filter(d => d.regions.length > 0).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 정책 목록 */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">정책명</th>
                    <th className="p-3 text-left font-medium">배송비</th>
                    <th className="p-3 text-left font-medium">무료배송</th>
                    <th className="p-3 text-left font-medium">적용 지역</th>
                    <th className="p-3 text-left font-medium">상태</th>
                    <th className="p-3 text-left font-medium">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </td>
                    </tr>
                  ) : deliveryFees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        배송비 정책이 없습니다. 기본 정책을 생성하거나 직접 추가해주세요.
                      </td>
                    </tr>
                  ) : (
                    deliveryFees.map((delivery) => (
                      <tr key={delivery.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{delivery.name}</span>
                            {delivery.isDefault && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                기본
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-medium">{formatPrice(delivery.fee)}</td>
                        <td className="p-3">
                          {delivery.freeAmount ? (
                            <span>{formatPrice(delivery.freeAmount)} 이상</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {delivery.regions.length > 0 ? (
                            <span className="text-sm">
                              {delivery.regions.slice(0, 2).join(', ')}
                              {delivery.regions.length > 2 && ` 외 ${delivery.regions.length - 2}개`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">전체 (기본)</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            delivery.isActive
                              ? 'bg-green-500/10 text-green-600'
                              : 'bg-red-500/10 text-red-600'
                          }`}>
                            {delivery.isActive ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingDelivery(delivery); setModalOpen(true) }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(delivery.id)}
                              disabled={delivery.isDefault}
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

      <DeliveryModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingDelivery(null) }}
        delivery={editingDelivery}
        onSave={handleSave}
      />
    </div>
  )
}
