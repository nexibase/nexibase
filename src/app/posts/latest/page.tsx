"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UserNickname } from "@/components/UserNickname"
import { FileText, Eye, MessageSquare, ThumbsUp, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

interface Post {
  id: number
  title: string
  viewCount: number
  likeCount: number
  commentCount: number
  createdAt: string
  board: { slug: string; name: string }
  author: { id: number; uuid: string; nickname: string; image: string | null }
}

export default function Page() {
  return <Suspense><NewPostsPage /></Suspense>
}

function NewPostsPage() {
  const searchParams = useSearchParams()
  const uuid = searchParams.get('uuid')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [member, setMember] = useState<{ nickname: string; image: string | null } | null>(null)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (uuid) params.set('uuid', uuid)
    fetch(`/api/posts/latest?${params}`)
      .then(r => r.json())
      .then(data => {
        setPosts(data.posts || [])
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

  return (
    <div className="max-w-4xl mx-auto sm:px-4 py-4 sm:py-6">
      <div className="flex items-center justify-between mb-4 px-2 sm:px-0">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">
            {member ? `${member.nickname}님의 작성글` : '최신 작성글'}
          </h1>
        </div>
        {uuid && (
          <Link href="/posts/latest">
            <Button variant="outline" size="sm">전체글 보기</Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : posts.length > 0 ? (
        <Card className="rounded-none sm:rounded-lg">
          <CardContent className="p-0">
            <div className="hidden sm:flex items-center px-4 py-2 border-b text-xs text-muted-foreground font-medium">
              <div className="w-20">게시판</div>
              <div className="flex-1">제목</div>
              {!uuid && <div className="w-24 text-left">작성자</div>}
              <div className="w-20 text-center">날짜</div>
              <div className="w-12 text-center">조회</div>
              <div className="w-12 text-center">추천</div>
            </div>
            {posts.map(post => (
              <div key={post.id} className="flex items-center px-4 py-3 border-b last:border-b-0 hover:bg-muted/30">
                {/* 모바일 */}
                <div className="flex-1 min-w-0 sm:hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground shrink-0">{post.board.name}</span>
                    <Link href={`/boards/${post.board.slug}/${post.id}`} className="font-medium text-sm truncate hover:text-primary">{post.title}</Link>
                    {post.commentCount > 0 && <span className="text-xs text-primary">[{post.commentCount}]</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {!uuid && <UserNickname userId={post.author.id} uuid={post.author.uuid} nickname={post.author.nickname} image={post.author.image} showAvatar />}
                    <span>{formatDate(post.createdAt)}</span>
                    <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{post.viewCount}</span>
                  </div>
                </div>
                {/* 데스크톱 */}
                <div className="hidden sm:flex sm:items-center sm:flex-1 sm:min-w-0">
                  <div className="w-20 text-xs text-muted-foreground truncate">{post.board.name}</div>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <Link href={`/boards/${post.board.slug}/${post.id}`} className="font-medium text-sm truncate hover:text-primary">{post.title}</Link>
                    {post.commentCount > 0 && <span className="text-sm text-primary shrink-0">[{post.commentCount}]</span>}
                  </div>
                  {!uuid && (
                    <div className="w-24 text-left">
                      <UserNickname userId={post.author.id} uuid={post.author.uuid} nickname={post.author.nickname} image={post.author.image} showAvatar className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="w-20 text-center text-xs text-muted-foreground">{formatDate(post.createdAt)}</div>
                  <div className="w-12 text-center text-xs text-muted-foreground">{post.viewCount}</div>
                  <div className="w-12 text-center text-xs text-muted-foreground">{post.likeCount}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="py-12 text-center text-muted-foreground">작성글이 없습니다.</div>
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
