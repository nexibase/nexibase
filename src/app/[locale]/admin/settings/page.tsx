"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2,
  Save,
  Settings,
  Globe,
  Users,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  Palette,
  Upload,
  ImageIcon,
  BarChart3,
} from "lucide-react"
import { SUPPORTED_LOCALES } from "@/i18n/_generated-locales"

const LOCALE_LABELS: Record<string, string> = {
  ko: '한국어',
  en: 'English',
}

interface FooterLink {
  label: string
  url: string
}

interface SettingsData {
  // Site basics
  site_name: string
  site_locale: string
  site_description: string
  site_url: string
  site_keywords: string
  site_logo: string

  // Member settings
  signup_enabled: string
  email_verification_required: string

  // Footer settings
  footer_copyright: string
  footer_links: string

  // Layout settings
  layout_folder: string

  // Theme settings
  theme_folder: string

  // External services
  google_analytics_id: string
  ga4_property_id: string
  ga4_service_account_json: string

}

interface ThemeInfo {
  folder: string
  name: string
  description: string
  author: string
}

interface LayoutInfo {
  folder: string
  name: string
  files: { Header: boolean; HomePage: boolean; Footer: boolean }
}

const DEFAULT_SETTINGS: SettingsData = {
  site_name: 'NexiBase',
  site_locale: 'en',
  site_description: '',
  site_url: '',
  site_keywords: '',
  site_logo: '',
  signup_enabled: 'true',
  email_verification_required: 'false',
  footer_copyright: '',
  footer_links: '[]',
  layout_folder: 'default',
  theme_folder: 'default',
  google_analytics_id: '',
  ga4_property_id: '',
  ga4_service_account_json: ''
}

export default function SettingsPage() {
  const t = useTranslations('admin')
  const tMeta = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback)
  const themeName = (folder: string, fallback: string) => tMeta(`themeMeta.${folder}-name`, fallback)
  const themeDesc = (folder: string, fallback: string) => tMeta(`themeMeta.${folder}-description`, fallback)
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [hasSettings, setHasSettings] = useState(false)
  const [layouts, setLayouts] = useState<LayoutInfo[]>([])
  const [themes, setThemes] = useState<ThemeInfo[]>([])
  // Last site_locale seen from the server. Written by every successful
  // fetchSettings (initial mount and post-seed refetch), read by handleSave
  // to decide whether to reload after the locale changes.
  const localeOnLoadRef = useRef<string | null>(null)

  // Local state for the Google Analytics section
  const [gaJsonEditing, setGaJsonEditing] = useState(false)
  const [gaJsonDraft, setGaJsonDraft] = useState('')
  const [gaTestResult, setGaTestResult] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; propertyId: string; todayUsers: number }
    | { status: 'error'; message: string }
  >({ status: 'idle' })

  const handleGaFieldChange = (key: keyof SettingsData, value: string) => {
    handleChange(key, value)
    if (gaTestResult.status !== 'idle') {
      setGaTestResult({ status: 'idle' })
    }
  }

  const handleGaJsonEdit = () => {
    setGaJsonDraft(settings.ga4_service_account_json || '')
    setGaJsonEditing(true)
  }

  const handleGaJsonCancel = () => {
    setGaJsonEditing(false)
    setGaJsonDraft('')
  }

  const handleGaJsonApply = () => {
    handleGaFieldChange('ga4_service_account_json', gaJsonDraft)
    setGaJsonEditing(false)
    setGaJsonDraft('')
  }

  const handleGaTest = async () => {
    setGaTestResult({ status: 'loading' })
    try {
      const res = await fetch('/api/admin/analytics/test', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setGaTestResult({ status: 'success', propertyId: data.propertyId, todayUsers: data.todayUsers })
      } else {
        setGaTestResult({ status: 'error', message: data.error || t('gaUnknownError') })
      }
    } catch (err) {
      setGaTestResult({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  // Parse a JSON string into a FooterLink array
  const parseFooterLinks = (jsonStr: string): FooterLink[] => {
    try {
      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item.label && item.url)
      }
    } catch {
      // Return an empty array on parse failure
    }
    return []
  }

  // Load settings
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings')
      const data = await response.json()

      if (response.ok && data.settings) {
        const hasAny = Object.keys(data.settings).length > 0
        setHasSettings(hasAny)
        const newSettings = {
          ...DEFAULT_SETTINGS,
          ...data.settings
        }
        setSettings(newSettings)
        setFooterLinks(parseFooterLinks(newSettings.footer_links))
        localeOnLoadRef.current = newSettings.site_locale
      }
    } catch (error) {
      console.error('failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
    // Fetch available layouts
    fetch('/api/admin/layouts')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.layouts) setLayouts(data.layouts)
      })
      .catch(() => {})
    // Fetch available themes
    fetch('/api/admin/themes')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.themes) setThemes(data.themes)
      })
      .catch(() => {})
  }, [fetchSettings])

  // Save settings
  const handleSave = async () => {
    // Client-side validation
    if (!settings.site_name.trim()) {
      alert(t('siteNameRequired'))
      return
    }
    const urlValue = settings.site_url.trim()
    if (urlValue !== '' && !/^https?:\/\//i.test(urlValue)) {
      alert(t('siteUrlInvalid'))
      return
    }

    setSaving(true)
    try {
      // Serialize footerLinks to a JSON string before saving
      const settingsToSave = {
        ...settings,
        footer_links: JSON.stringify(footerLinks)
      }

      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToSave })
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        setHasSettings(true)
        setGaTestResult({ status: 'idle' })
        if (localeOnLoadRef.current !== null && settings.site_locale !== localeOnLoadRef.current) {
          window.location.reload()
          return
        }
      } else {
        if (data.error === 'site_name_required') {
          alert(t('siteNameRequired'))
          return
        }
        if (data.error === 'site_url_invalid') {
          alert(t('siteUrlInvalid'))
          return
        }
        alert(data.error || t('settingsSaveFailed'))
      }
    } catch (error) {
      console.error('failed to save settings:', error)
      alert(t('settingsSaveError'))
    } finally {
      setSaving(false)
    }
  }

  // Create default settings
  const handleSeed = async () => {
    if (!confirm(t('confirmSeedSettings'))) return

    setSeeding(true)
    try {
      const response = await fetch('/api/admin/settings/seed', {
        method: 'POST'
      })
      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        fetchSettings()
      } else {
        alert(data.error || t('settingsSeedFailed'))
      }
    } catch (error) {
      console.error('failed to create default settings:', error)
      alert(t('settingsSeedError'))
    } finally {
      setSeeding(false)
    }
  }

  // Value change handler
  const handleChange = (key: keyof SettingsData, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // Switch change handler
  const handleSwitchChange = (key: keyof SettingsData, checked: boolean) => {
    setSettings(prev => ({ ...prev, [key]: checked ? 'true' : 'false' }))
  }

  // Add a footer link
  const addFooterLink = () => {
    setFooterLinks([...footerLinks, { label: '', url: '' }])
  }

  // Remove a footer link
  const removeFooterLink = (index: number) => {
    setFooterLinks(footerLinks.filter((_, i) => i !== index))
  }

  // Update a footer link
  const updateFooterLink = (index: number, field: keyof FooterLink, value: string) => {
    setFooterLinks(footerLinks.map((link, i) =>
      i === index ? { ...link, [field]: value } : link
    ))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex">
          <Sidebar activeMenu="settings" />
          <main className="flex-1 lg:ml-0 p-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar activeMenu="settings" />
        <main className="flex-1 lg:ml-0 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="h-6 w-6" />
                {t('settingsTitle')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('settingsDesc')}
              </p>
            </div>
            <div className="flex gap-2">
              {!hasSettings && (
                <Button onClick={handleSeed} disabled={seeding} variant="outline">
                  {seeding ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {t('seedDefault')}
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t('saveBtn')}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Site basic settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {t('siteBasicSettings')}
                </CardTitle>
                <CardDescription>
                  {t('siteBasicDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="site_name">{t('siteName')}</Label>
                  <Input
                    id="site_name"
                    value={settings.site_name}
                    onChange={(e) => handleChange('site_name', e.target.value)}
                    placeholder="NexiBase"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="site_url">{t('siteUrl')}</Label>
                  <Input
                    id="site_url"
                    type="url"
                    value={settings.site_url}
                    onChange={(e) => handleChange('site_url', e.target.value)}
                    placeholder={t('siteUrlPlaceholder')}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('siteUrlDescription')}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="site_locale">{t('siteLocale')}</Label>
                  <Select
                    value={settings.site_locale}
                    onValueChange={(value) => handleChange('site_locale', value)}
                  >
                    <SelectTrigger id="site_locale" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LOCALES.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {LOCALE_LABELS[loc] ?? loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t('siteLocaleDescription')}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="site_description">{t('siteDescription')}</Label>
                  <Input
                    id="site_description"
                    value={settings.site_description}
                    onChange={(e) => handleChange('site_description', e.target.value)}
                    placeholder={t('siteDescriptionPlaceholder')}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('seoMetaDesc')}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="site_keywords">{t('siteKeywords')}</Label>
                  <Input
                    id="site_keywords"
                    value={settings.site_keywords}
                    onChange={(e) => handleChange('site_keywords', e.target.value)}
                    placeholder={t('siteKeywordsPlaceholder')}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('siteKeywordsDescription')}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>{t('siteLogo')}</Label>
                  <div className="flex items-center gap-4">
                    {settings.site_logo ? (
                      <div className="relative w-20 h-10 border rounded overflow-hidden bg-muted flex items-center justify-center">
                        <img src={settings.site_logo} alt={t('logoAlt')} className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-20 h-10 border rounded bg-muted flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.accept = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml'
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0]
                            if (!file) return
                            const formData = new FormData()
                            formData.append('logo', file)
                            try {
                              const res = await fetch('/api/admin/logo', { method: 'POST', body: formData })
                              const data = await res.json()
                              if (res.ok && data.imageUrl) {
                                handleChange('site_logo', data.imageUrl)
                                alert(t('logoUploaded'))
                              } else {
                                alert(data.error || t('logoUploadFailed'))
                              }
                            } catch {
                              alert(t('logoUploadError'))
                            }
                          }
                          input.click()
                        }}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" /> {t('upload')}
                      </Button>
                      {settings.site_logo && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/admin/logo', { method: 'DELETE' })
                              if (res.ok) {
                                handleChange('site_logo', '')
                                alert(t('logoDeleted'))
                              }
                            } catch {
                              alert(t('logoDeleteError'))
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> {t('delete')}
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('logoHint')}
                  </p>
                </div>

              </CardContent>
            </Card>

            {/* Google Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Google Analytics
                </CardTitle>
                <CardDescription>
                  {t('gaDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-sm">
                  <p className="font-medium mb-1">{t('gaIntegrationTitle')}</p>
                  <p className="text-muted-foreground">
                    {t('gaIntegrationDesc')}{' '}
                    <Link
                      href="/admin/settings/ga-guide"
                      className="underline text-blue-700 dark:text-blue-400 font-medium"
                    >
                      {t('gaGuideLink')}
                    </Link>
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="google_analytics_id">Measurement ID</Label>
                  <Input
                    id="google_analytics_id"
                    value={settings.google_analytics_id}
                    onChange={(e) => handleGaFieldChange('google_analytics_id', e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('measurementIdDesc')}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ga4_property_id">GA4 Property ID</Label>
                  <Input
                    id="ga4_property_id"
                    value={settings.ga4_property_id}
                    onChange={(e) => handleGaFieldChange('ga4_property_id', e.target.value)}
                    placeholder="412345678"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('propertyIdDesc')}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ga4_service_account_json">{t('serviceAccountJson')}</Label>
                  {!gaJsonEditing ? (
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                      {settings.ga4_service_account_json ? (
                        <span className="text-sm text-green-700 dark:text-green-400">
                          ✓ {t('keyEntered')}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {t('noKeySaved')}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        onClick={handleGaJsonEdit}
                      >
                        {settings.ga4_service_account_json ? t('changeBtn') : t('inputBtn')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        id="ga4_service_account_json"
                        value={gaJsonDraft}
                        onChange={(e) => setGaJsonDraft(e.target.value)}
                        placeholder='{"type":"service_account","project_id":"...","private_key":"..."}'
                        rows={8}
                        className="font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={handleGaJsonApply}>
                          {t('applyBtn')}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleGaJsonCancel}>
                          {t('cancelBtn')}
                        </Button>
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t('serviceAccountDesc')}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGaTest}
                    disabled={
                      gaTestResult.status === 'loading' ||
                      !settings.ga4_property_id ||
                      !settings.ga4_service_account_json
                    }
                  >
                    {gaTestResult.status === 'loading' ? t('testing') : t('connectionTest')}
                  </Button>
                  {gaTestResult.status === 'success' && (
                    <span className="text-sm text-green-700 dark:text-green-400">
                      ✓ {t('gaConnected', { propertyId: gaTestResult.propertyId, todayUsers: gaTestResult.todayUsers.toLocaleString() })}
                    </span>
                  )}
                  {gaTestResult.status === 'error' && (
                    <span className="text-sm text-red-600 dark:text-red-400">
                      ✗ {gaTestResult.message}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('gaTestSavedWarning')}
                </p>
              </CardContent>
            </Card>

            {/* Member settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('memberSettings')}
                </CardTitle>
                <CardDescription>
                  {t('memberSettingsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('allowSignup')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('allowSignupDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.signup_enabled === 'true'}
                    onCheckedChange={(checked) => handleSwitchChange('signup_enabled', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('requireEmailVerify')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('requireEmailVerifyDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_verification_required === 'true'}
                    onCheckedChange={(checked) => handleSwitchChange('email_verification_required', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Footer settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('footerSettings')}
                </CardTitle>
                <CardDescription>
                  {t('footerSettingsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="footer_copyright">{t('copyrightText')}</Label>
                  <Input
                    id="footer_copyright"
                    value={settings.footer_copyright}
                    onChange={(e) => handleChange('footer_copyright', e.target.value)}
                    placeholder="© 2025 NexiBase. All rights reserved."
                  />
                </div>

                <Separator />

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('footerLinks')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addFooterLink}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('addLink')}
                    </Button>
                  </div>

                  {footerLinks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t('noFooterLinks')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {footerLinks.map((link, index) => (
                        <div key={index} className="flex gap-2 items-start">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <Input
                              value={link.label}
                              onChange={(e) => updateFooterLink(index, 'label', e.target.value)}
                              placeholder={t('linkNamePlaceholder')}
                            />
                            <Input
                              value={link.url}
                              onChange={(e) => updateFooterLink(index, 'url', e.target.value)}
                              placeholder={t('urlPlaceholder')}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeFooterLink(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Layout settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {t('layoutSettings')}
                </CardTitle>
                <CardDescription>
                  {t('layoutSettingsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="layout_folder">{t('layoutSelect')}</Label>
                  <select
                    id="layout_folder"
                    className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                    value={settings.layout_folder}
                    onChange={(e) => handleChange('layout_folder', e.target.value)}
                  >
                    {layouts.map((layout) => (
                      <option key={layout.folder} value={layout.folder}>
                        {layout.folder === 'default' ? t('defaultLayout') : layout.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Indicator for whether the file exists */}
                {layouts.length > 0 && (
                  <div className="space-y-3">
                    <Label>{t('layoutFileStructure')}</Label>
                    <div className="border rounded-md divide-y">
                      {layouts.map((layout) => (
                        <div key={layout.folder} className={`px-4 py-3 ${settings.layout_folder === layout.folder ? 'bg-primary/5' : ''}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {layout.folder === 'default' ? t('defaultLayout') : layout.name}
                              {settings.layout_folder === layout.folder && (
                                <span className="ml-2 text-xs text-primary">{t('inUse')}</span>
                              )}
                            </span>
                            <div className="flex gap-3 text-xs">
                              <span>Header {layout.files.Header ? '✅' : '❌'}</span>
                              <span>{t('homePage')} {layout.files.HomePage ? '✅' : '❌'}</span>
                              <span>Footer {layout.files.Footer ? '✅' : '❌'}</span>
                            </div>
                          </div>
                          {layout.folder !== 'default' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {!layout.files.Header && !layout.files.Footer && layout.files.HomePage
                                ? t('customOnlyHome')
                                : Object.entries(layout.files).filter(([, v]) => !v).length > 0
                                ? t('defaultLayoutUsed', { items: Object.entries(layout.files).filter(([, v]) => !v).map(([k]) => k === 'HomePage' ? t('homePage') : k).join(', ') })
                                : t('fullCustom')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Theme settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  {t('themeSettings')}
                </CardTitle>
                <CardDescription>
                  {t('themeSettingsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="theme_folder">{t('themeSelect')}</Label>
                  <select
                    id="theme_folder"
                    className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                    value={settings.theme_folder}
                    onChange={(e) => handleChange('theme_folder', e.target.value)}
                  >
                    {themes.map((theme) => (
                      <option key={theme.folder} value={theme.folder}>
                        {themeName(theme.folder, theme.name)}
                      </option>
                    ))}
                  </select>
                </div>

                {themes.length > 0 && (
                  <div className="space-y-3">
                    <Label>{t('availableThemes')}</Label>
                    <div className="border rounded-md divide-y">
                      {themes.map((theme) => (
                        <div key={theme.folder} className={`px-4 py-3 ${settings.theme_folder === theme.folder ? 'bg-primary/5' : ''}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {themeName(theme.folder, theme.name)}
                              {settings.theme_folder === theme.folder && (
                                <span className="ml-2 text-xs text-primary">{t('inUse')}</span>
                              )}
                            </span>
                            {theme.author && (
                              <span className="text-xs text-muted-foreground">{t('byAuthor', { author: theme.author })}</span>
                            )}
                          </div>
                          {theme.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {themeDesc(theme.folder, theme.description)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
