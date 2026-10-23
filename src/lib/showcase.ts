import 'server-only'
import { prisma } from '@/lib/prisma'
import { getShowcasePreview } from '@/lib/showcase-preview'

export async function getPublicShowcase(limit = 6) {
  const board = await prisma.board.findUnique({ where: { slug: 'showcase' } })
  if (!board?.isActive || board.listMemberOnly || board.readMemberOnly) return { available: false, posts: [] }
  const posts = await prisma.post.findMany({
    where: { boardId: board.id, status: 'published', isSecret: false, isNotice: false },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: Math.min(6, Math.max(1, Math.floor(limit) || 6)),
    select: {
      id: true, title: true, content: true, viewCount: true, commentCount: true,
      author: { select: { nickname: true } },
      attachments: {
        where: { mimeType: { startsWith: 'image/' } }, take: 1,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: { filePath: true, thumbnailPath: true },
      },
    },
  })
  return {
    available: true,
    posts: posts.map(({ content, attachments, ...post }) => ({
      ...post,
      commentCount: board.useComment ? post.commentCount : 0,
      ...getShowcasePreview(content, board.useFile ? attachments[0]?.thumbnailPath || attachments[0]?.filePath : null),
    })),
  }
}
