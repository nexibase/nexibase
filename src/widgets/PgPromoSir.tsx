"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CreditCard, Check, ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"

export default function PgPromoSir() {
  const t = useTranslations("widgets.pgPromoSir")

  return (
    <Card className="h-full bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
      <CardContent className="p-6 h-full flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">{t("headline")}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">{t("leadLabel")}</p>
          <p className="text-4xl md:text-5xl font-extrabold tracking-tight text-primary">
            2.80<span className="text-2xl md:text-3xl align-top ml-1">%</span>
          </p>
        </div>

        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>{t("bullet1")}</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>{t("bullet2")}</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>{t("bullet3")}</span>
          </li>
        </ul>

        <a
          href="https://sir.kr/services"
          target="_blank"
          rel="sponsored noopener"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("cta")}
          <ArrowRight className="h-4 w-4" />
        </a>
      </CardContent>
    </Card>
  )
}
