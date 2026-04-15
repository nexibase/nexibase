"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useTranslations, useLocale } from 'next-intl'
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
  Settings,
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
  const t = useTranslations('boards')
  const locale = useLocale()

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

  // Fetch post list
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
          setError(data.requireLogin ? t('listRequiresLogin') : (data.error || t('noPermission')))
        } else if (response.status === 404) {
          setError(t('boardNotFound'))
        } else {
          setError(data.error || t('loadUnavailable'))
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
      console.error('failed to fetch posts:', error)
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [slug, page, t])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Date format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays < 7) {
      return t('daysAgo', { days: diffDays })
    } else {
      return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    }
  }

  // Post click
  const handlePostClick = (post: Post, e?: React.MouseEvent) => {
    if (e && (e.target as HTMLElement).closest('[data-user-nickname]')) return
    if (post.isSecret && post.author.id !== user?.id && !isAdmin) {
      alert(t('secretPostAlert'))
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
                  {t('home')}
                </Button>
                {!user && (
                  <Button onClick={() => router.push('/login')}>
                    {t('login')}
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

  // Write permission: login required for member-only boards, otherwise open to anyone
  const canWrite = board.writeMemberOnly ? isLoggedIn : true

  return (
    <UserLayout>
      <div className="max-w-4xl mx-auto sm:px-4 py-2 sm:py-6">
        {/* Board header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{board.name}</h1>
                {isAdmin && (
                  <Link href={`/admin/boards/${board.id}`} title={t('boardSettingsTitle')}>
                    <Settings className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                  </Link>
                )}
              </div>
              {board.description && (
                <p className="text-muted-foreground mt-1">{board.description}</p>
              )}
            </div>
            {canWrite && (
              <Button onClick={() => router.push(`/boards/${slug}/create`)}>
                <PenSquare className="h-4 w-4 mr-2" />
                {t('write')}
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {/* Notices */}
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
                      {t('noticeBadge')}
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

            {/* Post list */}
            {posts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {t('noPosts')}
              </div>
            ) : board.displayType === 'gallery' ? (
              /* Gallery view */
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={(e) => handlePostClick(post, e)}
                      className="group cursor-pointer"
                    >
                      {/* Thumbnail */}
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
                      {/* Info */}
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
              /* List view */
              <div>
                {/* Desktop header */}
                <div className="hidden md:flex items-center px-4 py-2 border-b text-xs text-muted-foreground font-medium">
                  <div className="flex-1">{t('post.title')}</div>
                  <div className="w-28 text-left pl-2">{t('author')}</div>
                  <div className="w-24 text-center">{t('createdAt')}</div>
                  <div className="w-16 text-center">{t('viewCount')}</div>
                  {board.useReaction && <div className="w-16 text-center">{t('recommend')}</div>}
                </div>
                {posts.map((post) => {
                  const postUrl = post.isSecret && post.author.id !== user?.id && !isAdmin ? '#' : `/boards/${slug}/${post.id}`
                  return (
                  <div
                    key={post.id}
                    className="flex items-center px-4 py-3 border-b last:border-b-0"
                  >
                    {/* Mobile: original stacked layout */}
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
                    {/* Desktop: table layout */}
                    <div className="hidden md:flex md:items-center md:flex-1 md:min-w-0">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        {post.isNotice && <Badge variant="outline" className="shrink-0 text-xs px-1.5 py-0 text-orange-500 border-orange-500">{t('noticeBadge')}</Badge>}
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

            {/* Pagination */}
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

        {/* Write button (bottom) */}
        {canWrite && posts.length > 0 && (
          <div className="flex justify-end mt-4">
            <Button onClick={() => router.push(`/boards/${slug}/create`)}>
              <PenSquare className="h-4 w-4 mr-2" />
              {t('write')}
            </Button>
          </div>
        )}

        {!canWrite && board.writeMemberOnly && (
          <div className="mt-4 text-center">
            <Link href="/login" className="text-primary hover:underline text-sm">
              {t('writeLoginRequired')}
            </Link>
          </div>
        )}
      </div>
    </UserLayout>
  )
}
