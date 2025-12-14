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
} from "lucide-react"

interface Settings {
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
}

const DEFAULT_SETTINGS: Settings = {
  site_name: 'NexiBase',
  site_description: '',
  site_logo: '',
  signup_enabled: 'true',
  email_verification_required: 'false',
  footer_copyright: '',
  footer_links: '[]'
}

export default function ConfigPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [hasSettings, setHasSettings] = useState(false)

  // 설정 불러오기
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings')
      const data = await response.json()

      if (response.ok && data.settings) {
        const hasAny = Object.keys(data.settings).length > 0
        setHasSettings(hasAny)
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data.settings
        })
      }
    } catch (error) {
      console.error('설정 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // 설정 저장
  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
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
  const handleChange = (key: keyof Settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // 스위치 변경 핸들러
  const handleSwitchChange = (key: keyof Settings, checked: boolean) => {
    setSettings(prev => ({ ...prev, [key]: checked ? 'true' : 'false' }))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 ml-0 lg:ml-64">
        <div className="max-w-4xl mx-auto">
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

                <div className="grid gap-2">
                  <Label htmlFor="footer_links">푸터 링크 (JSON)</Label>
                  <Textarea
                    id="footer_links"
                    value={settings.footer_links}
                    onChange={(e) => handleChange('footer_links', e.target.value)}
                    placeholder='[{"label": "이용약관", "url": "/policy/terms"}]'
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-muted-foreground">
                    JSON 배열 형식: {`[{"label": "링크명", "url": "/경로"}]`}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
