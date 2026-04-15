"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
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
  const t = useTranslations('admin')
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

  const handleToggle = async (plugin: PluginInfo, enabled: boolean) => {
    setSaving(plugin.folder)
    try {
      const res = await fetch(`/api/admin/plugins/${plugin.folder}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (res.ok) {
        if (enabled) {
          await fetch(`/api/admin/plugins/${plugin.folder}/activate`, { method: 'POST' })
        }
        showMessage(t('pluginEnabledToggle', { action: enabled ? t('actionEnable') : t('actionDisable') }))
        await fetchPlugins()
        window.dispatchEvent(new Event('pluginStatusChanged'))
      } else {
        const data = await res.json()
        showMessage(data.error || t('saveFailed'))
      }
    } catch {
      showMessage(t('serverError'))
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
        showMessage(t('pluginSlugSaved'))
        setEditingSlugs(prev => { const n = { ...prev }; delete n[folder]; return n })
        await fetchPlugins()
      } else {
        showMessage(data.error || t('saveFailed'))
      }
    } catch {
      showMessage(t('serverError'))
    } finally {
      setSaving(null)
    }
  }

  const translateMeta = (key: string, fallback: string) => {
    return t.has(key) ? t(key) : fallback
  }

  const renderPluginCard = (plugin: PluginInfo) => (
    <Card key={plugin.folder}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {translateMeta(`pluginMeta.${plugin.slug}Name`, plugin.name)}
              <Badge variant="outline" className="text-xs">v{plugin.version}</Badge>
              {plugin.enabled ? (
                <Badge className="text-xs bg-green-500">{t('statusActive')}</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">{t('inactive')}</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">{translateMeta(`pluginMeta.${plugin.slug}Description`, plugin.description)}</CardDescription>
          </div>
          <Switch
            checked={plugin.enabled}
            onCheckedChange={(checked) => handleToggle(plugin, checked)}
            disabled={saving === plugin.folder}
          />
        </div>
        {plugin.defaultEnabled && !plugin.enabled && (
          <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t('pluginDisableWarning')}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('pluginAuthor')}:</span>{' '}
            <span>{plugin.author}</span>
            {plugin.authorDomain && (
              <a href={plugin.authorDomain} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {plugin.repository && (
            <div>
              <span className="text-muted-foreground">{t('pluginRepo')}:</span>{' '}
              <a href={plugin.repository} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                GitHub <ExternalLink className="h-3 w-3 inline" />
              </a>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">{t('pluginFeatures')}:</span>{' '}
            {plugin.hasRoutes && <Badge variant="outline" className="text-xs mr-1">{t('pluginPages')}</Badge>}
            {plugin.hasApi && <Badge variant="outline" className="text-xs mr-1">{t('pluginApi')}</Badge>}
            {plugin.hasAdmin && <Badge variant="outline" className="text-xs mr-1">{t('pluginAdmin')}</Badge>}
            {plugin.hasWidgets && <Badge variant="outline" className="text-xs mr-1">{t('pluginWidgets')}</Badge>}
            {plugin.hasMenus && <Badge variant="outline" className="text-xs mr-1">{t('pluginMenus')}</Badge>}
          </div>
          <div>
            <span className="text-muted-foreground">{t('pluginUrlPath')}:</span>{' '}
            <code className="text-xs bg-muted px-1 rounded">/{plugin.currentSlug}</code>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('pluginUrlChange')}</span>
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
                {t('saveBtn')}
              </Button>
            )}
          </div>
          {editingSlugs[plugin.folder] && editingSlugs[plugin.folder] !== plugin.currentSlug && (
            <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t('pluginSlugWarning')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const defaultPlugins = plugins.filter(p => p.defaultEnabled)
  const extraPlugins = plugins.filter(p => !p.defaultEnabled)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Puzzle className="h-6 w-6" />
                {t('pluginsTitle')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('pluginsDesc')}
              </p>
            </div>
          </div>

          {message && (
            <div className="mb-4 px-4 py-2 bg-primary/10 text-primary rounded-md text-sm">
              {message}
            </div>
          )}

          <div className="space-y-6">
            {defaultPlugins.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">{t('pluginDefault')}</h2>
                <div className="space-y-4">
                  {defaultPlugins.map(renderPluginCard)}
                </div>
              </div>
            )}

            {extraPlugins.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">{t('pluginExtra')}</h2>
                <div className="space-y-4">
                  {extraPlugins.map(renderPluginCard)}
                </div>
              </div>
            )}

            {plugins.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                {t('noPlugins')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
