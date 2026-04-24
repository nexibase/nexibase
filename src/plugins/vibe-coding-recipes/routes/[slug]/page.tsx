import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { prisma } from '@/lib/prisma'
import { getLocale } from 'next-intl/server'
import { RecipeSteps } from '@/plugins/vibe-coding-recipes/components/RecipeSteps'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const recipe = await prisma.vibeRecipe.findUnique({
    where: { slug },
    select: { titleEn: true, descriptionEn: true },
  })
  if (!recipe) return {}

  const description = recipe.descriptionEn.replace(/[#*`_\[\]]/g, '').slice(0, 160)
  return {
    title: recipe.titleEn,
    description,
    openGraph: {
      title: recipe.titleEn,
      description,
      url: `https://nexibase.com/en/vibe-coding-recipes/${slug}`,
    },
    alternates: {
      canonical: `https://nexibase.com/en/vibe-coding-recipes/${slug}`,
    },
  }
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const locale = await getLocale()
  const isKo = locale === 'ko'

  const recipe = await prisma.vibeRecipe.findUnique({ where: { slug } })
  if (!recipe) notFound()

  const title = isKo ? recipe.titleKo : recipe.titleEn
  const description = isKo ? recipe.descriptionKo : recipe.descriptionEn
  const constraints = (isKo ? recipe.constraintsKo : recipe.constraintsEn) as string[]
  const steps = (isKo ? recipe.stepsKo : recipe.stepsEn) as {
    step: number
    prompt: string
    expected: string
  }[]
  const typeLabel = recipe.type.replace(/_/g, ' ')

  const DIFF_COLORS: Record<string, string> = {
    beginner: 'bg-green-100 text-green-800',
    intermediate: 'bg-yellow-100 text-yellow-800',
    advanced: 'bg-red-100 text-red-800',
  }
  const TYPE_COLORS: Record<string, string> = {
    plugin: 'bg-blue-100 text-blue-800',
    widget: 'bg-purple-100 text-purple-800',
    plugin_with_widget: 'bg-indigo-100 text-indigo-800',
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href={`/${locale}/vibe-coding-recipes`}>
        <Button variant="ghost" size="sm" className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" />
          {isKo ? '레시피 목록으로' : 'Back to recipes'}
        </Button>
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="secondary" className={DIFF_COLORS[recipe.difficulty]}>
            {recipe.difficulty}
          </Badge>
          <Badge variant="secondary" className={TYPE_COLORS[recipe.type]}>
            {typeLabel}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {isKo ? '생성일' : 'Generated'}: {recipe.generatedAt.toLocaleDateString(isKo ? 'ko-KR' : 'en-US')}
        </p>
      </div>

      <div className="prose dark:prose-invert max-w-none mb-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
      </div>

      {constraints.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-3">
            {isKo ? '제약 조건' : 'Constraints'}
          </h2>
          <ul className="list-disc list-inside space-y-1">
            {constraints.map((c, i) => (
              <li key={i} className="text-sm">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <RecipeSteps steps={steps} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: recipe.titleEn,
            description: recipe.descriptionEn.replace(/[#*`_\[\]]/g, '').slice(0, 300),
            step: (recipe.stepsEn as { step: number; prompt: string; expected: string }[]).map(
              (s) => ({
                '@type': 'HowToStep',
                position: s.step,
                text: s.expected,
              })
            ),
          }),
        }}
      />
    </div>
  )
}
