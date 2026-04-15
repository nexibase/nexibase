// NOTE: Placeholder component — boards feature is provided by a plugin.
// See src/app/[locale]/admin/boards/** (auto-generated, gitignored).
// Kept as a stub to avoid breaking imports. Not translated intentionally.
"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"

export function BoardsContent() {
  const t = useTranslations('admin')
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">{t('boards')}</h2>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">{t('pluginAdmin')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
