"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users, FileText, MessageSquare, TrendingUp, Eye,
  Clock, ArrowRight, Sparkles, Flame, BookOpen, ShoppingBag
} from "lucide-react"
import Link from "next/link"
import { Header, Footer } from "@/components/layout"

interface UserInfo {
  id: string
  email: string
  nickname: string | null
  image: string | null
  role: string
  status: string
  lastLoginAt: string | null
  createdAt: string
}

interface SiteSettings {
  site_name: string
  site_description: string
}

interface Board {
  id: number
  slug: string
  name: string
  description: string | null
  postCount: number
}

interface Stats {
  memberCount: number
  boardCount: number
  postCount: number
  commentCount: number
}

interface LatestPost {
  id: number
  title: string
  createdAt: string
  viewCount: number
  likeCount?: number
  commentCount?: number
  author: {
    nickname: string | null
    name: string | null
  }
  board: {
    slug: string
    name: string
  }
}

export default function HomePage() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: 'NexiBase',
    site_description: ''
  })
  const [boards, setBoards] = useState<Board[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [latestPosts, setLatestPosts] = useState<LatestPost[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, settingsRes, boardsRes, statsRes, postsRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/settings'),
          fetch('/api/boards?limit=6'),
          fetch('/api/stats'),
          fetch('/api/posts/latest?limit=8')
        ])

        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData.user)
        }

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          setSettings({
            site_name: settingsData.settings.site_name || 'NexiBase',
            site_description: settingsData.settings.site_description || ''
          })
        }

        if (boardsRes.ok) {
          const boardsData = await boardsRes.json()
          setBoards(boardsData.boards || [])
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData.stats)
        }

        if (postsRes.ok) {
          const postsData = await postsRes.json()
          setLatestPosts(postsData.posts || [])
        }
      } catch (error) {
        console.error('데이터 조회 에러:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString('ko-KR')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* 환영 배너 (좌 2열) + 통계 (우 2열 2행) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* 환영 배너 - 좌측 2열 */}
            <Card className="col-span-2 lg:row-span-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-primary">Welcome</span>
                  </div>
                  <h1 className="text-xl md:text-2xl font-bold mb-2">
                    {user
                      ? `${user.nickname || '사용자'}님, 환영합니다!`
                      : `${settings.site_name}에 오신 것을 환영합니다`
                    }
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {settings.site_description || '함께 성장하는 커뮤니티에서 다양한 이야기를 나눠보세요.'}
                  </p>
                </div>
                <div className="flex gap-2 mt-4">
                  {boards.length > 0 && (
                    <Link href={`/boards/${boards[0].slug}`}>
                      <Button>
                        시작하기
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  )}
                  <Link href="/contents/about">
                    <Button variant="outline">더 알아보기</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* 통계 카드 - 우측 2열 2행 */}
            {stats && (
              <>
                <Card className="group hover:border-blue-500/50 transition-colors">
                  <CardContent className="p-4 h-full flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.memberCount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">회원</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="group hover:border-green-500/50 transition-colors">
                  <CardContent className="p-4 h-full flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.postCount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">게시글</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="group hover:border-purple-500/50 transition-colors">
                  <CardContent className="p-4 h-full flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageSquare className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.commentCount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">댓글</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="group hover:border-orange-500/50 transition-colors">
                  <CardContent className="p-4 h-full flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <TrendingUp className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stats.boardCount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">게시판</div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Bento Grid 레이아웃 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[minmax(100px,auto)]">

            {/* 최근 게시글 - 넓은 카드 (2x2) */}
            <Card className="md:col-span-2 lg:row-span-2">
              <div className="border-b px-4 py-3 flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  최근 게시글
                </h2>
                <Link href="/latest" className="text-sm text-primary hover:underline flex items-center gap-1">
                  더보기 <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <CardContent className="p-0">
                {latestPosts.length > 0 ? (
                  <div className="divide-y">
                    {latestPosts.slice(0, 6).map((post) => (
                      <Link
                        key={post.id}
                        href={`/boards/${post.board.slug}/${post.id}`}
                        className="block px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs shrink-0">
                                {post.board.name}
                              </Badge>
                              <span className="font-medium text-sm truncate">
                                {post.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{post.author.nickname}</span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {post.viewCount}
                              </span>
                              {post.commentCount !== undefined && post.commentCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {post.commentCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatTimeAgo(post.createdAt)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    아직 게시글이 없습니다.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 인기 게시판 - 세로 카드 (1x2) */}
            {boards.length > 0 && (
              <Card className="lg:row-span-2">
                <div className="border-b px-4 py-3">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    인기 게시판
                  </h2>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {boards.slice(0, 5).map((board, index) => (
                      <Link
                        key={board.id}
                        href={`/boards/${board.slug}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                          index === 0 ? 'bg-yellow-500 text-yellow-950' :
                          index === 1 ? 'bg-gray-400 text-gray-900' :
                          index === 2 ? 'bg-amber-600 text-amber-100' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="flex-1 text-sm font-medium truncate">{board.name}</span>
                        <Badge variant="secondary" className="text-xs">{board.postCount}</Badge>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 쇼핑몰 바로가기 - 1x1 */}
            <Link href="/shop">
              <Card className="h-full bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20 hover:border-green-500/50 hover:shadow-md transition-all duration-300 cursor-pointer group">
                <CardContent className="p-4 h-full flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ShoppingBag className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">쇼핑몰</h3>
                      <p className="text-xs text-muted-foreground">신선한 상품 구경하기</p>
                    </div>
                  </div>
                  <div className="flex items-center text-xs text-green-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>바로가기</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* 커뮤니티 가이드 - 1x1 */}
            <Card className="bg-gradient-to-br from-muted/50 to-muted/30">
              <CardContent className="p-4 h-full flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">커뮤니티 가이드</h3>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 서로 존중하는 대화</li>
                  <li>• 욕설, 비방 금지</li>
                  <li>• 광고/스팸 금지</li>
                </ul>
              </CardContent>
            </Card>

            {/* 게시판 카드들 */}
            {boards.slice(0, 4).map((board, index) => (
              <Link key={board.id} href={`/boards/${board.slug}`} className={index === 0 ? 'md:col-span-2' : ''}>
                <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all duration-300 cursor-pointer group">
                  <CardContent className="p-4 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold group-hover:text-primary transition-colors">{board.name}</h3>
                        <Badge variant="secondary">{board.postCount}</Badge>
                      </div>
                      {board.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {board.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>바로가기</span>
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
