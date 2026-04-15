import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isPluginEnabled } from "@/lib/plugins"

export async function GET() {
  try {
    const boardsEnabled = await isPluginEnabled('boards')

    // Date math
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    const lastWeekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

    // === Core stats (always) ===
    const [
      totalUsers,
      lastMonthUsers,
      todayActiveUsers,
      yesterdayActiveUsers,
      recentUsers,
      dailyUsers
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { lt: lastMonthStart } } }),
      prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: todayStart } } }),
      prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: yesterdayStart, lt: todayStart } } }),
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, nickname: true, email: true, image: true, createdAt: true }
      }),
      prisma.$queryRaw`
        SELECT DATE(createdAt) as date, COUNT(*) as count
        FROM users
        WHERE createdAt >= ${lastWeekStart} AND deletedAt IS NULL
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `
    ])

    // === Board stats (when the boards plugin is enabled) ===
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let totalPosts = 0, lastWeekPosts = 0, recentPosts: any[] = [], popularPosts: any[] = [], recentComments: any[] = []

    if (boardsEnabled) {
      const boardsResults = await Promise.all([
        prisma.post.count({ where: { status: { not: "deleted" } } }),
        prisma.post.count({ where: { status: { not: "deleted" }, createdAt: { lt: lastWeekStart } } }),
        prisma.post.findMany({
          where: { status: { not: "deleted" } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true, title: true, createdAt: true,
            author: { select: { nickname: true } },
            board: { select: { slug: true } }
          }
        }),
        prisma.post.findMany({
          where: { status: { not: "deleted" } },
          orderBy: [{ viewCount: 'desc' }, { likeCount: 'desc' }],
          take: 5,
          select: {
            id: true, title: true, viewCount: true, likeCount: true, commentCount: true,
            board: { select: { slug: true, name: true } }
          }
        })
      ])
      totalPosts = boardsResults[0]
      lastWeekPosts = boardsResults[1]
      recentPosts = boardsResults[2]
      popularPosts = boardsResults[3]

      recentComments = await prisma.comment.findMany({
        where: { status: { not: "deleted" } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true, content: true, createdAt: true,
          author: { select: { nickname: true } },
          post: { select: { id: true, title: true, board: { select: { slug: true } } } }
        }
      })
    }

    // === Growth calculations ===
    const userGrowth = lastMonthUsers > 0
      ? ((totalUsers - lastMonthUsers) / lastMonthUsers * 100).toFixed(1) : "0"
    const postGrowth = lastWeekPosts > 0
      ? ((totalPosts - lastWeekPosts) / lastWeekPosts * 100).toFixed(1) : "0"
    const activeUserGrowth = yesterdayActiveUsers > 0
      ? ((todayActiveUsers - yesterdayActiveUsers) / yesterdayActiveUsers * 100).toFixed(1) : "0"

    // === 7-day trend ===
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
      last7Days.push(date.toISOString().split('T')[0])
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userTrendMap = new Map((dailyUsers as any[]).map(d => [
      new Date(d.date).toISOString().split('T')[0],
      Number(d.count)
    ]))

    const userTrend = last7Days.map(date => ({
      date, count: userTrendMap.get(date) || 0
    }))

    return NextResponse.json({
      pluginStatus: { boards: boardsEnabled },
      stats: {
        totalUsers,
        userGrowth: parseFloat(userGrowth),
        totalPosts,
        postGrowth: parseFloat(postGrowth),
        activeUsers: todayActiveUsers,
        activeUserGrowth: parseFloat(activeUserGrowth)
      },
      recentUsers,
      ...(boardsEnabled ? { recentPosts, popularPosts, recentComments } : {}),
      trends: { users: userTrend }
    })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    )
  }
}
