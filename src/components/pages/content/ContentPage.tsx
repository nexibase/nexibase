"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, FileText, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header, Footer } from "@/components/layout"
import Link from "next/link"
import { sanitizeHtml } from "@/lib/sanitize"

interface Content {
  id: number
  slug: string
  title: string
  content: string
  updatedAt: string
}

export default function ContentPage() {
  const params = useParams()
  const slug = params.slug as string

  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(`/api/content/${slug}`)
        const data = await response.json()

        if (response.ok) {
          setContent(data.content)
        } else {
          setError(data.error || '콘텐츠를 불러올 수 없습니다.')
        }
      } catch (err) {
        console.error('콘텐츠 조회 에러:', err)
        setError('콘텐츠를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchContent()
    }
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center py-20">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="pt-6 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button asChild variant="outline">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  홈으로 돌아가기
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    )
  }

  if (!content) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 container max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{content.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              마지막 수정: {new Date(content.updatedAt).toLocaleDateString('ko-KR')}
            </p>
          </CardHeader>
          <CardContent>
            <div
              className="prose dark:prose-invert prose-sm sm:prose-base max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.content) }}
            />
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              홈으로 돌아가기
            </Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  )
}
