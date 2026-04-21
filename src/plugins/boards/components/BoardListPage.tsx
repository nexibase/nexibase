"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useTranslations, useLocale } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UserLayout } from "@/components/layout/UserLayout"
import { PostListRow } from "./PostListRow"
import {
  Loader2,
  Eye,
  ThumbsUp,
  Lock,
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
  showPostNumber: boolean
}

interface Post {
  id: string
  title: string
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
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
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
  const fetchPosts = useCallback(async (targetPage: number, append: boolean) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const params = new URLSearchParams({ page: targetPage.toString() })
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
        setPosts(prev => append ? [...prev, ...data.posts] : data.posts)
        if (!append) setNotices(data.notices || [])
        setTotal(data.pagination.total)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('failed to fetch posts:', error)
      setError(t('loadError'))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [slug, t])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    setPage(1)
    fetchPosts(1, false)
  }, [fetchPosts])

  // Date format
  // Short display in the list: today → HH:MM (24-hour), any older date → MM-DD.
  // The full datetime is rendered as a tooltip on the <time> element in PostListRow.
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()

    if (sameDay) {
      return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    }
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${mm}-${dd}`
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-6">
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

        <div className="divide-y divide-border">
            {board.displayType === 'list' ? (
              <div className="divide-y-0">
                {/* Desktop header row */}
                <div
                  className={[
                    "hidden md:grid gap-x-3 items-center px-2 py-2 bg-muted/50 border-b border-border",
                    "text-[12px] font-semibold text-muted-foreground",
                    board.showPostNumber
                      ? "md:[grid-template-columns:50px_1fr_90px_60px_50px_50px] md:[grid-template-areas:'num_title_author_date_views_likes']"
                      : "md:[grid-template-columns:1fr_90px_60px_50px_50px] md:[grid-template-areas:'title_author_date_views_likes']",
                  ].join(" ")}
                >
                  {board.showPostNumber && (
                    <div className="text-center [grid-area:num]">{t('colNumber')}</div>
                  )}
                  <div className="text-left [grid-area:title]">{t('colTitle')}</div>
                  <div className="text-center [grid-area:author]">{t('colAuthor')}</div>
                  <div className="text-center [grid-area:date]">{t('colDate')}</div>
                  <div className="text-center [grid-area:views]">{t('colViews')}</div>
                  <div className="text-center [grid-area:likes]">{t('colLikes')}</div>
                </div>

                {/* Notices — rendered between the desktop header and regular posts */}
                {notices.map(notice => (
                  <PostListRow
                    key={`n-${notice.id}`}
                    post={notice}
                    board={board}
                    displayNumber={null}
                    viewer={user}
                    isAdmin={isAdmin}
                    formatDate={formatDate}
                    onSecretBlocked={() => alert(t('secretPostAlert'))}
                  />
                ))}

                {/* Regular posts (or empty state when none) */}
                {posts.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    {t('noPosts')}
                  </div>
                ) : (
                  posts.map((post, i) => (
                    <PostListRow
                      key={post.id}
                      post={post}
                      board={board}
                      displayNumber={board.showPostNumber ? total - i : null}
                      viewer={user}
                      isAdmin={isAdmin}
                      formatDate={formatDate}
                      onSecretBlocked={() => alert(t('secretPostAlert'))}
                    />
                  ))
                )}
              </div>
            ) : posts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {t('noPosts')}
              </div>
            ) : (
              /* Gallery view — preserved from previous implementation */
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
            )}

            {/* Load more */}
            {page < totalPages && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next = page + 1
                    setPage(next)
                    fetchPosts(next, true)
                  }}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('loading')}
                    </>
                  ) : (
                    t('loadMore')
                  )}
                </Button>
              </div>
            )}
        </div>

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
