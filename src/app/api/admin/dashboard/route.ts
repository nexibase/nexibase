import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // 날짜 계산
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    const lastWeekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

    // 통계 데이터 조회
    const [
      totalUsers,
      lastMonthUsers,
      totalPosts,
      lastWeekPosts,
      todayActiveUsers,
      yesterdayActiveUsers,
      recentUsers,
      recentPosts
    ] = await Promise.all([
      // 총 회원수
      prisma.user.count({
        where: { deletedAt: null }
      }),
      // 지난달 회원수
      prisma.user.count({
        where: {
          deletedAt: null,
          createdAt: { lt: lastMonthStart }
        }
      }),
      // 총 게시글 수
      prisma.post.count({
        where: { status: { not: "deleted" } }
      }),
      // 지난주 게시글 수
      prisma.post.count({
        where: {
          status: { not: "deleted" },
          createdAt: { lt: lastWeekStart }
        }
      }),
      // 오늘 활성 사용자 (로그인한 사용자)
      prisma.user.count({
        where: {
          deletedAt: null,
          lastLoginAt: { gte: todayStart }
        }
      }),
      // 어제 활성 사용자
      prisma.user.count({
        where: {
          deletedAt: null,
          lastLoginAt: {
            gte: yesterdayStart,
            lt: todayStart
          }
        }
      }),
      // 최근 가입 회원 5명
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          nickname: true,
          email: true,
          image: true,
          createdAt: true
        }
      }),
      // 최근 게시글 5개
      prisma.post.findMany({
        where: { status: { not: "deleted" } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
          author: {
            select: {
              nickname: true
            }
          },
          board: {
            select: {
              slug: true
            }
          }
        }
      })
    ])

    // 증감률 계산
    const userGrowth = lastMonthUsers > 0
      ? ((totalUsers - lastMonthUsers) / lastMonthUsers * 100).toFixed(1)
      : "0"

    const postGrowth = lastWeekPosts > 0
      ? ((totalPosts - lastWeekPosts) / lastWeekPosts * 100).toFixed(1)
      : "0"

    const activeUserGrowth = yesterdayActiveUsers > 0
      ? ((todayActiveUsers - yesterdayActiveUsers) / yesterdayActiveUsers * 100).toFixed(1)
      : "0"

    return NextResponse.json({
      stats: {
        totalUsers,
        userGrowth: parseFloat(userGrowth),
        totalPosts,
        postGrowth: parseFloat(postGrowth),
        activeUsers: todayActiveUsers,
        activeUserGrowth: parseFloat(activeUserGrowth)
      },
      recentUsers,
      recentPosts
    })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    )
  }
}
