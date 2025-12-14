"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Users, MessageCircle, TrendingUp, Star, Heart, Share2, User } from "lucide-react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

interface UserInfo {
  id: string
  email: string
  name: string | null
  nickname: string | null
  image: string | null
  phone: string | null
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

interface Post {
  id: number
  title: string
  author: {
    nickname: string | null
    name: string | null
    image: string | null
  }
  likeCount: number
  commentCount: number
  createdAt: string
  board: {
    slug: string
    name: string
  }
}

export default function Home() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: 'NexiBase',
    site_description: ''
  })
  const [boards, setBoards] = useState<Board[]>([])
  const [recentPosts, setRecentPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 병렬로 데이터 가져오기
        const [userRes, settingsRes, boardsRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/settings'),
          fetch('/api/boards?limit=5')
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

        // 최근 게시글 가져오기 (있다면)
        try {
          const postsRes = await fetch('/api/posts/recent?limit=5')
          if (postsRes.ok) {
            const postsData = await postsRes.json()
            setRecentPosts(postsData.posts || [])
          }
        } catch {
          // 최근 게시글 API가 없어도 무시
        }
      } catch (error) {
        console.error('데이터 조회 에러:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const trendingTopics = [
    { name: "웹 개발", count: 1.2 },
    { name: "React", count: 850 },
    { name: "AI/ML", count: 720 },
    { name: "취업", count: 680 },
    { name: "스타트업", count: 520 }
  ]

  // 시간 포맷팅
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString('ko-KR')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content */}
          <main className="lg:col-span-8">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-8 mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                {user
                  ? `${user.nickname || user.name || '사용자'}님, 환영합니다!`
                  : `${settings.site_name}에 오신 것을 환영합니다!`
                }
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                {settings.site_description || '질문하고, 답변하고, 함께 성장하는 개발자 커뮤니티'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                {boards.length > 0 ? (
                  <Link href={`/board/${boards[0].slug}`}>
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                      게시판 가기
                    </Button>
                  </Link>
                ) : (
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                    시작하기
                  </Button>
                )}
                <Link href="/content/about">
                  <Button size="lg" variant="outline">
                    더 알아보기
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">-</div>
                  <div className="text-sm text-muted-foreground">활성 사용자</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <MessageCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{boards.length}</div>
                  <div className="text-sm text-muted-foreground">게시판</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">
                    {boards.reduce((acc, b) => acc + b.postCount, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">게시글</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Star className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">-</div>
                  <div className="text-sm text-muted-foreground">댓글</div>
                </CardContent>
              </Card>
            </div>

            {/* 게시판 목록 */}
            {boards.length > 0 && (
              <div className="space-y-6 mb-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">게시판</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {boards.map((board) => (
                    <Link key={board.id} href={`/board/${board.slug}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-lg font-semibold">{board.name}</h4>
                            <Badge variant="secondary">{board.postCount}개</Badge>
                          </div>
                          {board.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {board.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 최근 게시글 */}
            {recentPosts.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">최근 게시글</h3>
                  <Button variant="outline" size="sm">더보기</Button>
                </div>

                {recentPosts.map((post) => (
                  <Card key={post.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <Avatar>
                          <AvatarImage src={post.author.image || undefined} />
                          <AvatarFallback>
                            {(post.author.nickname || post.author.name || '?')[0]}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-medium">
                              {post.author.nickname || post.author.name || '익명'}
                            </span>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">
                              {formatTimeAgo(post.createdAt)}
                            </span>
                          </div>

                          <Link href={`/board/${post.board.slug}/${post.id}`}>
                            <h4 className="text-lg font-semibold mb-3 hover:text-blue-600 cursor-pointer">
                              {post.title}
                            </h4>
                          </Link>

                          <div className="flex flex-wrap gap-2 mb-4">
                            <Badge variant="secondary">{post.board.name}</Badge>
                          </div>

                          <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Heart className="h-4 w-4" />
                              <span>{post.likeCount}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MessageCircle className="h-4 w-4" />
                              <span>{post.commentCount}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-auto p-0">
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* 게시판이 없을 때 안내 */}
            {!isLoading && boards.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">아직 게시판이 없습니다</h3>
                  <p className="text-muted-foreground mb-4">
                    관리자 페이지에서 게시판을 생성해 주세요.
                  </p>
                  {user?.role === 'admin' && (
                    <Link href="/admin/boards">
                      <Button>게시판 관리하기</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </main>

          {/* Sidebar */}
          <aside className="lg:col-span-4">
            <div className="space-y-6">
              {/* User Info Card */}
              {user && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      내 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-3 mb-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.image || undefined} />
                        <AvatarFallback className="bg-blue-100 text-blue-600 text-lg font-medium">
                          {(user.nickname || user.name || user.email || '?')[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.nickname || user.name || '사용자'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div>가입일: {new Date(user.createdAt).toLocaleDateString('ko-KR')}</div>
                      {user.lastLoginAt && (
                        <div>최근 로그인: {new Date(user.lastLoginAt).toLocaleDateString('ko-KR')}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Trending Topics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    인기 토픽
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {trendingTopics.map((topic, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm hover:text-blue-600 cursor-pointer">
                          #{topic.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {topic.count < 1000 ? topic.count : `${topic.count}k`}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>빠른 액션</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {boards.length > 0 && (
                    <Link href={`/board/${boards[0].slug}/write`} className="block">
                      <Button className="w-full justify-start" variant="outline">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        글쓰기
                      </Button>
                    </Link>
                  )}
                  <Link href="/content/about" className="block">
                    <Button className="w-full justify-start" variant="outline">
                      <Users className="h-4 w-4 mr-2" />
                      소개 보기
                    </Button>
                  </Link>
                  <Link href="/content/faq" className="block">
                    <Button className="w-full justify-start" variant="outline">
                      <Star className="h-4 w-4 mr-2" />
                      자주 묻는 질문
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Community Guidelines */}
              <Card>
                <CardHeader>
                  <CardTitle>커뮤니티 가이드</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>• 서로 존중하며 소통해주세요</p>
                    <p>• 구체적이고 명확한 질문을 해주세요</p>
                    <p>• 답변에는 감사 인사를 잊지 마세요</p>
                    <p>• 도움이 되는 답변에 좋아요를 눌러주세요</p>
                  </div>
                  <Separator className="my-4" />
                  <Link href="/content/faq">
                    <Button variant="link" className="p-0 h-auto text-sm">
                      자세한 가이드라인 보기 →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  )
}
