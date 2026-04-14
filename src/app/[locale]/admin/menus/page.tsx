"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronUp, ChevronDown, ChevronRight, Plus, Trash2, Save, Eye, EyeOff, ExternalLink, Pencil, X, GripVertical
} from "lucide-react"
import { LocaleTabs } from "@/components/admin/LocaleTabs"
import { LocaleField } from "@/components/admin/LocaleField"
import { routing } from "@/i18n/routing"

interface MenuTranslationRow {
  locale: string
  label: string
  source: 'auto' | 'manual'
}

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
  pluginFolder: string | null
  pluginEnabled: boolean
  pluginName: string | null
  translations?: MenuTranslationRow[]
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
  const t = useTranslations('admin')
  const [activeTab, setActiveTab] = useState<'header' | 'footer'>('header')
  const [headerMenus, setHeaderMenus] = useState<MenuItem[]>([])
  const [footerMenus, setFooterMenus] = useState<MenuItem[]>([])
  const [editingForm, setEditingForm] = useState<MenuForm | null>(null)
  const [translations, setTranslations] = useState<Record<string, { label: string; source: 'auto' | 'manual' | 'missing' }>>({})
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
      const manualTranslations = Object.fromEntries(
        Object.entries(translations)
          .filter(([, v]) => v.source === 'manual' && v.label)
          .map(([loc, v]) => [loc, { label: v.label }])
      )
      const res = await fetch('/api/admin/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingForm,
          translations: Object.keys(manualTranslations).length > 0 ? manualTranslations : undefined,
        }),
      })
      if (res.ok) {
        showMessage(t('menuCreated'))
        setEditingForm(null)
        setIsCreating(false)
        setTranslations({})
        await fetchMenus()
      } else {
        showMessage(t('createFailed'))
      }
    } catch {
      showMessage(t('serverError'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingForm?.id || !editingForm.label || !editingForm.url) return
    setSaving(true)
    try {
      const manualTranslations = Object.fromEntries(
        Object.entries(translations)
          .filter(([, v]) => v.source === 'manual' && v.label)
          .map(([loc, v]) => [loc, { label: v.label }])
      )
      const res = await fetch(`/api/admin/menus/${editingForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingForm,
          translations: Object.keys(manualTranslations).length > 0 ? manualTranslations : undefined,
        }),
      })
      if (res.ok) {
        showMessage(t('menuUpdated'))
        setEditingForm(null)
        setTranslations({})
        await fetchMenus()
      } else {
        showMessage(t('updateFailed'))
      }
    } catch {
      showMessage(t('serverError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('confirmDeleteMenu'))) return
    try {
      const res = await fetch(`/api/admin/menus/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showMessage(t('menuDeleted'))
        await fetchMenus()
      }
    } catch {
      showMessage(t('deleteFailed'))
    }
  }

  const handleToggleActive = async (menu: MenuItem) => {
    try {
      await fetch(`/api/admin/menus/${menu.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !menu.isActive }),
      })
      await fetchMenus()
    } catch {
      showMessage(t('changeFailed'))
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
    if (!confirm(t('confirmSeedMenu'))) return
    try {
      const res = await fetch('/api/admin/menus/seed', { method: 'POST' })
      const data = await res.json()
      showMessage(data.message || t('seedDoneMsg'))
      await fetchMenus()
    } catch {
      showMessage(t('seedFailedMsg'))
    }
  }

  const renderMenuItem = (menu: MenuItem, list: MenuItem[], depth: number = 0) => {
    const isPluginDisabled = menu.pluginFolder && !menu.pluginEnabled
    return (
      <div key={menu.id}>
        <div className={`flex items-center gap-2 px-3 py-2 border-b ${
          isPluginDisabled
            ? 'opacity-50 bg-muted/30'
            : 'hover:bg-muted/50'
        } ${depth > 0 ? 'ml-8 border-l' : ''}`}>
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {menu.icon && <span className="text-sm">{menu.icon}</span>}
              <span className="text-sm font-medium truncate">{menu.label}</span>
              <span className="text-xs text-muted-foreground truncate">{menu.url}</span>
              {menu.groupName && <Badge variant="outline" className="text-xs">{menu.groupName}</Badge>}
              {isPluginDisabled && (
                <Badge variant="destructive" className="text-xs">
                  {t('pluginDisabled', { name: menu.pluginName ?? '' })}
                </Badge>
              )}
              {!menu.isActive && !isPluginDisabled && <Badge variant="secondary" className="text-xs">{t('inactive')}</Badge>}
              {menu.visibility !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  {menu.visibility === 'member' ? t('memberOnly') : t('roleAdmin')}
                </Badge>
              )}
              {menu.target === '_blank' && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
            </div>
          </div>
          {!isPluginDisabled && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveUp(menu, list)} title={t('moveUp')}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveDown(menu, list)} title={t('moveDown')}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              {depth === 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleIndent(menu, list)} title={t('moveToChild')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {depth > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOutdent(menu)} title={t('moveToParent')}>
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
                  // Populate translations from existing data
                  const trMap: Record<string, { label: string; source: 'auto' | 'manual' | 'missing' }> = {}
                  if (Array.isArray(menu.translations)) {
                    for (const row of menu.translations) {
                      trMap[row.locale] = { label: row.label, source: row.source }
                    }
                  }
                  setTranslations(trMap)
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(menu)} title={menu.isActive ? t('hide') : t('show')}>
                {menu.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(menu.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {/* Render children */}
        {menu.children && menu.children.length > 0 && (
          <div>
            {menu.children.map(child => renderMenuItem(child, menu.children, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">{t('menusTitle')}</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSeed}>
                {t('seedInitData')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsCreating(true)
                  setEditingForm(emptyForm(activeTab))
                  setTranslations({})
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('menuAdd')}
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
              onClick={() => { setActiveTab('header'); setEditingForm(null); setIsCreating(false); setTranslations({}) }}
            >
              {t('headerMenu')}
            </Button>
            <Button
              variant={activeTab === 'footer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setActiveTab('footer'); setEditingForm(null); setIsCreating(false); setTranslations({}) }}
            >
              {t('footerMenu')}
            </Button>
          </div>

          {/* Edit/Create Form */}
          {editingForm && (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  {isCreating ? t('newMenu') : t('editMenu')}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingForm(null); setIsCreating(false); setTranslations({}) }}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <LocaleTabs
                      getStatus={(locale) => locale === routing.defaultLocale ? undefined : translations[locale]?.source ?? 'missing'}
                      renderTab={(locale, isDefault) => {
                        if (isDefault) {
                          return (
                            <LocaleField label={t('menuLabel')} isDefaultLocale>
                              <Input
                                value={editingForm.label}
                                onChange={(e) => setEditingForm({ ...editingForm, label: e.target.value })}
                                placeholder={t('menuName')}
                              />
                            </LocaleField>
                          )
                        }
                        const tr = translations[locale] ?? { label: '', source: 'missing' as const }
                        return (
                          <LocaleField
                            label={t('menuLabel')}
                            isDefaultLocale={false}
                            subLocaleHint="비워두면 영문 원본이 노출됩니다. 수정하면 수동 번역으로 전환됩니다."
                          >
                            <Input
                              value={tr.label}
                              onChange={(e) => setTranslations({
                                ...translations,
                                [locale]: { label: e.target.value, source: 'manual' },
                              })}
                              placeholder={t('menuName')}
                            />
                          </LocaleField>
                        )
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('menuUrl')}</label>
                    <Input
                      value={editingForm.url}
                      onChange={(e) => setEditingForm({ ...editingForm, url: e.target.value })}
                      placeholder="/path"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('menuIcon')}</label>
                    <Input
                      value={editingForm.icon}
                      onChange={(e) => setEditingForm({ ...editingForm, icon: e.target.value })}
                      placeholder={t('menuIconPlaceholder')}
                    />
                  </div>
                  {activeTab === 'footer' && (
                    <div>
                      <label className="text-sm font-medium">{t('groupName')}</label>
                      <Input
                        value={editingForm.groupName}
                        onChange={(e) => setEditingForm({ ...editingForm, groupName: e.target.value })}
                        placeholder={t('groupNamePlaceholder')}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">{t('menuTarget')}</label>
                    <select
                      className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                      value={editingForm.target}
                      onChange={(e) => setEditingForm({ ...editingForm, target: e.target.value })}
                    >
                      <option value="_self">{t('currentWindow')}</option>
                      <option value="_blank">{t('newWindow')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('visibility')}</label>
                    <select
                      className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                      value={editingForm.visibility}
                      onChange={(e) => setEditingForm({ ...editingForm, visibility: e.target.value })}
                    >
                      <option value="all">{t('all')}</option>
                      <option value="member">{t('visibilityMemberOnly')}</option>
                      <option value="admin">{t('visibilityAdminOnly')}</option>
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
                      <span className="text-sm">{t('activate')}</span>
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
                    {saving ? t('savingText') : isCreating ? t('addBtn') : t('saveBtn')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingForm(null); setIsCreating(false); setTranslations({}) }}>
                    {t('cancelBtn')}
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
                  <p>{t('noMenus')}</p>
                  <p className="text-sm mt-1">{t('noMenusHint')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
