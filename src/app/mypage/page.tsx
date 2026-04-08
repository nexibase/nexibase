"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  LogOut, MessageSquare, FileText, Eye, ThumbsUp, Clock, User, Calendar, Mail, Phone, Shield, Monitor,
} from "lucide-react"

interface UserInfo {
  id: number
  email: string
  nickname: string
  name: string | null
  phone: string | null
  image: string | null
  role: string
  level: number
  lastLoginAt: string | null
  createdAt: string
}

interface MyPost {
  id: number
  title: string
  viewCount: number
  likeCount: number
  commentCount: number
  createdAt: string
  board: { slug: string, name: string }
}

interface MyComment {
  id: number
  content: string
  createdAt: string
  post: {
    id: number
    title: string
    board: { slug: string }
  }
}

interface LoginLog {
  id: number
  ip: string
  success: boolean
  createdAt: string
}

export default function MyPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [myPosts, setMyPosts] = useState<MyPost[]>([])
  const [myComments, setMyComments] = useState<MyComment[]>([])
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/me/posts?limit=5').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/me/comments?limit=5').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/me/login-history').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([userData, postsData, commentsData, loginData]) => {
      if (userData?.user) setUser(userData.user)
      if (postsData?.posts) setMyPosts(postsData.posts)
      if (commentsData?.comments) setMyComments(commentsData.comments)
      if (loginData?.logs) setLoginLogs(loginData.logs)
    }).finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}분 전`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}시간 전`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}일 전`
    return new Date(dateStr).toLocaleDateString('ko-KR')
  }

  return (
    <MyPageLayout>
      <div className="space-y-6">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">로딩 중...</div>
        ) : (
          <>
            {/* 내 정보 */}
            {user && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    내 정보
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{user.email}</span>
                    </div>
                    {user.name && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{user.name}</span>
                      </div>
                    )}
                    {user.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span>Lv.{user.level} {user.role === 'admin' ? '(관리자)' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>가입 {new Date(user.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    {user.lastLoginAt && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>최근 {formatTimeAgo(user.lastLoginAt)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 로그인 기록 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    로그인 기록
                  </CardTitle>
                  <Link href="/mypage/login-history" className="text-xs text-primary hover:underline">
                    전체보기
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {loginLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">로그인 기록이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {loginLogs.slice(0, 5).map(log => (
                      <div key={log.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-muted-foreground">{log.ip}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString('ko-KR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 내가 쓴 글 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  내가 쓴 글
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">작성한 글이 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {myPosts.map(post => (
                      <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`} className="block hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{post.title}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">{post.board.name}</Badge>
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount}</span>
                              <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{post.likeCount}</span>
                              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{post.commentCount}</span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground ml-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(post.createdAt)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 내가 쓴 댓글 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  내가 쓴 댓글
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myComments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">작성한 댓글이 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {myComments.map(comment => (
                      <Link key={comment.id} href={`/boards/${comment.post.board.slug}/${comment.post.id}`} className="block hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                        <p className="text-sm line-clamp-2">{comment.content.replace(/<[^>]*>/g, '')}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="truncate">{comment.post.title}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(comment.createdAt)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* 로그아웃 */}
        <Button variant="outline" onClick={handleLogout} className="w-full text-red-500">
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </MyPageLayout>
  )
}
