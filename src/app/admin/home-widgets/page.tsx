"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Save, Eye, EyeOff, Settings, X, ChevronUp, ChevronDown, Plus
} from "lucide-react"

interface WidgetData {
  id: number
  widgetKey: string
  zone: string
  title: string
  settings: string | null
  colSpan: number
  rowSpan: number
  isActive: boolean
  sortOrder: number
  pluginFolder: string | null
  pluginEnabled: boolean
  pluginName: string | null
}

interface WidgetSettingsField {
  type: string
  label: string
  default: unknown
}

// Must match registry.ts
const WIDGET_META: Record<string, { label: string; description: string; settingsSchema: Record<string, WidgetSettingsField> | null }> = {
  'welcome-banner': { label: '환영 배너', description: '로그인 사용자 환영 메시지와 CTA 버튼', settingsSchema: null },
  'site-stats': { label: '사이트 통계', description: '회원, 게시글, 댓글, 게시판 통계 카드', settingsSchema: null },
  'latest-posts': { label: '최근 게시글', description: '최근 게시글 목록', settingsSchema: { limit: { type: 'number', label: '표시 개수', default: 6 } } },
  'popular-boards': { label: '인기 게시판', description: '인기 게시판 랭킹', settingsSchema: { limit: { type: 'number', label: '표시 개수', default: 5 } } },
  'shop-shortcut': { label: '쇼핑몰 바로가기', description: '쇼핑몰 링크 카드', settingsSchema: null },
  'auction-live': { label: '진행중 경매', description: '진행중인 경매 목록', settingsSchema: { limit: { type: 'number', label: '표시 개수', default: 4 } } },
  'community-guide': { label: '커뮤니티 가이드', description: '커뮤니티 이용 가이드', settingsSchema: null },
  'board-cards': { label: '게시판 카드', description: '게시판 카드 그리드', settingsSchema: { limit: { type: 'number', label: '표시 개수', default: 4 } } },
}

const ZONES = ['hero', 'main', 'sidebar', 'bottom'] as const
const ZONE_LABELS: Record<string, string> = {
  hero: 'Hero (상단 배너)',
  main: 'Main (좌측 메인)',
  sidebar: 'Sidebar (우측)',
  bottom: 'Bottom (하단)',
}

export default function HomeWidgetsAdminPage() {
  const [widgets, setWidgets] = useState<WidgetData[]>([])
  const [unregistered, setUnregistered] = useState<string[]>([])
  const [selectedWidget, setSelectedWidget] = useState<WidgetData | null>(null)
  const [editSettings, setEditSettings] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fetchWidgets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/home-widgets')
      if (res.ok) {
        const data = await res.json()
        setWidgets(data.widgets || [])
        setUnregistered(data.unregistered || [])
      }
    } catch (error) {
      console.error('위젯 조회 에러:', error)
    }
  }, [])

  useEffect(() => {
    fetchWidgets()
  }, [fetchWidgets])

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const getWidgetsByZone = (zone: string) =>
    widgets.filter(w => w.zone === zone).sort((a, b) => a.sortOrder - b.sortOrder)

  const handleToggleActive = async (widget: WidgetData) => {
    try {
      await fetch(`/api/admin/home-widgets/${widget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !widget.isActive }),
      })
      await fetchWidgets()
    } catch {
      showMessage('변경 실패')
    }
  }

  const handleMoveUp = async (widget: WidgetData, zoneWidgets: WidgetData[]) => {
    const idx = zoneWidgets.findIndex(w => w.id === widget.id)
    if (idx <= 0) return
    const items = zoneWidgets.map((w, i) => ({
      id: w.id,
      zone: w.zone,
      sortOrder: i === idx ? zoneWidgets[idx - 1].sortOrder : i === idx - 1 ? zoneWidgets[idx].sortOrder : w.sortOrder,
    }))
    await fetch('/api/admin/home-widgets/layout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    await fetchWidgets()
  }

  const handleMoveDown = async (widget: WidgetData, zoneWidgets: WidgetData[]) => {
    const idx = zoneWidgets.findIndex(w => w.id === widget.id)
    if (idx >= zoneWidgets.length - 1) return
    const items = zoneWidgets.map((w, i) => ({
      id: w.id,
      zone: w.zone,
      sortOrder: i === idx ? zoneWidgets[idx + 1].sortOrder : i === idx + 1 ? zoneWidgets[idx].sortOrder : w.sortOrder,
    }))
    await fetch('/api/admin/home-widgets/layout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    await fetchWidgets()
  }

  const handleChangeZone = async (widget: WidgetData, newZone: string) => {
    try {
      await fetch(`/api/admin/home-widgets/${widget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: newZone, sortOrder: 99 }),
      })
      await fetchWidgets()
    } catch {
      showMessage('영역 변경 실패')
    }
  }

  const handleSelectWidget = (widget: WidgetData) => {
    setSelectedWidget(widget)
    try {
      setEditSettings(widget.settings ? JSON.parse(widget.settings) : {})
    } catch {
      setEditSettings({})
    }
  }

  const handleSaveSettings = async () => {
    if (!selectedWidget) return
    setSaving(true)
    try {
      await fetch(`/api/admin/home-widgets/${selectedWidget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: JSON.stringify(editSettings),
          colSpan: selectedWidget.colSpan,
          rowSpan: selectedWidget.rowSpan,
        }),
      })
      showMessage('설정이 저장되었습니다.')
      await fetchWidgets()
    } catch {
      showMessage('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateWidget = async (widgetKey: string) => {
    const meta = WIDGET_META[widgetKey]
    if (!meta) return
    try {
      // We need to create the widget in DB via a special approach
      // Since we don't have a dedicated create endpoint for widgets,
      // let's add it through the seed mechanism or directly
      const res = await fetch('/api/admin/home-widgets/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [], // Empty - just trigger
          create: { widgetKey, zone: 'bottom', title: meta.label },
        }),
      })
      if (!res.ok) {
        // Fallback: create via the individual endpoint won't work since no ID
        showMessage('위젯을 생성하려면 시드를 실행해주세요.')
      }
      await fetchWidgets()
    } catch {
      showMessage('위젯 생성 실패')
    }
  }

  const renderWidgetCard = (widget: WidgetData, zoneWidgets: WidgetData[]) => {
    const meta = WIDGET_META[widget.widgetKey]
    const isPluginDisabled = widget.pluginFolder && !widget.pluginEnabled
    return (
      <div
        key={widget.id}
        className={`flex items-center gap-2 px-3 py-2 border rounded-md mb-2 transition-colors ${
          isPluginDisabled
            ? 'opacity-50 bg-muted/30 cursor-not-allowed'
            : `cursor-pointer hover:bg-muted/50 ${selectedWidget?.id === widget.id ? 'border-primary bg-primary/5' : ''}`
        } ${!widget.isActive && !isPluginDisabled ? 'opacity-50' : ''}`}
        onClick={() => !isPluginDisabled && handleSelectWidget(widget)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{widget.title}</span>
            {isPluginDisabled ? (
              <Badge variant="destructive" className="text-xs">
                {widget.pluginName} 플러그인 비활성
              </Badge>
            ) : (
              meta && <span className="text-xs text-muted-foreground">{meta.description}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">{widget.colSpan}x{widget.rowSpan}</Badge>
            {!isPluginDisabled && (
              <select
                className="text-xs border rounded px-1 py-0.5 bg-background"
                value={widget.zone}
                onChange={(e) => { e.stopPropagation(); handleChangeZone(widget, e.target.value) }}
                onClick={(e) => e.stopPropagation()}
              >
                {ZONES.map(z => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
              </select>
            )}
          </div>
        </div>
        {!isPluginDisabled && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveUp(widget, zoneWidgets)}>
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveDown(widget, zoneWidgets)}>
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(widget)}>
              {widget.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">홈화면관리</h1>
          </div>

          {message && (
            <div className="mb-4 px-4 py-2 bg-primary/10 text-primary rounded-md text-sm">
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Zone layout */}
            <div className="lg:col-span-2 space-y-4">
              {ZONES.map(zone => {
                const zoneWidgets = getWidgetsByZone(zone)
                return (
                  <Card key={zone}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        {ZONE_LABELS[zone]}
                        <Badge variant="secondary">{zoneWidgets.length}개</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {zoneWidgets.length > 0 ? (
                        zoneWidgets.map(w => renderWidgetCard(w, zoneWidgets))
                      ) : (
                        <div className="py-4 text-center text-muted-foreground text-sm">
                          이 영역에 위젯이 없습니다.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}

              {/* Unregistered widgets */}
              {unregistered.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">미배치 위젯</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {unregistered.map(key => {
                        const meta = WIDGET_META[key]
                        return (
                          <div key={key} className="flex items-center justify-between px-3 py-2 border rounded-md">
                            <div>
                              <span className="text-sm font-medium">{meta?.label || key}</span>
                              <span className="text-xs text-muted-foreground ml-2">{meta?.description}</span>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleCreateWidget(key)}>
                              <Plus className="h-4 w-4 mr-1" />
                              배치
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: Widget settings panel */}
            <div>
              {selectedWidget ? (
                <Card className="sticky top-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        위젯 설정
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedWidget(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">위젯</label>
                      <p className="text-sm text-muted-foreground">{selectedWidget.title} ({selectedWidget.widgetKey})</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">열 너비 (colSpan)</label>
                        <Input
                          type="number"
                          min={1}
                          max={4}
                          value={selectedWidget.colSpan}
                          onChange={(e) => setSelectedWidget({ ...selectedWidget, colSpan: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">행 높이 (rowSpan)</label>
                        <Input
                          type="number"
                          min={1}
                          max={4}
                          value={selectedWidget.rowSpan}
                          onChange={(e) => setSelectedWidget({ ...selectedWidget, rowSpan: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>

                    {/* Settings schema-based form */}
                    {(() => {
                      const meta = WIDGET_META[selectedWidget.widgetKey]
                      if (!meta?.settingsSchema) return null
                      return (
                        <div className="space-y-3">
                          <label className="text-sm font-medium">위젯 옵션</label>
                          {Object.entries(meta.settingsSchema).map(([key, schema]) => (
                            <div key={key}>
                              <label className="text-xs text-muted-foreground">{schema.label}</label>
                              {schema.type === 'number' ? (
                                <Input
                                  type="number"
                                  value={(editSettings[key] as number) ?? schema.default}
                                  onChange={(e) => setEditSettings({ ...editSettings, [key]: parseInt(e.target.value) || schema.default })}
                                />
                              ) : (
                                <Input
                                  value={(editSettings[key] as string) ?? ''}
                                  onChange={(e) => setEditSettings({ ...editSettings, [key]: e.target.value })}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
                      <Save className="h-4 w-4 mr-1" />
                      {saving ? '저장 중...' : '설정 저장'}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">위젯을 선택하면 설정을 변경할 수 있습니다.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
