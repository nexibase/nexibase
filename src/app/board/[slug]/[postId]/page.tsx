"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { UserLayout } from "@/components/layout/UserLayout"
import {
  Loader2,
  ArrowLeft,
  Eye,
  ThumbsUp,
  MessageSquare,
  Lock,
  Pin,
  Pencil,
  Trash2,
  List,
  Send,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CommentReactions } from "@/components/comment/CommentReactions"

// 이모지 리액션 컴포넌트
const EmojiIcon = ({ emoji, className }: { emoji: string; className?: string }) => (
  <span className={cn("text-base leading-none", className)}>{emoji}</span>
)

// 리액션 타입 정의 (긍정적인 것만)
const REACTIONS = [
  { type: 'like', emoji: '👍', label: '좋아요', color: 'text-blue-500', bgActive: 'bg-blue-500 hover:bg-blue-600 ring-blue-500' },
  { type: 'haha', emoji: '😂', label: '웃겨요', color: 'text-yellow-500', bgActive: 'bg-yellow-500 hover:bg-yellow-600 ring-yellow-500 text-black' },
  { type: 'agree', emoji: '👌', label: '동의해요', color: 'text-green-500', bgActive: 'bg-green-500 hover:bg-green-600 ring-green-500' },
  { type: 'thanks', emoji: '🙏', label: '감사해요', color: 'text-pink-500', bgActive: 'bg-pink-500 hover:bg-pink-600 ring-pink-500' },
  { type: 'wow', emoji: '😮', label: '놀라워요', color: 'text-purple-500', bgActive: 'bg-purple-500 hover:bg-purple-600 ring-purple-500' },
] as const

interface Board {
  id: string
  slug: string
  name: string
  useComment: boolean
  useReaction: boolean
  commentLevel: number
}

interface Author {
  id: string
  nickname: string | null
  name: string
  image: string | null
  level?: number
}

interface Comment {
  id: string
  content: string
  createdAt: string
  author: Author
  replies?: Comment[]
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
  updatedAt: string
  author: Author
  comments?: Comment[]
}

interface AdjacentPost {
  id: string
  title: string
}

interface User {
  id: string
  nickname: string | null
  name: string
  level: number
  role: string
}

export default function PostPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const postId = params.postId as string

  const [board, setBoard] = useState<Board | null>(null)
  const [post, setPost] = useState<Post | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthor, setIsAuthor] = useState(false)
  const [reactions, setReactions] = useState<Record<string, number>>({})
  const [userReactions, setUserReactions] = useState<string[]>([])
  const [commentText, setCommentText] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const [userLevel, setUserLevel] = useState(0)
  const [prevPost, setPrevPost] = useState<AdjacentPost | null>(null)
  const [nextPost, setNextPost] = useState<AdjacentPost | null>(null)

  // 사용자 정보 조회
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/me')
      const data = await response.json()
      if (data.user) {
        setUser(data.user)
        setUserLevel(data.user.role === 'admin' ? 99 : data.user.level || 1)
      }
    } catch (error) {
      console.error('사용자 정보 조회 에러:', error)
    }
  }, [])

  // 리액션 조회
  const fetchReactions = useCallback(async () => {
    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}/reaction`)
      const data = await response.json()
      if (data.success) {
        setReactions(data.reactions || {})
        setUserReactions(data.userReactions || [])
      }
    } catch (error) {
      console.error('리액션 조회 에러:', error)
    }
  }, [slug, postId])

  // 게시글 조회
  const fetchPost = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setError(data.error || '이 글을 볼 권한이 없습니다.')
        } else if (response.status === 404) {
          setError('게시글을 찾을 수 없습니다.')
        } else {
          setError(data.error || '게시글을 불러올 수 없습니다.')
        }
        return
      }

      if (data.success) {
        setBoard(data.board)
        setPost(data.post)
        setIsAuthor(data.isAuthor)
        setPrevPost(data.prevPost || null)
        setNextPost(data.nextPost || null)
      }
    } catch (error) {
      console.error('게시글 조회 에러:', error)
      setError('게시글을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [slug, postId])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    fetchPost()
  }, [fetchPost])

  useEffect(() => {
    if (board?.useReaction) {
      fetchReactions()
    }
  }, [board, fetchReactions])

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 게시글 삭제
  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push(`/board/${slug}`)
      } else {
        const data = await response.json()
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('삭제 에러:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  // 리액션 토글
  const handleReaction = async (type: string) => {
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })

      const data = await response.json()

      if (response.ok) {
        setReactions(data.reactions || {})
        setUserReactions(data.userReactions || [])
      }
    } catch (error) {
      console.error('반응 에러:', error)
    }
  }

  // 댓글 작성
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!commentText.trim()) return

    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    setSubmittingComment(true)

    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() })
      })

      const data = await response.json()

      if (response.ok) {
        setCommentText("")
        fetchPost() // 댓글 목록 새로고침
      } else {
        alert(data.error || '댓글 작성에 실패했습니다.')
      }
    } catch (error) {
      console.error('댓글 작성 에러:', error)
      alert('댓글 작성 중 오류가 발생했습니다.')
    } finally {
      setSubmittingComment(false)
    }
  }

  // 총 리액션 수 계산
  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0)

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
              <Button variant="outline" onClick={() => router.push(`/board/${slug}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                목록으로
              </Button>
            </CardContent>
          </Card>
        </div>
      </UserLayout>
    )
  }

  if (!board || !post) {
    return null
  }

  const canComment = board.useComment && userLevel >= board.commentLevel
  const canEdit = isAuthor || userLevel >= 9

  return (
    <UserLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 게시판 네비게이션 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/board/${slug}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h2 className="text-lg font-semibold">{board.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!nextPost}
              onClick={() => nextPost && router.push(`/board/${slug}/${nextPost.id}`)}
              title={nextPost ? nextPost.title : '이전 글이 없습니다'}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              이전글
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!prevPost}
              onClick={() => prevPost && router.push(`/board/${slug}/${prevPost.id}`)}
              title={prevPost ? prevPost.title : '다음 글이 없습니다'}
            >
              다음글
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Link href={`/board/${slug}`}>
              <Button variant="outline" size="sm">
                <List className="h-4 w-4 mr-1" />
                목록
              </Button>
            </Link>
          </div>
        </div>

        {/* 게시글 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            {/* 제목 */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                {post.isNotice && (
                  <Badge variant="destructive">
                    <Pin className="h-3 w-3 mr-1" />
                    공지
                  </Badge>
                )}
                {post.isSecret && (
                  <Badge variant="secondary">
                    <Lock className="h-3 w-3 mr-1" />
                    비밀글
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold">{post.title}</h1>
            </div>

            {/* 작성자 정보 */}
            <div className="flex items-center justify-between py-3 border-y mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                  {post.author.image ? (
                    <img
                      src={post.author.image}
                      alt={post.author.nickname || post.author.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground font-medium">
                      {(post.author.nickname || post.author.name).charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-medium">
                    {post.author.nickname || post.author.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(post.createdAt)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {post.viewCount}
                </span>
                {board.useReaction && (
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4" />
                    {totalReactions}
                  </span>
                )}
                {board.useComment && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {post.commentCount}
                  </span>
                )}
              </div>
            </div>

            {/* 본문 */}
            <div
              className="prose dark:prose-invert max-w-none mb-6"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* 리액션 버튼들 */}
            {board.useReaction && (
              <div className="flex flex-wrap items-center gap-2 py-4 border-t">
                {REACTIONS.map(({ type, emoji, label, bgActive }) => {
                  const count = reactions[type] || 0
                  const isActive = userReactions.includes(type)

                  return (
                    <Button
                      key={type}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleReaction(type)}
                      className={cn(
                        "gap-1.5 transition-all",
                        isActive && "ring-2 ring-offset-2 ring-offset-background",
                        isActive && bgActive,
                      )}
                    >
                      <EmojiIcon emoji={emoji} />
                      <span className="text-xs">{label}</span>
                      {count > 0 && (
                        <span className={cn(
                          "ml-1 px-1.5 py-0.5 rounded-full text-xs font-medium",
                          isActive ? "bg-white/20" : "bg-muted"
                        )}>
                          {count}
                        </span>
                      )}
                    </Button>
                  )
                })}
              </div>
            )}

            {/* 수정/삭제 */}
            {canEdit && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/board/${slug}/${postId}/edit`)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  수정
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  삭제
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 댓글 */}
        {board.useComment && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                댓글 {post.comments?.length || 0}
              </h3>

              {/* 댓글 목록 */}
              {post.comments && post.comments.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0">
                          <span className="text-muted-foreground text-sm font-medium">
                            {(comment.author.nickname || comment.author.name).charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {comment.author.nickname || comment.author.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {comment.content}
                          </p>

                          {/* 댓글 리액션 */}
                          {board.useReaction && (
                            <CommentReactions
                              slug={slug}
                              postId={postId}
                              commentId={comment.id}
                              isLoggedIn={!!user}
                            />
                          )}

                          {/* 대댓글 */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="mt-3 pl-4 border-l-2 space-y-3">
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="flex items-start gap-2">
                                  <div className="w-6 h-6 bg-muted/50 rounded-full flex items-center justify-center shrink-0">
                                    <span className="text-muted-foreground text-xs font-medium">
                                      {(reply.author.nickname || reply.author.name).charAt(0)}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-xs">
                                        {reply.author.nickname || reply.author.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatDate(reply.createdAt)}
                                      </span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">
                                      {reply.content}
                                    </p>

                                    {/* 대댓글 리액션 */}
                                    {board.useReaction && (
                                      <CommentReactions
                                        slug={slug}
                                        postId={postId}
                                        commentId={reply.id}
                                        isLoggedIn={!!user}
                                      />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground mb-6">
                  댓글이 없습니다.
                </div>
              )}

              {/* 댓글 작성 */}
              {canComment ? (
                <form onSubmit={handleCommentSubmit} className="flex gap-2">
                  <Input
                    placeholder="댓글을 입력하세요"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={submittingComment || !commentText.trim()}>
                    {submittingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              ) : user ? (
                <div className="text-center text-sm text-muted-foreground">
                  댓글을 쓰려면 레벨 {board.commentLevel} 이상이 필요합니다.
                </div>
              ) : (
                <div className="text-center">
                  <Link href="/login" className="text-primary hover:underline text-sm">
                    로그인하면 댓글을 쓸 수 있습니다.
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </UserLayout>
  )
}
