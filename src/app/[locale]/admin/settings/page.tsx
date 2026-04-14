"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Sidebar } from "@/components/admin/Sidebar"
import { LocaleTabs } from "@/components/admin/LocaleTabs"
import { LocaleField } from "@/components/admin/LocaleField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { routing } from "@/i18n/routing"

interface FooterLink {
  label: string
  url: string
}

interface SettingsData {
  // 사이트 기본
  site_name: string
  site_description: string
  site_logo: string

  // 회원 설정
  signup_enabled: string
  email_verification_required: string

  // 푸터 설정
  footer_text: string
  footer_copyright: string
  footer_links: string

  // 레이아웃 설정
  layout_folder: string

  // 테마 설정
  theme_folder: string

  // 외부 서비스
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

// SettingTranslation row from API
interface TranslationRow {
  key: string
  locale: string
  value: string
  source: string
}

const DEFAULT_SETTINGS: SettingsData = {
  site_name: 'NexiBase',
  site_description: '',
  site_logo: '',
  signup_enabled: 'true',
  email_verification_required: 'false',
  footer_text: '',
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
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [hasSettings, setHasSettings] = useState(false)
  const [layouts, setLayouts] = useState<LayoutInfo[]>([])
  const [themes, setThemes] = useState<ThemeInfo[]>([])

  // sub-locale translations: { locale: { site_name?, site_description?, footer_text? } }
  const [settingTranslations, setSettingTranslations] = useState<Record<string, Record<string, string>>>({})
  // existing translation source info: "locale__key" -> source
  const [translationSources, setTranslationSources] = useState<Record<string, string>>({})

  // Google Analytics 섹션 전용 상태
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

  // JSON 문자열을 FooterLink 배열로 파싱
  const parseFooterLinks = (jsonStr: string): FooterLink[] => {
    try {
      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item.label && item.url)
      }
    } catch {
      // 파싱 실패시 빈 배열
    }
    return []
  }

  // 설정 불러오기
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

        // 기존 번역 rows를 settingTranslations state에 로드
        if (Array.isArray(data.translations)) {
          const byLocale: Record<string, Record<string, string>> = {}
          const sources: Record<string, string> = {}
          for (const row of data.translations as TranslationRow[]) {
            if (row.locale === routing.defaultLocale) continue
            if (!byLocale[row.locale]) byLocale[row.locale] = {}
            byLocale[row.locale][row.key] = row.value
            sources[`${row.locale}__${row.key}`] = row.source
          }
          setSettingTranslations(byLocale)
          setTranslationSources(sources)
        }
      }
    } catch (error) {
      console.error('설정 조회 에러:', error)
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

  // 설정 저장
  const handleSave = async () => {
    setSaving(true)
    try {
      // footerLinks를 JSON 문자열로 변환하여 저장
      const settingsToSave = {
        ...settings,
        footer_links: JSON.stringify(footerLinks)
      }

      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: settingsToSave,
          translations: settingTranslations,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        setHasSettings(true)
        setGaTestResult({ status: 'idle' })
      } else {
        alert(data.error || t('settingsSaveFailed'))
      }
    } catch (error) {
      console.error('설정 저장 에러:', error)
      alert(t('settingsSaveError'))
    } finally {
      setSaving(false)
    }
  }

  // 기본 설정 생성
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
      console.error('기본 설정 생성 에러:', error)
      alert(t('settingsSeedError'))
    } finally {
      setSeeding(false)
    }
  }

  // 값 변경 핸들러
  const handleChange = (key: keyof SettingsData, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // sub-locale 번역 값 변경 핸들러
  const handleTranslationChange = (locale: string, key: string, value: string) => {
    setSettingTranslations(prev => ({
      ...prev,
      [locale]: { ...prev[locale], [key]: value },
    }))
    // mark source as manual once user edits
    setTranslationSources(prev => ({ ...prev, [`${locale}__${key}`]: 'manual' }))
  }

  // 스위치 변경 핸들러
  const handleSwitchChange = (key: keyof SettingsData, checked: boolean) => {
    setSettings(prev => ({ ...prev, [key]: checked ? 'true' : 'false' }))
  }

  // 푸터 링크 추가
  const addFooterLink = () => {
    setFooterLinks([...footerLinks, { label: '', url: '' }])
  }

  // 푸터 링크 삭제
  const removeFooterLink = (index: number) => {
    setFooterLinks(footerLinks.filter((_, i) => i !== index))
  }

  // 푸터 링크 변경
  const updateFooterLink = (index: number, field: keyof FooterLink, value: string) => {
    setFooterLinks(footerLinks.map((link, i) =>
      i === index ? { ...link, [field]: value } : link
    ))
  }

  // LocaleTabs getStatus helper for a given field key
  const getFieldStatus = (fieldKey: string) => (locale: string) => {
    if (locale === routing.defaultLocale) return undefined
    const src = translationSources[`${locale}__${fieldKey}`]
    if (!src) return 'missing' as const
    if (src === 'manual') return 'manual' as const
    return 'auto' as const
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
          {/* 헤더 */}
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
            {/* 사이트 기본 설정 */}
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
                {/* site_name — translatable */}
                <div className="grid gap-2">
                  <Label>{t('siteName')}</Label>
                  <LocaleTabs
                    getStatus={getFieldStatus('site_name')}
                    renderTab={(locale, isDefault) => (
                      <LocaleField
                        label={t('siteName')}
                        isDefaultLocale={isDefault}
                        subLocaleHint={t('translationSubLocaleHint')}
                      >
                        {isDefault ? (
                          <Input
                            value={settings.site_name}
                            onChange={(e) => handleChange('site_name', e.target.value)}
                            placeholder="NexiBase"
                          />
                        ) : (
                          <Input
                            value={settingTranslations[locale]?.site_name ?? ''}
                            onChange={(e) => handleTranslationChange(locale, 'site_name', e.target.value)}
                            placeholder="NexiBase"
                          />
                        )}
                      </LocaleField>
                    )}
                  />
                </div>

                {/* site_description — translatable */}
                <div className="grid gap-2">
                  <Label>{t('siteDescription')}</Label>
                  <LocaleTabs
                    getStatus={getFieldStatus('site_description')}
                    renderTab={(locale, isDefault) => (
                      <LocaleField
                        label={t('siteDescription')}
                        helperText={isDefault ? t('seoMetaDesc') : undefined}
                        isDefaultLocale={isDefault}
                        subLocaleHint={t('translationSubLocaleHint')}
                      >
                        {isDefault ? (
                          <Textarea
                            value={settings.site_description}
                            onChange={(e) => handleChange('site_description', e.target.value)}
                            placeholder={t('siteDescriptionPlaceholder')}
                            rows={3}
                          />
                        ) : (
                          <Textarea
                            value={settingTranslations[locale]?.site_description ?? ''}
                            onChange={(e) => handleTranslationChange(locale, 'site_description', e.target.value)}
                            placeholder={t('siteDescriptionPlaceholder')}
                            rows={3}
                          />
                        )}
                      </LocaleField>
                    )}
                  />
                </div>

                {/* site_logo — NOT translatable, stays as-is */}
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

            {/* 회원 설정 — NOT translatable, unchanged */}
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

            {/* 푸터 설정 */}
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
                {/* footer_text — translatable */}
                <div className="grid gap-2">
                  <Label>{t('footerText')}</Label>
                  <LocaleTabs
                    getStatus={getFieldStatus('footer_text')}
                    renderTab={(locale, isDefault) => (
                      <LocaleField
                        label={t('footerText')}
                        isDefaultLocale={isDefault}
                        subLocaleHint={t('translationSubLocaleHint')}
                      >
                        {isDefault ? (
                          <Textarea
                            value={settings.footer_text}
                            onChange={(e) => handleChange('footer_text', e.target.value)}
                            placeholder={t('footerTextPlaceholder')}
                            rows={2}
                          />
                        ) : (
                          <Textarea
                            value={settingTranslations[locale]?.footer_text ?? ''}
                            onChange={(e) => handleTranslationChange(locale, 'footer_text', e.target.value)}
                            placeholder={t('footerTextPlaceholder')}
                            rows={2}
                          />
                        )}
                      </LocaleField>
                    )}
                  />
                </div>

                {/* footer_copyright — NOT translatable */}
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

            {/* 레이아웃 설정 */}
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

                {/* 파일 존재 여부 표시 */}
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

            {/* 테마 설정 */}
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
                        {theme.name}
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
                              {theme.name}
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
                              {theme.description}
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
