"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UserNickname } from "@/components/UserNickname"
import { MessageSquare, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

interface Comment {
  id: number
  content: string
  createdAt: string
  post: {
    id: number
    title: string
    board: { slug: string; name: string }
  }
  author: { id: number; uuid: string; nickname: string; image: string | null }
}

export default function Page() {
  return <Suspense><NewCommentsPage /></Suspense>
}

function NewCommentsPage() {
  const searchParams = useSearchParams()
  const uuid = searchParams.get('uuid')
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [member, setMember] = useState<{ nickname: string; image: string | null } | null>(null)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (uuid) params.set('uuid', uuid)
    fetch(`/api/new/comments?${params}`)
      .then(r => r.json())
      .then(data => {
        setComments(data.comments || [])
        setTotalPages(data.totalPages || 1)
        if (data.member) setMember(data.member)
      })
      .finally(() => setLoading(false))
  }, [page, uuid])

  const formatDate = (d: string) => {
    const date = new Date(d)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    return isToday
      ? date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
  }

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').slice(0, 100)

  return (
    <div className="max-w-4xl mx-auto sm:px-4 py-4 sm:py-6">
      <div className="flex items-center justify-between mb-4 px-2 sm:px-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">
            {member ? `${member.nickname}님의 작성댓글` : '최신 댓글'}
          </h1>
        </div>
        {uuid && (
          <Link href="/new/comments">
            <Button variant="outline" size="sm">전체댓글 보기</Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : comments.length > 0 ? (
        <Card className="rounded-none sm:rounded-lg">
          <CardContent className="p-0">
            {comments.map(comment => (
              <div key={comment.id} className="px-4 py-3 border-b last:border-b-0 hover:bg-muted/30">
                <Link
                  href={`/boards/${comment.post.board.slug}/${comment.post.id}`}
                  className="text-sm font-medium hover:text-primary inline-flex items-center gap-1.5 mb-1.5"
                >
                  <span className="text-xs text-muted-foreground shrink-0">[{comment.post.board.name}]</span>
                  <span className="truncate">{comment.post.title}</span>
                </Link>
                <p className="text-sm text-muted-foreground mb-1.5 pl-1 border-l-2 border-muted ml-1">{stripHtml(comment.content)}</p>
                <div className="flex items-center gap-2">
                  {!uuid && <UserNickname userId={comment.author.id} uuid={comment.author.uuid} nickname={comment.author.nickname} image={comment.author.image} showAvatar />}
                  <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="py-12 text-center text-muted-foreground">작성댓글이 없습니다.</div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
