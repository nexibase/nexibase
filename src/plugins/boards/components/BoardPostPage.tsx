"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslations, useLocale } from 'next-intl'
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
  MoreVertical,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CommentReactions } from "@/plugins/boards/components/CommentReactions"
import { MiniEditor } from "@/components/editors/MiniEditor"
import { UserNickname } from "@/components/UserNickname"

// Emoji reaction component
const EmojiIcon = ({ emoji, className }: { emoji: string; className?: string }) => (
  <span className={cn("text-base leading-none", className)}>{emoji}</span>
)

// Reaction type definitions (positive only)
const REACTIONS = [
  { type: 'like', emoji: '👍', color: 'text-blue-500', bgActive: 'bg-blue-500 hover:bg-blue-600 ring-blue-500' },
  { type: 'haha', emoji: '😂', color: 'text-yellow-500', bgActive: 'bg-yellow-500 hover:bg-yellow-600 ring-yellow-500 text-black' },
  { type: 'agree', emoji: '👌', color: 'text-green-500', bgActive: 'bg-green-500 hover:bg-green-600 ring-green-500' },
  { type: 'thanks', emoji: '🙏', color: 'text-pink-500', bgActive: 'bg-pink-500 hover:bg-pink-600 ring-pink-500' },
  { type: 'wow', emoji: '😮', color: 'text-purple-500', bgActive: 'bg-purple-500 hover:bg-purple-600 ring-purple-500' },
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
  uuid?: string
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

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Pick file icon
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.includes('pdf')) return '📕'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📘'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📙'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦'
  return '📄'
}

// Images 뷰어 모달 컴포넌트
interface ImageViewerProps {
  images: Attachment[]
  initialIndex: number
  onClose: () => void
}

function ImageViewer({ images, initialIndex, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)

  const currentImage = images[currentIndex]

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          // Wrap: first → last
          setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1)
          setScale(1)
          break
        case 'ArrowRight':
          // Wrap: last → first
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
    // Wrap: first → last
    setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1)
    setScale(1)
  }

  const handleNext = () => {
    // Wrap: last → first
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
      {/* Top toolbar */}
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

      {/* Previous button */}
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

      {/* Image */}
      <div className="flex items-center justify-center w-full h-full p-16 overflow-auto">
        <img
          src={currentImage.filePath}
          alt={currentImage.filename}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
          draggable={false}
        />
      </div>

      {/* Next button */}
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

      {/* Bottom thumbnails */}
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
  const t = useTranslations('boards')
  const locale = useLocale()

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
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null)
  const [editText, setEditText] = useState('')
  const [prevPost, setPrevPost] = useState<AdjacentPost | null>(null)
  const [nextPost, setNextPost] = useState<AdjacentPost | null>(null)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [imageViewerIndex, setImageViewerIndex] = useState(0)
  const [contentImageViewer, setContentImageViewer] = useState<{ images: Attachment[]; index: number } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const isLoggedIn = !!user
  const isAdmin = user?.role === 'admin'

  // Fetch user info
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/me')
      const data = await response.json()
      if (data.user) {
        setUser(data.user)
      }
    } catch (error) {
      console.error('failed to fetch user:', error)
    }
  }, [])

  // Fetch reactions
  const fetchReactions = useCallback(async () => {
    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}/reaction`)
      const data = await response.json()
      if (data.success) {
        setReactions(data.reactions || {})
        setUserReactions(data.userReactions || [])
      }
    } catch (error) {
      console.error('failed to fetch reactions:', error)
    }
  }, [slug, postId])

  // Fetch post
  const fetchPost = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setError(data.error || t('post.viewPermDenied'))
        } else if (response.status === 404) {
          setError(t('post.notFound'))
        } else {
          setError(data.error || t('post.loadFailed'))
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
      console.error('failed to fetch post:', error)
      setError(t('post.loadError'))
    } finally {
      setLoading(false)
    }
  }, [slug, postId, t])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    fetchPost()
  }, [fetchPost])

  // Hash-anchor scroll (after comments load)
  useEffect(() => {
    if (post && window.location.hash) {
      const timer = setTimeout(() => {
        const el = document.querySelector(window.location.hash)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('bg-primary/5')
          setTimeout(() => el.classList.remove('bg-primary/5'), 2000)
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [post])

  useEffect(() => {
    if (board?.useReaction) {
      fetchReactions()
    }
  }, [board, fetchReactions])

  // Date format
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Delete post
  const handleDelete = async () => {
    if (!confirm(t('post.reallyDelete'))) return

    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push(`/boards/${slug}`)
      } else {
        const data = await response.json()
        alert(data.error || t('post.deleteFailed'))
      }
    } catch (error) {
      console.error('delete error:', error)
      alert(t('post.deleteError'))
    }
  }

  // Toggle reaction
  const handleReaction = async (type: string) => {
    if (!user) {
      alert(t('errors.loginRequiredDot'))
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
      console.error('reaction error:', error)
    }
  }

  // Write comment
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!commentText.trim()) return

    if (!user) {
      alert(t('errors.loginRequiredDot'))
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
        alert(data.error || t('comment.writeFailed'))
      }
    } catch (error) {
      console.error('failed to create comment:', error)
      alert(t('comment.writeError'))
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleCommentEdit = async (commentId: string) => {
    if (!editText.trim()) return
    try {
      const res = await fetch(`/api/boards/${slug}/posts/${postId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editText.trim() })
      })
      if (res.ok) {
        setEditingComment(null)
        setEditText('')
        fetchPost()
      } else {
        const data = await res.json()
        alert(data.error || t('comment.editFailed'))
      }
    } catch {
      alert(t('comment.editError'))
    }
  }

  const handleCommentDelete = async (commentId: string) => {
    if (!confirm(t('comment.deleteConfirm'))) return
    try {
      const res = await fetch(`/api/boards/${slug}/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchPost()
      } else {
        const data = await res.json()
        alert(data.error || t('comment.deleteFailed'))
      }
    } catch {
      alert(t('comment.deleteError'))
    }
  }

  // Compute total reaction count
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
                {t('post.listBtn')}
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

  // Comment permission: login required for member-only boards, otherwise open to anyone
  const canComment = board.useComment && (board.commentMemberOnly ? isLoggedIn : true)
  const canEdit = isAuthor || isAdmin

  return (
    <UserLayout>
      <div className="max-w-4xl mx-auto sm:px-4 py-2 sm:py-6">
        {/* Board navigation */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 px-2 sm:px-0">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/boards/${slug}`}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h2 className="text-base sm:text-lg font-semibold truncate">{board.name}</h2>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={!nextPost}
              onClick={() => nextPost && router.push(`/boards/${slug}/${nextPost.id}`)}
              title={nextPost ? nextPost.title : t('post.previousMissing')}
              className="px-2 sm:px-3"
            >
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{t('post.previous')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!prevPost}
              onClick={() => prevPost && router.push(`/boards/${slug}/${prevPost.id}`)}
              title={prevPost ? prevPost.title : t('post.nextMissing')}
              className="px-2 sm:px-3"
            >
              <span className="hidden sm:inline">{t('post.next')}</span>
              <ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
            <Link href={`/boards/${slug}`}>
              <Button variant="outline" size="sm" className="px-2 sm:px-3">
                <List className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{t('post.list')}</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Post */}
        <Card className="mb-4 sm:mb-6 rounded-none sm:rounded-lg">
          <CardContent className="p-3 sm:p-6">
            {/* Title */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                {post.isNotice && (
                  <Badge variant="destructive">
                    <Pin className="h-3 w-3 mr-1" />
                    {t('noticeBadge')}
                  </Badge>
                )}
                {post.isSecret && (
                  <Badge variant="secondary">
                    <Lock className="h-3 w-3 mr-1" />
                    {t('post.secret')}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold">{post.title}</h1>
            </div>

            {/* Author info */}
            <div className="flex items-center justify-between py-3 border-y mb-6">
              <div className="flex items-center gap-3">
                <UserNickname userId={post.author.id} uuid={post.author.uuid} nickname={post.author.nickname} image={post.author.image} showAvatar avatarSize="md" />
                <span className="text-sm text-muted-foreground">{formatDate(post.createdAt)}</span>
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

            {/* Body */}
            <div
              ref={contentRef}
              className="tiptap prose dark:prose-invert max-w-none mb-6 overflow-x-auto break-words [&_img]:cursor-zoom-in [&_img]:max-w-full [&_img]:h-auto"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (target.tagName === 'IMG') {
                  const clickedImg = target as HTMLImageElement
                  const allImgs = Array.from(contentRef.current?.querySelectorAll('img') || [])
                  const images: Attachment[] = allImgs.map((img, i) => ({
                    id: i,
                    filename: img.alt || t('post.imageAlt', { index: i + 1 }),
                    filePath: img.src,
                    fileSize: 0,
                    mimeType: 'image/webp',
                    downloadCount: 0,
                  }))
                  const index = allImgs.indexOf(clickedImg)
                  setContentImageViewer({ images, index: Math.max(0, index) })
                }
              }}
            />

            {/* Gallery mode: image gallery */}
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

            {/* Attachments */}
            {board.useFile && post.attachments && post.attachments.length > 0 && (() => {
              const imageAttachments = post.attachments.filter(f => f.mimeType.startsWith('image/'))
              return (
                <div className="border rounded-lg p-4 mb-6 bg-muted/30">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    {t('post.attachmentsCount', { count: post.attachments.length })}
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
                                  {file.downloadCount > 0 && ` ${t('post.downloadCount', { count: file.downloadCount })}`}
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
                              {file.downloadCount > 0 && ` ${t('post.downloadCount', { count: file.downloadCount })}`}
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

            {/* Reaction buttons */}
            {board.useReaction && (
              <div className="flex flex-wrap items-center gap-2 py-4 border-t">
                {REACTIONS.map(({ type, emoji, bgActive }) => {
                  const count = reactions[type] || 0
                  const isActive = userReactions.includes(type)

                  return (
                    <Button
                      key={type}
                      type="button"
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
                      <span className="text-xs">{t(`reactions.${type}`)}</span>
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

            {/* Edit / delete */}
            {canEdit && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/boards/${slug}/${postId}/edit`)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  {t('edit')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('delete')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comments */}
        {board.useComment && (
          <Card className="rounded-none sm:rounded-lg">
            <CardContent className="p-3 sm:p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('comment.titleWithCount', { count: post.comments?.length || 0 })}
              </h3>

              {/* Inline reply input */}
              {(() => {
                const ReplyForm = ({ parentId, nickname, indent }: { parentId: string; nickname: string; indent: boolean }) => (
                  replyTo?.id === parentId ? (
                    <div className={indent ? "py-2 pl-11" : "py-2"}>
                      <div className="flex items-center gap-2 mb-1.5 text-xs text-primary">
                        <Reply className="h-3 w-3" />
                        <span>{t('comment.replyTo', { nickname })}</span>
                        <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <form onSubmit={handleCommentSubmit} className="flex gap-2">
                        <Input
                          placeholder={t('comment.replyPlaceholder', { nickname })}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          className="flex-1 h-8 text-sm"
                          autoFocus
                        />
                        <Button type="submit" size="sm" disabled={submittingComment || !commentText.trim()}>
                          {submittingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        </Button>
                      </form>
                    </div>
                  ) : null
                )

                return null
              })()}

              {/* Comment list */}
              {post.comments && post.comments.length > 0 ? (
                <div className="space-y-0 mb-6">
                  {(() => {
                    const rootComments = post.comments.filter(c => !c.parentId)
                    const replies = post.comments.filter(c => c.parentId)
                    const replyMap = new Map<string, Comment[]>()
                    for (const r of replies) {
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
                        {/* Top-level comment */}
                        <div id={`comment-${comment.id}`} className="border-b py-3 scroll-mt-20">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <UserNickname userId={comment.author.id} uuid={comment.author.uuid} nickname={comment.author.nickname} image={comment.author.image} showAvatar />
                                  <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                                </div>
                                {user && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted">
                                        <MoreVertical className="h-4 w-4" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-32 p-1" align="end">
                                      <button
                                        onClick={() => { setReplyTo({ id: comment.id, nickname: comment.author.nickname || t('comment.anonymous') }); setCommentText('') }}
                                        className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted"
                                      >{t('comment.reply')}</button>
                                      {(comment.author.id === user.id || user.role === 'admin') && (
                                        <>
                                          <button
                                            onClick={() => { setEditingComment({ id: comment.id, content: comment.content }); setEditText(comment.content) }}
                                            className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted"
                                          >{t('edit')}</button>
                                          <button
                                            onClick={() => handleCommentDelete(comment.id)}
                                            className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted text-destructive"
                                          >{t('delete')}</button>
                                        </>
                                      )}
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                              {editingComment?.id === comment.id ? (
                                <div>
                                  <MiniEditor content={editText} onChange={setEditText} />
                                  <div className="flex justify-end gap-2 mt-2">
                                    <Button size="sm" variant="ghost" onClick={() => setEditingComment(null)}>{t('post.cancel')}</Button>
                                    <Button size="sm" onClick={() => handleCommentEdit(comment.id)} disabled={!editText || editText === '<p></p>'}>{t('post.save')}</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: comment.content }} />
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {board.useReaction && (
                                  <CommentReactions slug={slug} postId={postId} commentId={comment.id} isLoggedIn={!!user} />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Reply input directly under the comment */}
                        {replyTo?.id === comment.id && canComment && (
                          <div className="py-2 pl-11 border-b">
                            <div className="flex items-center gap-2 mb-1.5 text-xs text-primary">
                              <Reply className="h-3 w-3" />
                              <span>{t('comment.replyTo', { nickname: replyTo.nickname })}</span>
                              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <MiniEditor content={commentText} onChange={setCommentText} placeholder={t('comment.replyPlaceholder', { nickname: replyTo.nickname })} />
                            <div className="flex justify-end mt-2">
                              <Button size="sm" onClick={(e) => handleCommentSubmit(e)} disabled={submittingComment || !commentText || commentText === '<p></p>'}>
                                {submittingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                                {t('comment.reply')}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Reply (indented one level, shows @nickname) */}
                        {replyMap.get(comment.id)?.map((reply) => (
                          <div key={reply.id}>
                            <div id={`comment-${reply.id}`} className="border-b py-3 pl-11 scroll-mt-20">
                              <div className="flex items-start gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <UserNickname userId={reply.author.id} uuid={reply.author.uuid} nickname={reply.author.nickname} image={reply.author.image} showAvatar />
                                      <span className="text-xs text-muted-foreground">{formatDate(reply.createdAt)}</span>
                                    </div>
                                    {user && (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted">
                                            <MoreVertical className="h-3.5 w-3.5" />
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-32 p-1" align="end">
                                          <button
                                            onClick={() => { setReplyTo({ id: reply.id, nickname: reply.author.nickname || t('comment.anonymous') }); setCommentText('') }}
                                            className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted"
                                          >{t('comment.reply')}</button>
                                          {(reply.author.id === user.id || user.role === 'admin') && (
                                            <>
                                              <button
                                                onClick={() => { setEditingComment({ id: reply.id, content: reply.content }); setEditText(reply.content) }}
                                                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted"
                                              >{t('edit')}</button>
                                              <button
                                                onClick={() => handleCommentDelete(reply.id)}
                                                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted text-destructive"
                                              >{t('delete')}</button>
                                            </>
                                          )}
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                  </div>
                                  {editingComment?.id === reply.id ? (
                                    <div className="flex gap-2">
                                      <Input value={editText} onChange={e => setEditText(e.target.value)} className="flex-1 h-8 text-sm" autoFocus />
                                      <Button size="sm" onClick={() => handleCommentEdit(reply.id)} disabled={!editText.trim()}>{t('post.save')}</Button>
                                      <Button size="sm" variant="ghost" onClick={() => setEditingComment(null)}>{t('post.cancel')}</Button>
                                    </div>
                                  ) : (
                                    <div className="text-sm">
                                      {reply.parent?.author?.nickname && (
                                        <span className="text-primary font-medium">@{reply.parent.author.nickname} </span>
                                      )}
                                      <span className="prose prose-sm dark:prose-invert max-w-none inline" dangerouslySetInnerHTML={{ __html: reply.content }} />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    {board.useReaction && (
                                      <CommentReactions slug={slug} postId={postId} commentId={reply.id} isLoggedIn={!!user} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Reply input directly under a nested comment */}
                            {replyTo?.id === reply.id && canComment && (
                              <div className="py-2 pl-11 border-b">
                                <div className="flex items-center gap-2 mb-1.5 text-xs text-primary">
                                  <Reply className="h-3 w-3" />
                                  <span>{t('comment.replyTo', { nickname: replyTo.nickname })}</span>
                                  <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                                <MiniEditor content={commentText} onChange={setCommentText} placeholder={t('comment.replyPlaceholder', { nickname: replyTo.nickname })} />
                                <div className="flex justify-end mt-2">
                                  <Button size="sm" onClick={(e) => handleCommentSubmit(e)} disabled={submittingComment || !commentText || commentText === '<p></p>'}>
                                    {submittingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                                    {t('comment.reply')}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground mb-6">
                  {t('comment.noComments')}
                </div>
              )}

              {/* Write a new comment */}
              {canComment && !replyTo ? (
                <div>
                  <MiniEditor content={commentText} onChange={setCommentText} placeholder={t('comment.placeholder')} />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={(e) => { setReplyTo(null); handleCommentSubmit(e) }} disabled={submittingComment || !commentText || commentText === '<p></p>'}>
                      {submittingComment ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                      {t('comment.write')}
                    </Button>
                  </div>
                </div>
              ) : board.commentMemberOnly && !isLoggedIn ? (
                <div className="text-center">
                  <Link href="/login" className="text-primary hover:underline text-sm">
                    {t('comment.loginRequired')}
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Attachment image viewer modal */}
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

        {/* Body image viewer modal */}
        {contentImageViewer && (
          <ImageViewer
            images={contentImageViewer.images}
            initialIndex={contentImageViewer.index}
            onClose={() => setContentImageViewer(null)}
          />
        )}
      </div>
    </UserLayout>
  )
}
