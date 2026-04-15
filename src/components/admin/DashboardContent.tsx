"use client"

import { useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart3, Users, MessageSquare, TrendingUp, Loader2, LayoutDashboard,
  Eye, ThumbsUp, CheckCircle2, XCircle
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko, enUS } from "date-fns/locale"
import Image from "next/image"
import Link from "next/link"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface DashboardData {
  pluginStatus?: {
    boards?: boolean
  }
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
  recentPosts?: {
    id: number
    title: string
    createdAt: string
    author: { nickname: string }
    board: { slug: string }
  }[]
  popularPosts?: {
    id: number
    title: string
    viewCount: number
    likeCount: number
    commentCount: number
    board: { slug: string; name: string }
  }[]
  recentComments?: {
    id: number
    content: string
    createdAt: string
    author: { nickname: string }
    post: { id: number; title: string; board: { slug: string } }
  }[]
  trends: {
    users: { date: string; count: number }[]
  }
}

interface LoginLog {
  id: number
  email: string
  ip: string
  success: boolean
  createdAt: string
}

export function DashboardContent() {
  const t = useTranslations('admin')
  const locale = useLocale()
  const dateLocale = locale === 'ko' ? ko : enUS
  const [data, setData] = useState<DashboardData | null>(null)
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [dashRes, logsRes] = await Promise.all([
          fetch("/api/admin/dashboard"),
          fetch("/api/admin/login-logs?limit=5"),
        ])
        const json = await dashRes.json()
        if (!dashRes.ok) throw new Error(json.error || "Failed to fetch")
        setData(json)

        if (logsRes.ok) {
          const logsData = await logsRes.json()
          setLoginLogs(logsData.logs || [])
        }
      } catch (err) {
        setError(t('dataLoadError'))
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [t])

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
        <p className="text-muted-foreground">{error || t('dataLoadFailed')}</p>
      </div>
    )
  }

  const formatGrowth = (value: number) => {
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value}%`
  }

  const formatTimeAgo = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: dateLocale })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" />
          {t('dashboard')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('welcomeMessage')}</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/users">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalUsers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className={data.stats.userGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatGrowth(data.stats.userGrowth)}
                </span> {t('vsLastMonth')}
              </p>
            </CardContent>
          </Card>
        </Link>

        {data.pluginStatus?.boards && (
          <Link href="/admin/boards">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('totalPosts')}</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.stats.totalPosts.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  <span className={data.stats.postGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatGrowth(data.stats.postGrowth)}
                  </span> {t('vsLastWeek')}
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        <Link href="/admin/users">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('activeUsersToday')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.activeUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className={data.stats.activeUserGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatGrowth(data.stats.activeUserGrowth)}
                </span> {t('vsYesterday')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('systemStatus')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{t('systemOk')}</div>
            <p className="text-xs text-muted-foreground">{t('allServicesRunning')}</p>
          </CardContent>
        </Card>
      </div>

      {/* 신규 가입자 추이 + 최근 로그인 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.trends && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('newUsers7d')}</CardTitle>
              <Link href="/admin/user-trends" className="text-sm text-muted-foreground hover:text-primary">
                {t('viewDetails')}
              </Link>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.trends.users?.map(item => ({
                  date: new Date(item.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
                  count: item.count,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(value) => [`${value}`, t('subscribers')]}
                  />
                  <Line
                    type="linear"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#3b82f6', stroke: '#3b82f6' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 최근 가입 회원 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('recentUsers')}</CardTitle>
            <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-primary">
              {t('viewAll')}
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noRecentUsers')}</p>
              ) : (
                data.recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                      {user.image ? (
                        <Image src={user.image} alt={user.nickname} width={32} height={32} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-primary">
                          {(user.nickname || user.email)?.[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.nickname}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatTimeAgo(user.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 최근 로그인 + 인기 게시글 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 로그인 기록 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('recentLogins')}</CardTitle>
            <Link href="/admin/login-logs" className="text-sm text-muted-foreground hover:text-primary">
              {t('viewAll')}
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loginLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noLoginLogs')}</p>
              ) : (
                loginLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {log.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.email}</p>
                      <p className="text-sm text-muted-foreground">{log.ip}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatTimeAgo(log.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 인기 게시글 */}
        {data.pluginStatus?.boards && data.popularPosts && data.popularPosts.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('popularPosts')}</CardTitle>
              <Link href="/posts/popular" target="_blank" className="text-sm text-muted-foreground hover:text-primary">
                {t('viewAll')}
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {data.popularPosts.map((post, idx) => (
                  <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`} target="_blank" className="flex items-center gap-3 hover:bg-muted/50 rounded-lg py-1.5 px-2 -mx-2 transition-colors">
                    <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                      idx === 0 ? 'bg-yellow-500 text-yellow-950' :
                      idx === 1 ? 'bg-gray-400 text-gray-900' :
                      idx === 2 ? 'bg-amber-600 text-amber-100' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <p className="text-xs text-muted-foreground">{post.board.name}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{post.likeCount}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{post.commentCount}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 최근 게시글 + 최근 댓글 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 게시글 */}
        {data.pluginStatus?.boards && data.recentPosts && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('recentPosts')}</CardTitle>
              <Link href="/posts/latest" target="_blank" className="text-sm text-muted-foreground hover:text-primary">
                {t('viewAll')}
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {data.recentPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noRecentPosts')}</p>
                ) : (
                  data.recentPosts.map((post) => (
                    <Link key={post.id} href={`/boards/${post.board.slug}/${post.id}`} target="_blank" className="flex items-center justify-between hover:bg-muted/50 rounded-lg py-1.5 px-2 -mx-2 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground">{post.author.nickname}</p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-2">{formatTimeAgo(post.createdAt)}</span>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 최근 댓글 */}
        {data.pluginStatus?.boards && data.recentComments && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('recentComments')}</CardTitle>
              <Link href="/comments/latest" target="_blank" className="text-sm text-muted-foreground hover:text-primary">
                {t('viewAll')}
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {data.recentComments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noRecentComments')}</p>
                ) : (
                  data.recentComments.map((comment) => (
                    <Link key={comment.id} href={`/boards/${comment.post.board.slug}/${comment.post.id}`} target="_blank" className="flex items-center justify-between hover:bg-muted/50 rounded-lg py-1.5 px-2 -mx-2 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{comment.content}</p>
                        <p className="text-xs text-muted-foreground">{comment.author.nickname} · {comment.post.title}</p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-2">{formatTimeAgo(comment.createdAt)}</span>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
