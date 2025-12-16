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
import {
  Loader2,
  ArrowLeft,
  Lock,
} from "lucide-react"

interface Board {
  id: string
  slug: string
  name: string
  useSecret: boolean
}

interface Post {
  id: string
  title: string
  content: string
  isSecret: boolean
}

export default function BoardEditPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const postId = params.postId as string

  const [board, setBoard] = useState<Board | null>(null)
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSecret, setIsSecret] = useState(false)

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/boards/${slug}/posts/${postId}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || '게시글을 불러올 수 없습니다.')
          return
        }

        setBoard(data.board)
        setPost(data.post)
        setTitle(data.post.title)
        setContent(data.post.content)
        setIsSecret(data.post.isSecret)
      } catch (error) {
        console.error('게시글 조회 에러:', error)
        setError('게시글을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [slug, postId])

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
      const response = await fetch(`/api/boards/${slug}/posts/${postId}`, {
        method: 'PUT',
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
          alert(data.error || '수정 권한이 없습니다.')
          return
        }
        alert(data.error || '수정에 실패했습니다.')
        return
      }

      // 수정 완료 후 게시글로 이동
      router.push(`/board/${slug}/${postId}`)
    } catch (error) {
      console.error('글 수정 에러:', error)
      alert('수정 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </UserLayout>
    )
  }

  if (error || !board || !post) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center py-20">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">{error || '게시글을 찾을 수 없습니다.'}</p>
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
            href={`/board/${slug}/${postId}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">글 수정</h1>
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
                  수정
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  )
}
