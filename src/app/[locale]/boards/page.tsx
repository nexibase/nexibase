import BoardsPage from "@/features/boards/components/BoardsPage"
import { prisma } from '@/lib/prisma'
import { pageMetadata } from '@/lib/seo'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations('boards')
  return pageMetadata(t('allBoards'), t('exploreBoards'), '/boards')
}

export default async function Page() {
  const boards = await prisma.board.findMany({ where: { isActive: true, listMemberOnly: false }, select: { id: true, slug: true, name: true, description: true, postCount: true }, orderBy: { createdAt: 'desc' }, take: 100 })
  return <BoardsPage initialBoards={boards} />
}
