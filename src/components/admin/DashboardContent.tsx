"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Users, MessageSquare, TrendingUp, Loader2, LayoutDashboard } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import Image from "next/image"
import Link from "next/link"

interface DashboardData {
  stats: {
    totalUsers: number
    userGrowth: number
    totalPosts: number
    postGrowth: number
    activeUsers: number
    activeUserGrowth: number
  }
  recentUsers: {
    id: number
    nickname: string
    email: string
    image: string | null
    createdAt: string
  }[]
  recentPosts: {
    id: number
    title: string
    createdAt: string
    author: { nickname: string }
    board: { slug: string }
  }[]
}

export function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/admin/dashboard")
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to fetch")
        setData(json)
      } catch (err) {
        setError("데이터를 불러오는데 실패했습니다.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{error || "데이터를 불러올 수 없습니다."}</p>
      </div>
    )
  }

  const formatGrowth = (value: number) => {
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value}%`
  }

  const formatTimeAgo = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ko })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" />
          대시보드
        </h1>
        <p className="text-muted-foreground mt-1">관리자 패널에 오신 것을 환영합니다.</p>
      </div>

      {/* 통계 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/admin/users">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 회원수</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {formatGrowth(data.stats.userGrowth)} 지난달 대비
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/boards">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 게시글</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.totalPosts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {formatGrowth(data.stats.postGrowth)} 지난주 대비
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">오늘 활성 사용자</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.activeUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {formatGrowth(data.stats.activeUserGrowth)} 어제 대비
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">시스템 상태</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">정상</div>
            <p className="text-xs text-muted-foreground">
              모든 서비스 운영 중
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 최근 활동 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>최근 가입 회원</CardTitle>
            <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-primary">
              전체보기
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">최근 가입한 회원이 없습니다.</p>
              ) : (
                data.recentUsers.map((user) => (
                  <Link key={user.id} href={`/admin/users?edit=${user.id}`} className="flex items-center space-x-4 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.nickname}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.nickname}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(user.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>최근 게시글</CardTitle>
            <Link href="/admin/boards" className="text-sm text-muted-foreground hover:text-primary">
              전체보기
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">최근 게시글이 없습니다.</p>
              ) : (
                data.recentPosts.map((post) => (
                  <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`} className="flex items-center space-x-4 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.author.nickname} • {formatTimeAgo(post.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
