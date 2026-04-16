import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getLocale } from 'next-intl/server'
import { RecipeCard } from '@/plugins/vibe-coding-recipes/components/RecipeCard'
import { RecipeFilter } from '@/plugins/vibe-coding-recipes/components/RecipeFilter'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Vibe Coding Recipes',
  description: 'AI recipes & prompts for building NexiBase plugins and widgets',
}

const PAGE_SIZE = 12

export default async function RecipeListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams
  const locale = await getLocale()
  const page = Math.max(1, parseInt(params.page || '1'))
  const difficulty = params.difficulty || ''
  const type = params.type || ''

  const where: Record<string, unknown> = {}
  if (difficulty) where.difficulty = difficulty
  if (type) where.type = type

  const [recipes, total] = await Promise.all([
    prisma.vibeRecipe.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { generatedAt: 'desc' },
    }),
    prisma.vibeRecipe.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const isKo = locale === 'ko'

  const buildPageUrl = (p: number) => {
    const sp = new URLSearchParams()
    if (difficulty) sp.set('difficulty', difficulty)
    if (type) sp.set('type', type)
    sp.set('page', String(p))
    return `/${locale}/vibe-coding-recipes?${sp.toString()}`
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {isKo ? '바이브코딩 레시피' : 'Vibe Coding Recipes'}
        </h1>
        <p className="text-muted-foreground">
          {isKo
            ? 'NexiBase 플러그인과 위젯을 만드는 레시피 & 프롬프트'
            : 'AI recipes & prompts for building NexiBase plugins and widgets'}
        </p>
      </div>

      <div className="mb-6">
        <RecipeFilter />
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {isKo ? '아직 레시피가 없습니다. 곧 추가됩니다!' : 'No recipes yet. Check back soon!'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                slug={recipe.slug}
                title={isKo ? recipe.titleKo : recipe.titleEn}
                description={isKo ? recipe.descriptionKo : recipe.descriptionEn}
                difficulty={recipe.difficulty}
                type={recipe.type}
                generatedAt={recipe.generatedAt.toISOString()}
                locale={locale}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              {page > 1 && (
                <Link href={buildPageUrl(page - 1)}>
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {isKo ? '이전' : 'Previous'}
                  </Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground px-3">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link href={buildPageUrl(page + 1)}>
                  <Button variant="outline" size="sm">
                    {isKo ? '다음' : 'Next'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
