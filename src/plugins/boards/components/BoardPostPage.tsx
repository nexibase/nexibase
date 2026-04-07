"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { UserLayout } from "@/components/layout/UserLayout"
import { sanitizeHtml } from "@/lib/sanitize"
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
  Paperclip,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  Reply,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CommentReactions } from "@/plugins/boards/components/CommentReactions"

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
  useFile: boolean
  commentMemberOnly: boolean
  displayType: string
}

interface Attachment {
  id: number
  filename: string
  filePath: string
  thumbnailPath?: string | null
  fileSize: number
  mimeType: string
  downloadCount: number
}

interface Author {
  id: string
  nickname: string | null
  name: string
  image: string | null
}

interface Comment {
  id: string
  content: string
  createdAt: string
  parentId: string | null
  author: Author
  parent?: { author: { nickname: string | null } } | null
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
  attachments?: Attachment[]
}

// 파일 크기 포맷
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 파일 아이콘 선택
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.includes('pdf')) return '📕'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📘'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📙'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦'
  return '📄'
}

// 이미지 뷰어 모달 컴포넌트
interface ImageViewerProps {
  images: Attachment[]
  initialIndex: number
  onClose: () => void
}

function ImageViewer({ images, initialIndex, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)

  const currentImage = images[currentIndex]

  // 키보드 이벤트 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          // 처음이면 마지막으로
          setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1)
          setScale(1)
          break
        case 'ArrowRight':
          // 마지막이면 처음으로
          setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1)
          setScale(1)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [images.length, onClose])

  const handlePrev = () => {
    // 처음이면 마지막으로
    setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1)
    setScale(1)
  }

  const handleNext = () => {
    // 마지막이면 처음으로
    setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1)
    setScale(1)
  }

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 3))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.5, 0.5))
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* 상단 툴바 */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent z-10">
        <div className="text-white text-sm">
          <span className="font-medium">{currentIndex + 1}</span>
          <span className="text-white/60"> / {images.length}</span>
          <span className="ml-4 text-white/80 truncate max-w-[200px] md:max-w-[400px] inline-block align-middle">
            {currentImage.filename}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="text-white hover:bg-white/20"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="text-white text-sm min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="text-white hover:bg-white/20"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <a
            href={currentImage.filePath}
            download={currentImage.filename}
            className="p-2 text-white hover:bg-white/20 rounded-md transition-colors"
          >
            <Download className="h-5 w-5" />
          </a>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* 이전 버튼 */}
      {images.length > 1 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12 z-10"
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* 이미지 */}
      <div className="flex items-center justify-center w-full h-full p-16 overflow-auto">
        <img
          src={currentImage.filePath}
          alt={currentImage.filename}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
          draggable={false}
        />
      </div>

      {/* 다음 버튼 */}
      {images.length > 1 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12 z-10"
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* 하단 썸네일 */}
      {images.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
          <div className="flex items-center justify-center gap-2 overflow-x-auto py-2">
            {images.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => {
                  setCurrentIndex(idx)
                  setScale(1)
                }}
                className={cn(
                  "w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                  idx === currentIndex
                    ? "border-white ring-2 ring-white/50"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <img
                  src={img.filePath}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface AdjacentPost {
  id: string
  title: string
}

interface User {
  id: string
  nickname: string | null
  name: string
  role: string
}

export default function BoardPostPage() {
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
  const [replyTo, setReplyTo] = useState<{ id: string; nickname: string } | null>(null)
  const [prevPost, setPrevPost] = useState<AdjacentPost | null>(null)
  const [nextPost, setNextPost] = useState<AdjacentPost | null>(null)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [imageViewerIndex, setImageViewerIndex] = useState(0)

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
        router.push(`/boards/${slug}`)
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
        body: JSON.stringify({ content: commentText.trim(), parentId: replyTo?.id || null })
      })

      const data = await response.json()

      if (response.ok) {
        setCommentText("")
        setReplyTo(null)
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
              <Button variant="outline" onClick={() => router.push(`/boards/${slug}`)}>
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

  // 댓글 권한: 회원전용이면 로그인 필요, 아니면 누구나 가능
  const canComment = board.useComment && (board.commentMemberOnly ? isLoggedIn : true)
  const canEdit = isAuthor || isAdmin

  return (
    <UserLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 게시판 네비게이션 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/boards/${slug}`}
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
              onClick={() => nextPost && router.push(`/boards/${slug}/${nextPost.id}`)}
              title={nextPost ? nextPost.title : '이전 글이 없습니다'}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              이전글
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!prevPost}
              onClick={() => prevPost && router.push(`/boards/${slug}/${prevPost.id}`)}
              title={prevPost ? prevPost.title : '다음 글이 없습니다'}
            >
              다음글
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Link href={`/boards/${slug}`}>
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
                      alt={post.author.nickname || ''}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground font-medium">
                      {(post.author.nickname || '?').charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-medium">
                    {post.author.nickname || '익명'}
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
              className="tiptap prose dark:prose-invert max-w-none mb-6"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
            />

            {/* 갤러리 형식: 이미지 갤러리 */}
            {board.displayType === 'gallery' && board.useFile && post.attachments && (() => {
              const imageAttachments = post.attachments.filter(f => f.mimeType.startsWith('image/'))
              if (imageAttachments.length === 0) return null
              return (
                <div className="mb-6">
                  <div className={`grid gap-2 ${
                    imageAttachments.length === 1 ? 'grid-cols-1' :
                    imageAttachments.length === 2 ? 'grid-cols-2' :
                    'grid-cols-2 md:grid-cols-3'
                  }`}>
                    {imageAttachments.map((file, index) => (
                      <button
                        key={file.id}
                        onClick={() => {
                          setImageViewerIndex(index)
                          setImageViewerOpen(true)
                        }}
                        className="block aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <img
                          src={file.thumbnailPath || file.filePath}
                          alt={file.filename}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* 첨부파일 */}
            {board.useFile && post.attachments && post.attachments.length > 0 && (() => {
              const imageAttachments = post.attachments.filter(f => f.mimeType.startsWith('image/'))
              return (
                <div className="border rounded-lg p-4 mb-6 bg-muted/30">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    첨부파일 ({post.attachments.length})
                  </h4>
                  <div className="space-y-2">
                    {post.attachments.map((file) => {
                      const isImage = file.mimeType.startsWith('image/')
                      const imageIndex = isImage ? imageAttachments.findIndex(img => img.id === file.id) : -1

                      if (isImage) {
                        return (
                          <div
                            key={file.id}
                            className="flex items-center p-2 rounded hover:bg-muted transition-colors group"
                          >
                            <button
                              onClick={() => {
                                setImageViewerIndex(imageIndex)
                                setImageViewerOpen(true)
                              }}
                              className="flex items-center gap-3 min-w-0 flex-1 text-left"
                            >
                              <div className="w-8 h-8 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
                                <img
                                  src={file.thumbnailPath || file.filePath}
                                  alt={file.filename}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                  {file.filename}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(file.fileSize)}
                                  {file.downloadCount > 0 && ` · 다운로드 ${file.downloadCount}회`}
                                </p>
                              </div>
                            </button>
                            <a
                              href={file.filePath}
                              download={file.filename}
                              className="w-8 h-8 shrink-0 flex items-center justify-center hover:bg-muted-foreground/10 rounded transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </a>
                          </div>
                        )
                      }

                      return (
                        <a
                          key={file.id}
                          href={file.filePath}
                          download={file.filename}
                          className="flex items-center p-2 rounded hover:bg-muted transition-colors group"
                        >
                          <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                            <span className="text-xl">{getFileIcon(file.mimeType)}</span>
                          </div>
                          <div className="min-w-0 flex-1 ml-3">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {file.filename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.fileSize)}
                              {file.downloadCount > 0 && ` · 다운로드 ${file.downloadCount}회`}
                            </p>
                          </div>
                          <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                            <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

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
                  onClick={() => router.push(`/boards/${slug}/${postId}/edit`)}
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
                <div className="space-y-1 mb-6">
                  {(() => {
                    const rootComments = post.comments.filter(c => !c.parentId)
                    const replies = post.comments.filter(c => c.parentId)
                    const replyMap = new Map<string, Comment[]>()
                    for (const r of replies) {
                      // 최상위 부모를 찾아서 그 아래에 배치
                      let rootId = r.parentId!
                      const findRoot = (id: string): string => {
                        const parent = post.comments!.find(c => c.id === id)
                        return parent?.parentId ? findRoot(parent.parentId) : id
                      }
                      rootId = findRoot(rootId)
                      if (!replyMap.has(rootId)) replyMap.set(rootId, [])
                      replyMap.get(rootId)!.push(r)
                    }

                    return rootComments.map((comment) => (
                      <div key={comment.id}>
                        {/* 원댓글 */}
                        <div className="border-b py-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0">
                              <span className="text-muted-foreground text-sm font-medium">
                                {(comment.author.nickname || '?').charAt(0)}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{comment.author.nickname || '익명'}</span>
                                <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {board.useReaction && (
                                  <CommentReactions slug={slug} postId={postId} commentId={comment.id} isLoggedIn={!!user} />
                                )}
                                {canComment && (
                                  <button
                                    onClick={() => setReplyTo({ id: comment.id, nickname: comment.author.nickname || '익명' })}
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                  >
                                    <Reply className="h-3 w-3" /> 답글
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 답글 (1 depth 들여쓰기, @닉네임 표시) */}
                        {replyMap.get(comment.id)?.map((reply) => (
                          <div key={reply.id} className="border-b py-3 pl-11">
                            <div className="flex items-start gap-2">
                              <div className="w-6 h-6 bg-muted/50 rounded-full flex items-center justify-center shrink-0">
                                <span className="text-muted-foreground text-xs font-medium">
                                  {(reply.author.nickname || '?').charAt(0)}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-xs">{reply.author.nickname || '익명'}</span>
                                  <span className="text-xs text-muted-foreground">{formatDate(reply.createdAt)}</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">
                                  {reply.parent?.author?.nickname && (
                                    <span className="text-primary font-medium">@{reply.parent.author.nickname} </span>
                                  )}
                                  {reply.content}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {board.useReaction && (
                                    <CommentReactions slug={slug} postId={postId} commentId={reply.id} isLoggedIn={!!user} />
                                  )}
                                  {canComment && (
                                    <button
                                      onClick={() => setReplyTo({ id: reply.id, nickname: reply.author.nickname || '익명' })}
                                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                    >
                                      <Reply className="h-3 w-3" /> 답글
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground mb-6">
                  댓글이 없습니다.
                </div>
              )}

              {/* 댓글 작성 */}
              {canComment ? (
                <div>
                  {replyTo && (
                    <div className="flex items-center gap-2 mb-2 text-sm text-primary">
                      <Reply className="h-3.5 w-3.5" />
                      <span>@{replyTo.nickname}에게 답글</span>
                      <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <form onSubmit={handleCommentSubmit} className="flex gap-2">
                    <Input
                      placeholder={replyTo ? `@${replyTo.nickname}에게 답글...` : "댓글을 입력하세요"}
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
                </div>
              ) : board.commentMemberOnly && !isLoggedIn ? (
                <div className="text-center">
                  <Link href="/login" className="text-primary hover:underline text-sm">
                    댓글을 쓰려면 로그인이 필요합니다.
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* 이미지 뷰어 모달 */}
        {imageViewerOpen && board.useFile && post.attachments && (() => {
          const imageAttachments = post.attachments.filter(f => f.mimeType.startsWith('image/'))
          if (imageAttachments.length === 0) return null
          return (
            <ImageViewer
              images={imageAttachments}
              initialIndex={imageViewerIndex}
              onClose={() => setImageViewerOpen(false)}
            />
          )
        })()}
      </div>
    </UserLayout>
  )
}
