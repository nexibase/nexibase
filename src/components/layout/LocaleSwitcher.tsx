'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { Globe } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Locale = (typeof routing.locales)[number]

export function LocaleSwitcher() {
  const t = useTranslations('locale')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const switchTo = (nextLocale: Locale) => {
    router.replace(pathname, { locale: nextLocale })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('switchTo')}>
          <Globe className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-32 p-1">
        {routing.locales.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => switchTo(loc)}
            className={cn(
              'w-full rounded-sm px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent',
              loc === locale && 'font-semibold bg-accent/50'
            )}
          >
            {t(loc)}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
