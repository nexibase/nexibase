import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import BoardListPage from "@/features/boards/components/BoardListPage"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const board = await prisma.board.findUnique({ where: { slug }, select: { name: true, description: true } })
  if (!board) return {}
  const title = board.name
  const description = board.description || `${board.name} 게시판`
  return {
    title,
    description,
    openGraph: { title, description, url: `https://nexibase.com/boards/${slug}` },
    twitter: { title, description },
    alternates: { canonical: `https://nexibase.com/boards/${slug}` },
  }
}

export default function Page() {
  return <BoardListPage />
}
