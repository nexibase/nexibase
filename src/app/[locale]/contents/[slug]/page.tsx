import { cache } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ContentPage from '@/features/contents/components/ContentPage'
import { pageMetadata, plainDescription } from '@/lib/seo'

const getContent = cache((slug: string) => prisma.content.findFirst({ where: { slug, isPublic: true }, select: { id: true, slug: true, title: true, content: true, updatedAt: true } }))

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const content = await getContent(slug)
  if (!content) notFound()
  return pageMetadata(content.title, plainDescription(content.content), `/contents/${encodeURIComponent(slug)}`)
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const content = await getContent((await params).slug)
  if (!content) notFound()
  return <ContentPage initialContent={{ ...content, updatedAt: content.updatedAt.toISOString() }} />
}
