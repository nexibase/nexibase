import { cache } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { pageMetadata, plainDescription, jsonLd } from '@/lib/seo'
import { loadSiteSettings, resolveSiteUrl } from '@/lib/site-settings'
import BoardPostPage, { type BoardPostInitialData } from '@/features/boards/components/BoardPostPage'

const getPost = cache(async (slug: string, postId: string) => {
  if (!/^\d+$/.test(postId) || !Number.isSafeInteger(Number(postId)) || Number(postId) < 1 || Number(postId) > 2147483647) return null
  return prisma.post.findFirst({
    where: { id: Number(postId), status: 'published', board: { slug, isActive: true } },
    include: {
      board: true,
      author: { select: { id: true, uuid: true, nickname: true, image: true } },
      attachments: { orderBy: { sortOrder: 'asc' } },
      comments: { where: { status: 'published', isSecret: false }, orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, uuid: true, nickname: true, image: true } }, parent: { select: { author: { select: { nickname: true } } } } } },
    },
  })
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = await params
  const post = await getPost(slug, postId)
  if (!post) notFound()
  const path = `/boards/${encodeURIComponent(slug)}/${post.id}`
  if (post.isSecret || post.board.readMemberOnly) return pageMetadata('Post', 'Read permission required.', path, { noIndex: true })
  return pageMetadata(post.title, plainDescription(post.content), path, { article: true })
}

export default async function Page({ params }: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = await params
  const post = await getPost(slug, postId)
  if (!post) notFound()
  if (post.isSecret || post.board.readMemberOnly) return <BoardPostPage />
  const { board } = post
  const adjacentWhere = { boardId: board.id, status: 'published', isSecret: false }
  const [prev, next, settings] = await Promise.all([
    prisma.post.findFirst({ where: { ...adjacentWhere, createdAt: { lt: post.createdAt } }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true } }),
    prisma.post.findFirst({ where: { ...adjacentWhere, createdAt: { gt: post.createdAt } }, orderBy: { createdAt: 'asc' }, select: { id: true, title: true } }),
    loadSiteSettings(),
  ])
  const base = await resolveSiteUrl(settings.site_url)
  const path = `/boards/${encodeURIComponent(slug)}/${post.id}`
  const author = { ...post.author, id: String(post.author.id), name: '' }
  const initialData: BoardPostInitialData = {
    board: { id: String(board.id), slug: board.slug, name: board.name, useComment: board.useComment, useReaction: board.useReaction, useFile: board.useFile, commentMemberOnly: board.commentMemberOnly, displayType: board.displayType },
    post: { id: String(post.id), title: post.title, content: post.content, author, viewCount: post.viewCount, likeCount: post.likeCount, commentCount: post.commentCount, isNotice: post.isNotice, isSecret: post.isSecret, createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString(),
      attachments: board.useFile ? post.attachments.map(file => ({ id: file.id, filename: file.filename, filePath: file.filePath, thumbnailPath: file.thumbnailPath, fileSize: file.fileSize, mimeType: file.mimeType, downloadCount: file.downloadCount })) : [],
      comments: board.useComment ? post.comments.map(comment => ({ id: String(comment.id), content: comment.content, parentId: comment.parentId ? String(comment.parentId) : null, createdAt: comment.createdAt.toISOString(), parent: comment.parent, author: { ...comment.author, id: String(comment.author.id), name: '' } })) : [],
    },
    prevPost: prev ? { ...prev, id: String(prev.id) } : null,
    nextPost: next ? { ...next, id: String(next.id) } : null,
  }
  const structured = { '@context': 'https://schema.org', '@type': 'DiscussionForumPosting', headline: post.title,
    text: plainDescription(post.content, 10000), datePublished: post.createdAt.toISOString(), dateModified: post.updatedAt.toISOString(),
    author: { '@type': 'Person', name: post.author.nickname || 'Member' },
    url: new URL(path, base).toString(), mainEntityOfPage: new URL(path, base).toString(),
    publisher: { '@type': 'Organization', name: settings.site_name, url: base.toString() },
  }
  return <>
    <BoardPostPage initialData={initialData} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
  </>
}
