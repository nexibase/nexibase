"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, FileText, ArrowLeft, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { sanitizeHtml } from "@/lib/sanitize"

interface Policy {
  id: number
  slug: string
  version: string
  title: string
  content: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface VersionInfo {
  version: string
  isActive: boolean
  createdAt: string
}

export default function PolicyPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const version = searchParams.get('v')

  const [policy, setPolicy] = useState<Policy | null>(null)
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const url = version
          ? `/api/policies/${slug}?v=${version}`
          : `/api/policies/${slug}`

        const response = await fetch(url)
        const data = await response.json()

        if (response.ok) {
          setPolicy(data.policy)
          setVersions(data.versions || [])
        } else {
          setError(data.error || '약관을 불러올 수 없습니다.')
        }
      } catch (err) {
        console.error('약관 조회 에러:', err)
        setError('약관을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchPolicy()
    }
  }, [slug, version])

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
                홈으로 돌아가기
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!policy) {
    return null
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{policy.title}</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">v{policy.version}</Badge>
                {policy.isActive ? (
                  <Badge className="bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-400">
                    현재 적용 중
                  </Badge>
                ) : (
                  <Badge variant="secondary">이전 버전</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                시행일: {new Date(policy.createdAt).toLocaleDateString('ko-KR')}
              </p>
            </div>

            {versions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVersions(!showVersions)}
              >
                <History className="h-4 w-4 mr-2" />
                버전 히스토리
              </Button>
            )}
          </div>

          {/* 버전 히스토리 */}
          {showVersions && versions.length > 1 && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">버전 히스토리</p>
              <div className="space-y-2">
                {versions.map((v) => (
                  <Link
                    key={v.version}
                    href={`/policies/${slug}?v=${v.version}`}
                    className={`block p-2 rounded hover:bg-background transition-colors ${
                      v.version === policy.version ? 'bg-background ring-1 ring-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">v{v.version}</span>
                        {v.isActive && (
                          <Badge className="bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-400 text-xs">
                            현재
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div
            className="prose dark:prose-invert prose-sm sm:prose-base max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(policy.content) }}
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
  )
}
