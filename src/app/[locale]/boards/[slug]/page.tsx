import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { pageMetadata } from '@/lib/seo'
import BoardListPage, { type BoardListInitialData } from '@/features/boards/components/BoardListPage'

const getBoard = cache((slug: string) => prisma.board.findFirst({ where: { slug, isActive: true } }))

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const board = await getBoard(slug)
  if (!board) notFound()
  if (board.listMemberOnly || board.readMemberOnly) return pageMetadata('Board', 'Member access required.', `/boards/${encodeURIComponent(slug)}`, { noIndex: true })
  return pageMetadata(board.name, board.description || board.name, `/boards/${encodeURIComponent(slug)}`)
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const board = await getBoard((await params).slug)
  if (!board) notFound()
  if (board.listMemberOnly || board.readMemberOnly) return <BoardListPage />
  const select = {
    id: true, title: true, viewCount: true, likeCount: true, commentCount: true, isNotice: true, isSecret: true, createdAt: true,
    author: { select: { id: true, uuid: true, nickname: true, image: true } },
    _count: { select: { attachments: true } },
    attachments: { where: { mimeType: { startsWith: 'image/' } }, take: 1, orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }], select: { filePath: true, thumbnailPath: true } },
  } satisfies Prisma.PostSelect
  // Secret post titles are not included in public server HTML.
  const where = { boardId: board.id, status: 'published', isSecret: false }
  const orderBy = board.sortOrder === 'popular' ? [{ viewCount: 'desc' as const }, { createdAt: 'desc' as const }] : [{ createdAt: board.sortOrder === 'oldest' ? 'asc' as const : 'desc' as const }]
  const [posts, notices, total] = await Promise.all([
    prisma.post.findMany({ where: { ...where, isNotice: false }, take: board.postsPerPage, orderBy, select }),
    prisma.post.findMany({ where: { ...where, isNotice: true }, orderBy: { createdAt: 'desc' }, select }),
    prisma.post.count({ where: { ...where, isNotice: false } }),
  ])
  const serialize = (post: typeof posts[number]) => ({ ...post, id: String(post.id), createdAt: post.createdAt.toISOString(),
    thumbnail: post.attachments[0]?.thumbnailPath || post.attachments[0]?.filePath || null,
    attachments: undefined, author: { ...post.author, id: String(post.author.id), name: '' },
  })
  const initialData: BoardListInitialData = { board: { ...board, id: String(board.id) }, posts: posts.map(serialize), notices: notices.map(serialize), total, totalPages: Math.ceil(total / board.postsPerPage) }
  return <BoardListPage initialData={initialData} />
}
