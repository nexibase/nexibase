"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Save, Eye, EyeOff, ChevronUp, ChevronDown, Plus, Trash2
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

interface WidgetMetadata {
  label: string
  description: string
  defaultZone: string
  defaultColSpan: number
  defaultRowSpan: number
  settingsSchema: Record<string, unknown> | null
}

// "feature1_title" → "Feature1 title"
function humanizeKey(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const ZONES = ['top', 'center', 'bottom'] as const
const ZONE_LABELS: Record<string, string> = {
  top: '상단 영역',
  center: '중앙 영역',
  bottom: '하단 영역',
}

// 레이아웃 사이드바 영역 (레이아웃 설정에서 관리)
const LAYOUT_ZONES = ['left', 'right'] as const
const LAYOUT_ZONE_LABELS: Record<string, string> = {
  left: '좌측 사이드바',
  right: '우측 사이드바',
}

export default function HomeWidgetsAdminPage() {
  const [widgets, setWidgets] = useState<WidgetData[]>([])
  const [unregistered, setUnregistered] = useState<string[]>([])
  const [widgetMeta, setWidgetMeta] = useState<Record<string, WidgetMetadata>>({})
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
        setWidgetMeta(data.metadata || {})
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

  const handleRemoveWidget = async (widget: WidgetData) => {
    try {
      await fetch(`/api/admin/home-widgets/${widget.id}`, { method: 'DELETE' })
      showMessage('위젯이 배치 해제되었습니다.')
      setSelectedWidget(null)
      await fetchWidgets()
    } catch {
      showMessage('배치 해제 실패')
    }
  }

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
    const reordered = [...zoneWidgets]
    ;[reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]]
    const items = reordered.map((w, i) => ({ id: w.id, zone: w.zone, sortOrder: i }))
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
    const reordered = [...zoneWidgets]
    ;[reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]]
    const items = reordered.map((w, i) => ({ id: w.id, zone: w.zone, sortOrder: i }))
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
      setSelectedWidget(null)
      await fetchWidgets()
    } catch {
      showMessage('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('모든 위젯을 삭제하고 기본 배치로 초기화하시겠습니까?')) return
    try {
      await fetch('/api/admin/home-widgets/reset', { method: 'POST' })
      showMessage('초기화 완료')
      setSelectedWidget(null)
      await fetchWidgets()
    } catch {
      showMessage('초기화 실패')
    }
  }

  const handleCreateWidget = async (widgetKey: string, zone: string = 'main') => {
    const meta = widgetMeta[widgetKey]
    if (!meta) return
    try {
      await fetch('/api/admin/home-widgets/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [],
          create: { widgetKey, zone, title: meta.label },
        }),
      })
      showMessage(`${meta.label} 위젯이 ${zone} 영역에 배치되었습니다.`)
      await fetchWidgets()
    } catch {
      showMessage('위젯 배치 실패')
    }
  }

  const renderWidgetCard = (widget: WidgetData, zoneWidgets: WidgetData[]) => {
    const meta = widgetMeta[widget.widgetKey]
    const isPluginDisabled = widget.pluginFolder && !widget.pluginEnabled
    return (
      <div
        key={widget.id}
        className={`px-3 py-2 border rounded-md mb-2 transition-colors ${
          isPluginDisabled
            ? 'opacity-50 bg-muted/30 cursor-not-allowed'
            : `cursor-pointer hover:bg-muted/50 ${selectedWidget?.id === widget.id ? 'border-primary bg-primary/5' : ''}`
        } ${!widget.isActive && !isPluginDisabled ? 'opacity-50' : ''}`}
        onClick={() => !isPluginDisabled && handleSelectWidget(widget)}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{widget.title}</span>
          {isPluginDisabled ? (
            <Badge variant="destructive" className="text-xs shrink-0">비활성</Badge>
          ) : (
            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveUp(widget, zoneWidgets)}>
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveDown(widget, zoneWidgets)}>
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleToggleActive(widget)}>
                {widget.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleRemoveWidget(widget)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {!isPluginDisabled && (
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">{widget.colSpan}x{widget.rowSpan}</Badge>
            <select
              className="text-xs border rounded px-1 py-0.5 bg-background"
              value={widget.zone}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); handleChangeZone(widget, e.target.value) }}
            >
              {ZONES.map(z => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
              <option disabled>──────</option>
              {LAYOUT_ZONES.map(z => <option key={z} value={z}>{LAYOUT_ZONE_LABELS[z]}</option>)}
            </select>
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
            <Button variant="outline" size="sm" onClick={handleReset}>
              초기화
            </Button>
          </div>

          {message && (
            <div className="mb-4 px-4 py-2 bg-primary/10 text-primary rounded-md text-sm">
              {message}
            </div>
          )}

          {/* 위젯 설정 모달 */}
          <Dialog open={!!selectedWidget} onOpenChange={(open) => !open && setSelectedWidget(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{selectedWidget?.title} 설정</DialogTitle>
              </DialogHeader>
              {selectedWidget && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">열 너비 (1~12)</label>
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={selectedWidget.colSpan}
                        onChange={(e) => setSelectedWidget({ ...selectedWidget, colSpan: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">행 높이</label>
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={selectedWidget.rowSpan}
                        onChange={(e) => setSelectedWidget({ ...selectedWidget, rowSpan: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>
                  {(() => {
                    const meta = widgetMeta[selectedWidget.widgetKey]
                    if (!meta?.settingsSchema) return null
                    return (
                      <div className="space-y-3">
                        {Object.entries(meta.settingsSchema).map(([key, defaultValue]) => {
                          const isNumber = typeof defaultValue === 'number'
                          return (
                            <div key={key}>
                              <label className="text-sm font-medium">{humanizeKey(key)}</label>
                              {isNumber ? (
                                <Input
                                  type="number"
                                  value={(editSettings[key] as number) ?? (defaultValue as number)}
                                  onChange={(e) => setEditSettings({ ...editSettings, [key]: parseInt(e.target.value) || (defaultValue as number) })}
                                />
                              ) : (
                                <Input
                                  value={(editSettings[key] as string) ?? (defaultValue as string) ?? ''}
                                  onChange={(e) => setEditSettings({ ...editSettings, [key]: e.target.value })}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                  <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? '저장 중...' : '저장'}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* 홈 위젯 영역 */}
          <div className="space-y-4">
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
                    {zoneWidgets.length > 0 ? zoneWidgets.map(w => renderWidgetCard(w, zoneWidgets)) : (
                      <div className="py-3 text-center text-muted-foreground text-sm">위젯 없음</div>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {/* 레이아웃 사이드바 (모든 페이지에 적용) */}
            <div className="border-t pt-4 mt-4">
              <h2 className="text-lg font-bold mb-3">레이아웃 사이드바 <span className="text-sm font-normal text-muted-foreground">— 모든 페이지에 적용</span></h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {LAYOUT_ZONES.map(zone => {
                  const zoneWidgets = getWidgetsByZone(zone)
                  return (
                    <Card key={zone}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          {LAYOUT_ZONE_LABELS[zone]}
                          <Badge variant="secondary">{zoneWidgets.length}개</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {zoneWidgets.length > 0 ? zoneWidgets.map(w => renderWidgetCard(w, zoneWidgets)) : (
                          <div className="py-3 text-center text-muted-foreground text-sm">위젯 없음</div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* 미배치 위젯 */}
            {unregistered.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">미배치 위젯</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {unregistered.map(key => {
                      const meta = widgetMeta[key]
                      return (
                        <div key={key} className="flex items-center justify-between px-3 py-2 border rounded-md">
                          <div>
                            <span className="text-sm font-medium">{meta?.label || key}</span>
                            <span className="text-xs text-muted-foreground ml-2">{meta?.description}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <select
                              id={`zone-${key}`}
                              className="text-xs border rounded px-1 py-1 bg-background"
                              defaultValue="main"
                            >
                              {ZONES.map(z => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
                              <option disabled>──────</option>
                              {LAYOUT_ZONES.map(z => <option key={z} value={z}>{LAYOUT_ZONE_LABELS[z]}</option>)}
                            </select>
                            <Button size="sm" variant="outline" onClick={() => {
                              const select = document.getElementById(`zone-${key}`) as HTMLSelectElement
                              handleCreateWidget(key, select?.value || 'main')
                            }}>
                              <Plus className="h-4 w-4 mr-1" />
                              배치
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
