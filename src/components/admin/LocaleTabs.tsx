"use client"

import { useState, ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { routing } from '@/i18n/routing'
import { Badge } from '@/components/ui/badge'

interface LocaleTabsProps {
  /**
   * 각 locale별 컨텐츠 렌더러. 첫 번째 탭은 defaultLocale.
   */
  renderTab: (locale: string, isDefault: boolean) => ReactNode
  /**
   * 각 locale의 번역 상태 — 'auto' | 'manual' | 'missing'
   */
  getStatus?: (locale: string) => 'auto' | 'manual' | 'missing' | undefined
}

export function LocaleTabs({ renderTab, getStatus }: LocaleTabsProps) {
  const [active, setActive] = useState<string>(routing.defaultLocale)

  const localeLabel: Record<string, string> = {
    en: 'EN',
    ko: 'KO',
  }

  return (
    <Tabs value={active} onValueChange={setActive} className="w-full">
      <TabsList className="w-full justify-start">
        {routing.locales.map(locale => {
          const status = getStatus?.(locale)
          return (
            <TabsTrigger key={locale} value={locale} className="flex items-center gap-2">
              {localeLabel[locale] ?? locale.toUpperCase()}
              {status === 'auto' && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">auto</Badge>
              )}
              {status === 'manual' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary text-primary">manual</Badge>
              )}
              {status === 'missing' && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">—</Badge>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
      {routing.locales.map(locale => (
        <TabsContent key={locale} value={locale} className="mt-4 space-y-4">
          {renderTab(locale, locale === routing.defaultLocale)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
