"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, FileText, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { sanitizeHtml } from "@/lib/sanitize"
import { useTranslations, useLocale } from 'next-intl'

interface Content {
  id: number
  slug: string
  title: string
  content: string
  updatedAt: string
}

export default function ContentPage() {
  const t = useTranslations('contents')
  const locale = useLocale()
  const params = useParams()
  const slug = params.slug as string

  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(`/api/contents/${slug}?locale=${locale}`)
        const data = await response.json()

        if (response.ok) {
          setContent(data.content)
        } else {
          setError(data.error || t('loadFailed'))
        }
      } catch (err) {
        console.error('콘텐츠 조회 에러:', err)
        setError(t('loadError'))
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchContent()
    }
  }, [slug, t, locale])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('backHome')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!content) {
    return null
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{content.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('lastModified')}: {new Date(content.updatedAt).toLocaleDateString()}
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
            {t('backHome')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
