'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from './CopyButton'
import { useTranslations } from 'next-intl'

interface Step {
  step: number
  prompt: string
  expected: string
}

export function RecipeSteps({ steps }: { steps: Step[] }) {
  const t = useTranslations('vibe-coding-recipes')

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{t('steps')}</h2>
      {steps.map((s) => (
        <Card key={s.step}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('step')} {s.step}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-muted-foreground">{t('prompt')}</span>
                <CopyButton text={s.prompt} />
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none bg-muted p-3 rounded-md overflow-x-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.prompt}</ReactMarkdown>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">{t('expected')}</span>
              <p className="text-sm mt-1">{s.expected}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
