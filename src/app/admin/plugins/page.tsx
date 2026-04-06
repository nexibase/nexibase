"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Puzzle, ExternalLink, Save, AlertTriangle } from "lucide-react"

interface PluginInfo {
  folder: string
  name: string
  slug: string
  currentSlug: string
  version: string
  author: string
  authorDomain: string
  repository: string
  description: string
  defaultEnabled: boolean
  enabled: boolean
  hasRoutes: boolean
  hasApi: boolean
  hasAdmin: boolean
  hasWidgets: boolean
  hasMenus: boolean
}

export default function PluginsAdminPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [editingSlugs, setEditingSlugs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const fetchPlugins = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/plugins')
      if (res.ok) {
        const data = await res.json()
        setPlugins(data.plugins || [])
      }
    } catch (error) {
      console.error('플러그인 조회 에러:', error)
    }
  }, [])

  useEffect(() => {
    fetchPlugins()
  }, [fetchPlugins])

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleToggle = async (folder: string, enabled: boolean) => {
    setSaving(folder)
    try {
      const res = await fetch(`/api/admin/plugins/${folder}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (res.ok) {
        // If enabling, trigger activation to seed menus/widgets
        if (enabled) {
          await fetch(`/api/admin/plugins/${folder}/activate`, { method: 'POST' })
        }
        showMessage(`${enabled ? '활성화' : '비활성화'} 되었습니다.`)
        await fetchPlugins()
      } else {
        const data = await res.json()
        showMessage(data.error || '저장 실패')
      }
    } catch {
      showMessage('서버 오류')
    } finally {
      setSaving(null)
    }
  }

  const handleSlugSave = async (folder: string) => {
    const newSlug = editingSlugs[folder]
    if (!newSlug) return

    setSaving(folder)
    try {
      const res = await fetch(`/api/admin/plugins/${folder}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: newSlug }),
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('slug가 변경되었습니다. 서버를 재시작해야 적용됩니다.')
        setEditingSlugs(prev => { const n = { ...prev }; delete n[folder]; return n })
        await fetchPlugins()
      } else {
        showMessage(data.error || '저장 실패')
      }
    } catch {
      showMessage('서버 오류')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Puzzle className="h-6 w-6" />
                플러그인 관리
              </h1>
              <p className="text-muted-foreground mt-1">
                설치된 플러그인을 활성화/비활성화하고 URL을 변경합니다
              </p>
            </div>
          </div>

          {message && (
            <div className="mb-4 px-4 py-2 bg-primary/10 text-primary rounded-md text-sm">
              {message}
            </div>
          )}

          <div className="space-y-4">
            {plugins.map((plugin) => (
              <Card key={plugin.folder}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {plugin.name}
                        <Badge variant="outline" className="text-xs">v{plugin.version}</Badge>
                        {plugin.enabled ? (
                          <Badge className="text-xs bg-green-500">활성</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">비활성</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">{plugin.description}</CardDescription>
                    </div>
                    <Switch
                      checked={plugin.enabled}
                      onCheckedChange={(checked) => handleToggle(plugin.folder, checked)}
                      disabled={saving === plugin.folder}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">작성자:</span>{' '}
                      <span>{plugin.author}</span>
                      {plugin.authorDomain && (
                        <a href={plugin.authorDomain} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {plugin.repository && (
                      <div>
                        <span className="text-muted-foreground">저장소:</span>{' '}
                        <a href={plugin.repository} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          GitHub <ExternalLink className="h-3 w-3 inline" />
                        </a>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">기능:</span>{' '}
                      {plugin.hasRoutes && <Badge variant="outline" className="text-xs mr-1">페이지</Badge>}
                      {plugin.hasApi && <Badge variant="outline" className="text-xs mr-1">API</Badge>}
                      {plugin.hasAdmin && <Badge variant="outline" className="text-xs mr-1">관리자</Badge>}
                      {plugin.hasWidgets && <Badge variant="outline" className="text-xs mr-1">위젯</Badge>}
                      {plugin.hasMenus && <Badge variant="outline" className="text-xs mr-1">메뉴</Badge>}
                    </div>
                    <div>
                      <span className="text-muted-foreground">URL 경로:</span>{' '}
                      <code className="text-xs bg-muted px-1 rounded">/{plugin.currentSlug}</code>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">URL 경로 변경:</span>
                      <Input
                        className="w-48 h-8 text-sm"
                        value={editingSlugs[plugin.folder] ?? plugin.currentSlug}
                        onChange={(e) => setEditingSlugs(prev => ({ ...prev, [plugin.folder]: e.target.value }))}
                        placeholder={plugin.slug}
                      />
                      {editingSlugs[plugin.folder] && editingSlugs[plugin.folder] !== plugin.currentSlug && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSlugSave(plugin.folder)}
                          disabled={saving === plugin.folder}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          저장
                        </Button>
                      )}
                    </div>
                    {editingSlugs[plugin.folder] && editingSlugs[plugin.folder] !== plugin.currentSlug && (
                      <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        slug 변경 후 서버 재시작이 필요합니다
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {plugins.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                설치된 플러그인이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
