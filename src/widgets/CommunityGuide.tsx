"use client"

import { Card, CardContent } from "@/components/ui/card"
import { BookOpen } from "lucide-react"
import { useTranslations } from 'next-intl'

export default function CommunityGuide() {
  const t = useTranslations('widgets')
  return (
    <Card className="h-full bg-gradient-to-br from-muted/50 to-muted/30">
      <CardContent className="p-4 h-full flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{t('communityGuide')}</h3>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>- {t('guideRespect')}</li>
          <li>- {t('guideNoSpam')}</li>
          <li>- {t('guideNoAds')}</li>
        </ul>
      </CardContent>
    </Card>
  )
}
