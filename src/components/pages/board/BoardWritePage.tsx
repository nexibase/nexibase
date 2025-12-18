"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { UserLayout } from "@/components/layout/UserLayout"
import { TiptapEditor } from "@/components/editor/TiptapEditor"
import { useSession } from "@/components/providers/SessionProvider"
import {
  Loader2,
  ArrowLeft,
  Lock,
} from "lucide-react"

interface Board {
  id: string
  slug: string
  name: string
  writeMemberOnly: boolean
  useSecret: boolean
}

export default function BoardWritePage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const { user, loading: sessionLoading } = useSession()

  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSecret, setIsSecret] = useState(false)

  // 로그인 체크 - 글쓰기는 회원만 가능
  useEffect(() => {
    if (!sessionLoading && !user) {
      alert('로그인이 필요합니다.')
      router.push(`/login?callbackUrl=/board/${slug}/write`)
    }
  }, [sessionLoading, user, router, slug])

  useEffect(() => {
    // 로그인 체크 후에 게시판 정보 로드
    if (sessionLoading || !user) return

    const fetchBoard = async () => {
      try {
        const response = await fetch(`/api/boards/${slug}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || '게시판 정보를 불러올 수 없습니다.')
          return
        }

        setBoard(data.board)
      } catch (error) {
        console.error('게시판 조회 에러:', error)
        setError('게시판 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchBoard()
  }, [slug, sessionLoading, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    if (!content.trim()) {
      alert('내용을 입력해주세요.')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/boards/${slug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          isSecret
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          alert('로그인이 필요합니다.')
          router.push('/login')
          return
        }
        if (response.status === 403) {
          alert(data.error || '글을 쓸 권한이 없습니다.')
          return
        }
        alert(data.error || '글 작성에 실패했습니다.')
        return
      }

      // 작성 완료 후 게시글로 이동
      router.push(`/board/${slug}/${data.post.id}`)
    } catch (error) {
      console.error('글 작성 에러:', error)
      alert('글 작성 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // 세션 로딩 중이거나 비로그인 상태면 로딩 표시 (리다이렉트 중)
  if (sessionLoading || !user || loading) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </UserLayout>
    )
  }

  if (error || !board) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center py-20">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">{error || '게시판을 찾을 수 없습니다.'}</p>
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </UserLayout>
    )
  }

  return (
    <UserLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 페이지 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/board/${slug}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">글쓰기</h1>
            <p className="text-sm text-muted-foreground">{board.name}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">
                  제목 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  내용 <span className="text-destructive">*</span>
                </Label>
                <TiptapEditor
                  content={content}
                  onChange={setContent}
                  placeholder="내용을 입력하세요..."
                />
              </div>

              {board.useSecret && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isSecret"
                    checked={isSecret}
                    onCheckedChange={(checked) => setIsSecret(checked === true)}
                  />
                  <Label htmlFor="isSecret" className="flex items-center gap-1 cursor-pointer">
                    <Lock className="h-4 w-4" />
                    비밀글
                  </Label>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  취소
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  등록
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  )
}
