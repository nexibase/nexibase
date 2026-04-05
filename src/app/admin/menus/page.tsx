"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronUp, ChevronDown, ChevronRight, Plus, Trash2, Save, Eye, EyeOff, ExternalLink, Pencil, X, GripVertical
} from "lucide-react"

interface MenuItem {
  id: number
  parentId: number | null
  position: string
  groupName: string | null
  label: string
  url: string
  icon: string | null
  target: string
  visibility: string
  isActive: boolean
  sortOrder: number
  children: MenuItem[]
}

interface MenuForm {
  id?: number
  parentId: number | null
  position: string
  groupName: string
  label: string
  url: string
  icon: string
  target: string
  visibility: string
  isActive: boolean
}

const emptyForm = (position: string): MenuForm => ({
  parentId: null,
  position,
  groupName: '',
  label: '',
  url: '',
  icon: '',
  target: '_self',
  visibility: 'all',
  isActive: true,
})

export default function MenusAdminPage() {
  const [activeTab, setActiveTab] = useState<'header' | 'footer'>('header')
  const [headerMenus, setHeaderMenus] = useState<MenuItem[]>([])
  const [footerMenus, setFooterMenus] = useState<MenuItem[]>([])
  const [editingForm, setEditingForm] = useState<MenuForm | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fetchMenus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/menus')
      if (res.ok) {
        const data = await res.json()
        setHeaderMenus(data.header || [])
        setFooterMenus(data.footer || [])
      }
    } catch (error) {
      console.error('메뉴 조회 에러:', error)
    }
  }, [])

  useEffect(() => {
    fetchMenus()
  }, [fetchMenus])

  const currentMenus = activeTab === 'header' ? headerMenus : footerMenus

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleCreate = async () => {
    if (!editingForm || !editingForm.label || !editingForm.url) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingForm),
      })
      if (res.ok) {
        showMessage('메뉴가 생성되었습니다.')
        setEditingForm(null)
        setIsCreating(false)
        await fetchMenus()
      } else {
        showMessage('생성 실패')
      }
    } catch {
      showMessage('서버 오류')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingForm?.id || !editingForm.label || !editingForm.url) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/menus/${editingForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingForm),
      })
      if (res.ok) {
        showMessage('메뉴가 수정되었습니다.')
        setEditingForm(null)
        await fetchMenus()
      } else {
        showMessage('수정 실패')
      }
    } catch {
      showMessage('서버 오류')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('이 메뉴를 삭제하시겠습니까? 하위 메뉴도 함께 삭제됩니다.')) return
    try {
      const res = await fetch(`/api/admin/menus/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showMessage('메뉴가 삭제되었습니다.')
        await fetchMenus()
      }
    } catch {
      showMessage('삭제 실패')
    }
  }

  const handleMoveUp = async (menu: MenuItem, list: MenuItem[]) => {
    const idx = list.findIndex(m => m.id === menu.id)
    if (idx <= 0) return
    const items = list.map((m, i) => ({
      id: m.id,
      sortOrder: i === idx ? list[idx - 1].sortOrder : i === idx - 1 ? list[idx].sortOrder : m.sortOrder,
      parentId: m.parentId,
    }))
    await fetch('/api/admin/menus/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    await fetchMenus()
  }

  const handleMoveDown = async (menu: MenuItem, list: MenuItem[]) => {
    const idx = list.findIndex(m => m.id === menu.id)
    if (idx >= list.length - 1) return
    const items = list.map((m, i) => ({
      id: m.id,
      sortOrder: i === idx ? list[idx + 1].sortOrder : i === idx + 1 ? list[idx].sortOrder : m.sortOrder,
      parentId: m.parentId,
    }))
    await fetch('/api/admin/menus/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    await fetchMenus()
  }

  const handleIndent = async (menu: MenuItem, list: MenuItem[]) => {
    // Make this menu a child of the previous sibling
    const idx = list.findIndex(m => m.id === menu.id)
    if (idx <= 0) return
    const newParentId = list[idx - 1].id
    await fetch(`/api/admin/menus/${menu.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: newParentId }),
    })
    await fetchMenus()
  }

  const handleOutdent = async (menu: MenuItem) => {
    // Move from child to top level
    if (!menu.parentId) return
    await fetch(`/api/admin/menus/${menu.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: null }),
    })
    await fetchMenus()
  }

  const handleSeed = async () => {
    if (!confirm('초기 메뉴 데이터를 생성하시겠습니까? 이미 데이터가 있으면 무시됩니다.')) return
    try {
      const res = await fetch('/api/admin/menus/seed', { method: 'POST' })
      const data = await res.json()
      showMessage(data.message || '시드 완료')
      await fetchMenus()
    } catch {
      showMessage('시드 실패')
    }
  }

  const renderMenuItem = (menu: MenuItem, list: MenuItem[], depth: number = 0) => (
    <div key={menu.id}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 ${depth > 0 ? 'ml-8 border-l' : ''}`}>
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {menu.icon && <span className="text-sm">{menu.icon}</span>}
            <span className="text-sm font-medium truncate">{menu.label}</span>
            <span className="text-xs text-muted-foreground truncate">{menu.url}</span>
            {menu.groupName && <Badge variant="outline" className="text-xs">{menu.groupName}</Badge>}
            {!menu.isActive && <Badge variant="secondary" className="text-xs">비활성</Badge>}
            {menu.visibility !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {menu.visibility === 'member' ? '회원' : '관리자'}
              </Badge>
            )}
            {menu.target === '_blank' && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveUp(menu, list)} title="위로">
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveDown(menu, list)} title="아래로">
            <ChevronDown className="h-4 w-4" />
          </Button>
          {depth === 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleIndent(menu, list)} title="하위 메뉴로">
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {depth > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOutdent(menu)} title="상위로">
              <ChevronRight className="h-4 w-4 rotate-180" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setIsCreating(false)
              setEditingForm({
                id: menu.id,
                parentId: menu.parentId,
                position: menu.position,
                groupName: menu.groupName || '',
                label: menu.label,
                url: menu.url,
                icon: menu.icon || '',
                target: menu.target,
                visibility: menu.visibility,
                isActive: menu.isActive,
              })
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(menu.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Render children */}
      {menu.children && menu.children.length > 0 && (
        <div>
          {menu.children.map(child => renderMenuItem(child, menu.children, depth + 1))}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">메뉴관리</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSeed}>
                초기 데이터 생성
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsCreating(true)
                  setEditingForm(emptyForm(activeTab))
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                메뉴 추가
              </Button>
            </div>
          </div>

          {message && (
            <div className="mb-4 px-4 py-2 bg-primary/10 text-primary rounded-md text-sm">
              {message}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={activeTab === 'header' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setActiveTab('header'); setEditingForm(null); setIsCreating(false) }}
            >
              Header 메뉴
            </Button>
            <Button
              variant={activeTab === 'footer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setActiveTab('footer'); setEditingForm(null); setIsCreating(false) }}
            >
              Footer 메뉴
            </Button>
          </div>

          {/* Edit/Create Form */}
          {editingForm && (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  {isCreating ? '새 메뉴 추가' : '메뉴 수정'}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingForm(null); setIsCreating(false) }}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">라벨 *</label>
                    <Input
                      value={editingForm.label}
                      onChange={(e) => setEditingForm({ ...editingForm, label: e.target.value })}
                      placeholder="메뉴 이름"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">URL *</label>
                    <Input
                      value={editingForm.url}
                      onChange={(e) => setEditingForm({ ...editingForm, url: e.target.value })}
                      placeholder="/path"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">아이콘</label>
                    <Input
                      value={editingForm.icon}
                      onChange={(e) => setEditingForm({ ...editingForm, icon: e.target.value })}
                      placeholder="이모지 또는 아이콘명"
                    />
                  </div>
                  {activeTab === 'footer' && (
                    <div>
                      <label className="text-sm font-medium">그룹명</label>
                      <Input
                        value={editingForm.groupName}
                        onChange={(e) => setEditingForm({ ...editingForm, groupName: e.target.value })}
                        placeholder="커뮤니티, 정보, 정책"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">타겟</label>
                    <select
                      className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                      value={editingForm.target}
                      onChange={(e) => setEditingForm({ ...editingForm, target: e.target.value })}
                    >
                      <option value="_self">현재 창</option>
                      <option value="_blank">새 창</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">공개 범위</label>
                    <select
                      className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                      value={editingForm.visibility}
                      onChange={(e) => setEditingForm({ ...editingForm, visibility: e.target.value })}
                    >
                      <option value="all">전체</option>
                      <option value="member">회원만</option>
                      <option value="admin">관리자만</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingForm.isActive}
                        onChange={(e) => setEditingForm({ ...editingForm, isActive: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">활성화</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    onClick={isCreating ? handleCreate : handleUpdate}
                    disabled={saving || !editingForm.label || !editingForm.url}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? '저장 중...' : isCreating ? '추가' : '저장'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingForm(null); setIsCreating(false) }}>
                    취소
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Menu List */}
          <Card>
            <CardContent className="p-0">
              {currentMenus.length > 0 ? (
                <div>
                  {currentMenus.map(menu => renderMenuItem(menu, currentMenus))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <p>등록된 메뉴가 없습니다.</p>
                  <p className="text-sm mt-1">&quot;초기 데이터 생성&quot; 버튼을 클릭하여 기본 메뉴를 생성하세요.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
