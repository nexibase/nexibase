import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import ContentPage from "@/features/contents/components/ContentPage"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const content = await prisma.content.findUnique({ where: { slug }, select: { title: true, content: true } })
  if (!content) return {}
  const title = content.title
  const description = content.content.replace(/<[^>]*>/g, "").slice(0, 160)
  return {
    title,
    description,
    openGraph: { title, description, url: `https://nexibase.com/contents/${slug}` },
    twitter: { title, description },
    alternates: { canonical: `https://nexibase.com/contents/${slug}` },
  }
}

export default function Page() {
  return <ContentPage />
}
