import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import BoardPostPage from "@/features/boards/components/BoardPostPage"

async function getPost(postId: string) {
  return prisma.post.findUnique({
    where: { id: Number(postId) },
    select: { title: true, content: true, createdAt: true, updatedAt: true, author: { select: { name: true } }, board: { select: { name: true } } },
  })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; postId: string }> }): Promise<Metadata> {
  const { slug, postId } = await params
  const post = await getPost(postId)
  if (!post) return {}
  const title = post.title
  const description = post.content.replace(/<[^>]*>/g, "").slice(0, 160)
  return {
    title,
    description,
    openGraph: { title, description, url: `https://nexibase.com/boards/${slug}/${postId}`, type: "article" },
    twitter: { title, description },
    alternates: { canonical: `https://nexibase.com/boards/${slug}/${postId}` },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = await params
  const post = await getPost(postId)

  const jsonLd = post ? {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.content.replace(/<[^>]*>/g, "").slice(0, 160),
    author: { "@type": "Person", name: post.author?.name || "익명" },
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url: `https://nexibase.com/boards/${slug}/${postId}`,
    publisher: { "@type": "Organization", name: "NexiBase", url: "https://nexibase.com" },
  } : null

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <BoardPostPage />
    </>
  )
}
