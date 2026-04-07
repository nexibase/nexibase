"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserLayout } from "@/components/layout/UserLayout"
import { UserNickname } from "@/components/UserNickname"
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ThumbsUp,
  Lock,
  Pin,
  PenSquare,
  Home,
  ImageIcon,
  Paperclip,
} from "lucide-react"

interface Board {
  id: string
  slug: string
  name: string
  description: string | null
  listMemberOnly: boolean
  readMemberOnly: boolean
  writeMemberOnly: boolean
  commentMemberOnly: boolean
  useComment: boolean
  useReaction: boolean
  postsPerPage: number
  displayType: string
}

interface Post {
  id: string
  title: string
  content: string
  viewCount: number
  likeCount: number
  commentCount: number
  isNotice: boolean
  isSecret: boolean
  createdAt: string
  thumbnail?: string | null
  _count?: { attachments: number }
  author: {
    id: string
    uuid?: string
    nickname: string | null
    name: string
    image: string | null
  }
}

interface User {
  id: string
  nickname: string | null
  name: string
  role?: string
}

export default function BoardListPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [board, setBoard] = useState<Board | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [notices, setNotices] = useState<Post[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const isLoggedIn = !!user
  const isAdmin = user?.role === 'admin'

  // 사용자 정보 조회
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/me')
      const data = await response.json()
      if (data.user) {
        setUser(data.user)
      }
    } catch (error) {
      console.error('사용자 정보 조회 에러:', error)
    }
  }, [])

  // 게시글 목록 조회
  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString()
      })

      const response = await fetch(`/api/boards/${slug}/posts?${params}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setError(data.requireLogin ? '이 게시판을 보려면 로그인이 필요합니다.' : (data.error || '권한이 없습니다.'))
        } else if (response.status === 404) {
          setError('게시판을 찾을 수 없습니다.')
        } else {
          setError(data.error || '게시판을 불러올 수 없습니다.')
        }
        return
      }

      if (data.success) {
        setBoard(data.board)
        setPosts(data.posts)
        setNotices(data.notices || [])
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('게시글 목록 조회 에러:', error)
      setError('게시판을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [slug, page])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays < 7) {
      return `${diffDays}일 전`
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    }
  }

  // 게시글 클릭
  const handlePostClick = (post: Post, e?: React.MouseEvent) => {
    if (e && (e.target as HTMLElement).closest('[data-user-nickname]')) return
    if (post.isSecret && post.author.id !== user?.id && !isAdmin) {
      alert('비밀글입니다.')
      return
    }
    router.push(`/boards/${slug}/${post.id}`)
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

  if (error) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center py-20">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => router.push('/')}>
                  <Home className="h-4 w-4 mr-2" />
                  홈으로
                </Button>
                {!user && (
                  <Button onClick={() => router.push('/login')}>
                    로그인
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </UserLayout>
    )
  }

  if (!board) {
    return null
  }

  // 글쓰기 권한: 회원전용이면 로그인 필요, 아니면 누구나 가능
  const canWrite = board.writeMemberOnly ? isLoggedIn : true

  return (
    <UserLayout>
      <div className="max-w-4xl mx-auto sm:px-4 py-2 sm:py-6">
        {/* 게시판 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{board.name}</h1>
              {board.description && (
                <p className="text-muted-foreground mt-1">{board.description}</p>
              )}
            </div>
            {canWrite && (
              <Button onClick={() => router.push(`/boards/${slug}/create`)}>
                <PenSquare className="h-4 w-4 mr-2" />
                글쓰기
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {/* 공지사항 */}
            {notices.length > 0 && (
              <div className="border-b bg-muted/30">
                {notices.map((post) => (
                  <div
                    key={post.id}
                    onClick={(e) => handlePostClick(post, e)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
                  >
                    <Badge variant="destructive" className="shrink-0">
                      <Pin className="h-3 w-3 mr-1" />
                      공지
                    </Badge>
                    <span className="font-medium truncate flex-1">
                      {post.title}
                    </span>
                    <span className="text-sm text-muted-foreground shrink-0">
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 게시글 목록 */}
            {posts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                게시글이 없습니다.
              </div>
            ) : board.displayType === 'gallery' ? (
              /* 갤러리 뷰 */
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={(e) => handlePostClick(post, e)}
                      className="group cursor-pointer"
                    >
                      {/* 썸네일 */}
                      <div className="aspect-square relative rounded-lg overflow-hidden bg-muted mb-2">
                        {post.thumbnail ? (
                          <img
                            src={post.thumbnail}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                        )}
                        {post.isSecret && (
                          <div className="absolute top-2 left-2">
                            <Lock className="h-4 w-4 text-yellow-500 drop-shadow-md" />
                          </div>
                        )}
                      </div>
                      {/* 정보 */}
                      <div className="space-y-1">
                        <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {post.title}
                          {post.commentCount > 0 && board.useComment && (
                            <span className="text-primary ml-1">[{post.commentCount}]</span>
                          )}
                          {post._count && post._count.attachments > 0 && (
                            <Paperclip className="h-3 w-3 text-muted-foreground ml-1 inline" />
                          )}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{post.author.nickname}</span>
                          <span className="flex items-center gap-0.5">
                            <Eye className="h-3 w-3" />
                            {post.viewCount}
                          </span>
                          {board.useReaction && post.likeCount > 0 && (
                            <span className="flex items-center gap-0.5">
                              <ThumbsUp className="h-3 w-3" />
                              {post.likeCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* 목록 뷰 */
              <div>
                {/* 데스크톱 헤더 */}
                <div className="hidden md:flex items-center px-4 py-2 border-b text-xs text-muted-foreground font-medium">
                  <div className="flex-1">제목</div>
                  <div className="w-28 text-left pl-2">작성자</div>
                  <div className="w-24 text-center">날짜</div>
                  <div className="w-16 text-center">조회</div>
                  {board.useReaction && <div className="w-16 text-center">추천</div>}
                </div>
                {posts.map((post) => {
                  const postUrl = post.isSecret && post.author.id !== user?.id && !isAdmin ? '#' : `/boards/${slug}/${post.id}`
                  return (
                  <div
                    key={post.id}
                    className="flex items-center px-4 py-3 border-b last:border-b-0"
                  >
                    {/* 모바일: 기존 스택 레이아웃 */}
                    <div className="flex-1 min-w-0 md:hidden">
                      <div className="flex items-center gap-2 mb-1">
                        {post.isNotice && <Pin className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                        {post.isSecret && <Lock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                        <Link href={postUrl} className="font-medium text-sm truncate hover:text-primary">{post.title}</Link>
                        {post.commentCount > 0 && board.useComment && (
                          <span className="text-xs text-primary">[{post.commentCount}]</span>
                        )}
                        {post._count && post._count.attachments > 0 && (
                          <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <UserNickname userId={post.author.id} uuid={post.author.uuid} nickname={post.author.nickname} image={post.author.image} showAvatar />
                        <span>{formatDate(post.createdAt)}</span>
                        <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{post.viewCount}</span>
                      </div>
                    </div>
                    {/* 데스크톱: 테이블 레이아웃 */}
                    <div className="hidden md:flex md:items-center md:flex-1 md:min-w-0">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        {post.isNotice && <Badge variant="outline" className="shrink-0 text-xs px-1.5 py-0 text-orange-500 border-orange-500">공지</Badge>}
                        {post.isSecret && <Lock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                        <Link href={postUrl} className="font-medium text-sm truncate hover:text-primary">{post.title}</Link>
                        {post.commentCount > 0 && board.useComment && (
                          <span className="text-sm text-primary shrink-0">[{post.commentCount}]</span>
                        )}
                        {post._count && post._count.attachments > 0 && (
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <div className="w-28 text-left pl-2">
                        <UserNickname userId={post.author.id} uuid={post.author.uuid} nickname={post.author.nickname} image={post.author.image} showAvatar className="text-muted-foreground" />
                      </div>
                      <div className="w-24 text-center text-xs text-muted-foreground">{formatDate(post.createdAt)}</div>
                      <div className="w-16 text-center text-xs text-muted-foreground">{post.viewCount}</div>
                      {board.useReaction && <div className="w-16 text-center text-xs text-muted-foreground">{post.likeCount}</div>}
                    </div>
                  </div>
                  )
                })}
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 py-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 글쓰기 버튼 (하단) */}
        {canWrite && posts.length > 0 && (
          <div className="flex justify-end mt-4">
            <Button onClick={() => router.push(`/boards/${slug}/create`)}>
              <PenSquare className="h-4 w-4 mr-2" />
              글쓰기
            </Button>
          </div>
        )}

        {!canWrite && board.writeMemberOnly && (
          <div className="mt-4 text-center">
            <Link href="/login" className="text-primary hover:underline text-sm">
              글을 쓰려면 로그인이 필요합니다.
            </Link>
          </div>
        )}
      </div>
    </UserLayout>
  )
}
