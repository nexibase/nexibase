"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SettingsContent() {
  const t = useTranslations('admin')
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">{t('settingsTitle')}</h2>
        <p className="text-muted-foreground">{t('settingsDesc')}</p>
      </div>

      {/* 기본 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('siteBasicSettings')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="site-name">{t('siteName')}</Label>
              <Input id="site-name" defaultValue={t('panel')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-url">Site URL</Label>
              <Input id="site-url" defaultValue="https://example.com" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('siteDescription')}</Label>
            <Input id="description" defaultValue={t('panel')} />
          </div>
        </CardContent>
      </Card>

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <Button>{t('saveBtn')}</Button>
      </div>
    </div>
  )
}
