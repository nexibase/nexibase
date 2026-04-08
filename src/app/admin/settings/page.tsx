"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
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
} from "lucide-react"

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
  footer_copyright: string
  footer_links: string

  // 레이아웃 설정
  layout_folder: string

  // 테마 설정
  theme_folder: string

  // 외부 서비스
  google_analytics_id: string

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
  site_description: '',
  site_logo: '',
  signup_enabled: 'true',
  email_verification_required: 'false',
  footer_copyright: '',
  footer_links: '[]',
  layout_folder: 'default',
  theme_folder: 'default',
  google_analytics_id: ''
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [hasSettings, setHasSettings] = useState(false)
  const [layouts, setLayouts] = useState<LayoutInfo[]>([])
  const [themes, setThemes] = useState<ThemeInfo[]>([])

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
        body: JSON.stringify({ settings: settingsToSave })
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        setHasSettings(true)
      } else {
        alert(data.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('설정 저장 에러:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 기본 설정 생성
  const handleSeed = async () => {
    if (!confirm('기본 설정을 생성하시겠습니까?')) return

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
        alert(data.error || '생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('기본 설정 생성 에러:', error)
      alert('생성 중 오류가 발생했습니다.')
    } finally {
      setSeeding(false)
    }
  }

  // 값 변경 핸들러
  const handleChange = (key: keyof SettingsData, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
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
                환경설정
              </h1>
              <p className="text-muted-foreground mt-1">
                사이트 기본 설정을 관리합니다
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
                  기본 설정 생성
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                저장
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {/* 사이트 기본 설정 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  사이트 기본 설정
                </CardTitle>
                <CardDescription>
                  사이트의 기본 정보를 설정합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="site_name">사이트명</Label>
                  <Input
                    id="site_name"
                    value={settings.site_name}
                    onChange={(e) => handleChange('site_name', e.target.value)}
                    placeholder="NexiBase"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="site_description">사이트 설명</Label>
                  <Textarea
                    id="site_description"
                    value={settings.site_description}
                    onChange={(e) => handleChange('site_description', e.target.value)}
                    placeholder="사이트에 대한 간단한 설명을 입력하세요"
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground">
                    SEO 메타 태그에 사용됩니다
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="site_logo">로고 URL</Label>
                  <Input
                    id="site_logo"
                    value={settings.site_logo}
                    onChange={(e) => handleChange('site_logo', e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="google_analytics_id">Google Analytics ID</Label>
                  <Input
                    id="google_analytics_id"
                    value={settings.google_analytics_id}
                    onChange={(e) => handleChange('google_analytics_id', e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                  />
                  <p className="text-sm text-muted-foreground">
                    Google Analytics 측정 ID를 입력하면 자동으로 추적 코드가 삽입됩니다
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 회원 설정 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  회원 설정
                </CardTitle>
                <CardDescription>
                  회원가입 및 인증 관련 설정입니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>회원가입 허용</Label>
                    <p className="text-sm text-muted-foreground">
                      새로운 사용자의 회원가입을 허용합니다
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
                    <Label>이메일 인증 필수</Label>
                    <p className="text-sm text-muted-foreground">
                      회원가입 시 이메일 인증을 필수로 합니다
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
                  푸터 설정
                </CardTitle>
                <CardDescription>
                  사이트 하단에 표시되는 정보를 설정합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="footer_copyright">Copyright 문구</Label>
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
                    <Label>푸터 링크</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addFooterLink}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      링크 추가
                    </Button>
                  </div>

                  {footerLinks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      푸터에 표시할 링크가 없습니다. 링크를 추가해 주세요.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {footerLinks.map((link, index) => (
                        <div key={index} className="flex gap-2 items-start">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <Input
                              value={link.label}
                              onChange={(e) => updateFooterLink(index, 'label', e.target.value)}
                              placeholder="링크명 (예: 이용약관)"
                            />
                            <Input
                              value={link.url}
                              onChange={(e) => updateFooterLink(index, 'url', e.target.value)}
                              placeholder="URL (예: /policy/terms)"
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
                  레이아웃 설정
                </CardTitle>
                <CardDescription>
                  사이트 레이아웃(Header, 홈페이지, Footer)을 선택합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="layout_folder">레이아웃 선택</Label>
                  <select
                    id="layout_folder"
                    className="w-full h-10 px-3 border rounded-md bg-background text-sm"
                    value={settings.layout_folder}
                    onChange={(e) => handleChange('layout_folder', e.target.value)}
                  >
                    {layouts.map((layout) => (
                      <option key={layout.folder} value={layout.folder}>
                        {layout.folder === 'default' ? '기본 레이아웃' : layout.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 파일 존재 여부 표시 */}
                {layouts.length > 0 && (
                  <div className="space-y-3">
                    <Label>레이아웃별 파일 구성</Label>
                    <div className="border rounded-md divide-y">
                      {layouts.map((layout) => (
                        <div key={layout.folder} className={`px-4 py-3 ${settings.layout_folder === layout.folder ? 'bg-primary/5' : ''}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {layout.folder === 'default' ? '기본 레이아웃' : layout.name}
                              {settings.layout_folder === layout.folder && (
                                <span className="ml-2 text-xs text-primary">(사용중)</span>
                              )}
                            </span>
                            <div className="flex gap-3 text-xs">
                              <span>Header {layout.files.Header ? '✅' : '❌'}</span>
                              <span>홈페이지 {layout.files.HomePage ? '✅' : '❌'}</span>
                              <span>Footer {layout.files.Footer ? '✅' : '❌'}</span>
                            </div>
                          </div>
                          {layout.folder !== 'default' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {!layout.files.Header && !layout.files.Footer && layout.files.HomePage
                                ? '홈페이지만 커스텀, Header/Footer는 기본 사용'
                                : Object.entries(layout.files).filter(([, v]) => !v).length > 0
                                ? `${Object.entries(layout.files).filter(([, v]) => !v).map(([k]) => k === 'HomePage' ? '홈페이지' : k).join(', ')}는 기본 레이아웃 사용`
                                : '전체 커스텀'}
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
                  테마 설정
                </CardTitle>
                <CardDescription>
                  사이트 색상 테마를 선택합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="theme_folder">테마 선택</Label>
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
                    <Label>사용 가능한 테마</Label>
                    <div className="border rounded-md divide-y">
                      {themes.map((theme) => (
                        <div key={theme.folder} className={`px-4 py-3 ${settings.theme_folder === theme.folder ? 'bg-primary/5' : ''}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {theme.name}
                              {settings.theme_folder === theme.folder && (
                                <span className="ml-2 text-xs text-primary">(사용중)</span>
                              )}
                            </span>
                            {theme.author && (
                              <span className="text-xs text-muted-foreground">by {theme.author}</span>
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
