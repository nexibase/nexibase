import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isPluginEnabled } from "@/lib/plugins"

export async function GET() {
  try {
    // 플러그인 활성화 상태 확인
    const shopEnabled = await isPluginEnabled('shop')
    const auctionEnabled = await isPluginEnabled('auction')

    // 날짜 계산
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    const lastWeekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 커뮤니티 기본 통계 조회
    const [
      totalUsers,
      lastMonthUsers,
      totalPosts,
      lastWeekPosts,
      todayActiveUsers,
      yesterdayActiveUsers,
      recentUsers,
      recentPosts,
      popularPosts,
      dailyUsers
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
      }),
      // 인기 게시글 5개
      prisma.post.findMany({
        where: { status: { not: "deleted" } },
        orderBy: [{ viewCount: 'desc' }, { likeCount: 'desc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          board: { select: { slug: true, name: true } }
        }
      }),
      // 최근 7일 신규 가입자 추이
      prisma.$queryRaw`
        SELECT DATE(createdAt) as date, COUNT(*) as count
        FROM users
        WHERE createdAt >= ${lastWeekStart} AND deletedAt IS NULL
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `
    ])

    // 쇼핑몰 통계 (플러그인 활성화 시에만 조회)
    let totalOrders = 0
    let thisMonthOrders = 0
    let lastMonthOrders = 0
    let totalRevenue = { _sum: { finalPrice: 0 } }
    let thisMonthRevenue = { _sum: { finalPrice: 0 } }
    let lastMonthRevenue = { _sum: { finalPrice: 0 } }
    let totalProducts = 0
    let pendingOrders = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let recentOrders: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let popularProducts: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dailyOrders: any[] = []

    if (shopEnabled) {
      const shopResults = await Promise.all([
        // 총 주문수
        prisma.order.count(),
        // 이번달 주문수
        prisma.order.count({
          where: { createdAt: { gte: thisMonthStart } }
        }),
        // 지난달 주문수
        prisma.order.count({
          where: {
            createdAt: {
              gte: lastMonthStart,
              lt: thisMonthStart
            }
          }
        }),
        // 총 매출 (완료된 주문)
        prisma.order.aggregate({
          where: { status: { in: ['paid', 'preparing', 'shipped', 'delivered'] } },
          _sum: { finalPrice: true }
        }),
        // 이번달 매출
        prisma.order.aggregate({
          where: {
            status: { in: ['paid', 'preparing', 'shipped', 'delivered'] },
            createdAt: { gte: thisMonthStart }
          },
          _sum: { finalPrice: true }
        }),
        // 지난달 매출
        prisma.order.aggregate({
          where: {
            status: { in: ['paid', 'preparing', 'shipped', 'delivered'] },
            createdAt: {
              gte: lastMonthStart,
              lt: thisMonthStart
            }
          },
          _sum: { finalPrice: true }
        }),
        // 총 상품수
        prisma.product.count({
          where: { isActive: true }
        }),
        // 처리 대기 주문
        prisma.order.count({
          where: { status: 'paid' }
        }),
        // 최근 주문 5개
        prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            orderNo: true,
            finalPrice: true,
            status: true,
            createdAt: true,
            user: {
              select: { nickname: true }
            }
          }
        }),
        // 인기 상품 5개
        prisma.product.findMany({
          where: { isActive: true },
          orderBy: [{ soldCount: 'desc' }, { viewCount: 'desc' }],
          take: 5,
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            soldCount: true,
            viewCount: true,
            images: true
          }
        }),
        // 최근 7일 주문 추이
        prisma.$queryRaw`
          SELECT DATE(createdAt) as date, COUNT(*) as count, SUM(finalPrice) as revenue
          FROM orders
          WHERE createdAt >= ${lastWeekStart}
          GROUP BY DATE(createdAt)
          ORDER BY date ASC
        `
      ])

      totalOrders = shopResults[0]
      thisMonthOrders = shopResults[1]
      lastMonthOrders = shopResults[2]
      totalRevenue = shopResults[3]
      thisMonthRevenue = shopResults[4]
      lastMonthRevenue = shopResults[5]
      totalProducts = shopResults[6]
      pendingOrders = shopResults[7]
      recentOrders = shopResults[8]
      popularProducts = shopResults[9]
      dailyOrders = shopResults[10] as any[]
    }

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

    // 최근 7일 추이 데이터 정리 (빈 날짜 채우기)
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
      date,
      count: userTrendMap.get(date) || 0
    }))

    // 쇼핑몰 추이 데이터 (플러그인 활성화 시에만)
    let orderTrend: { date: string; orders: number; revenue: number }[] = []
    if (shopEnabled) {
      // 주문 증감률
      const orderGrowth = lastMonthOrders > 0
        ? ((thisMonthOrders - lastMonthOrders) / lastMonthOrders * 100).toFixed(1)
        : "0"

      // 매출 증감률
      const thisMonthRevenueValue = thisMonthRevenue._sum.finalPrice || 0
      const lastMonthRevenueValue = lastMonthRevenue._sum.finalPrice || 0
      const revenueGrowth = lastMonthRevenueValue > 0
        ? ((thisMonthRevenueValue - lastMonthRevenueValue) / lastMonthRevenueValue * 100).toFixed(1)
        : "0"

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderTrendMap = new Map((dailyOrders as any[]).map(d => [
        new Date(d.date).toISOString().split('T')[0],
        { count: Number(d.count), revenue: Number(d.revenue) }
      ]))

      orderTrend = last7Days.map(date => ({
        date,
        orders: orderTrendMap.get(date)?.count || 0,
        revenue: orderTrendMap.get(date)?.revenue || 0
      }))

      return NextResponse.json({
        pluginStatus: {
          shop: shopEnabled,
          auction: auctionEnabled
        },
        stats: {
          totalUsers,
          userGrowth: parseFloat(userGrowth),
          totalPosts,
          postGrowth: parseFloat(postGrowth),
          activeUsers: todayActiveUsers,
          activeUserGrowth: parseFloat(activeUserGrowth)
        },
        shopStats: {
          totalOrders,
          thisMonthOrders,
          orderGrowth: parseFloat(orderGrowth),
          totalRevenue: totalRevenue._sum.finalPrice || 0,
          thisMonthRevenue: thisMonthRevenueValue,
          revenueGrowth: parseFloat(revenueGrowth),
          totalProducts,
          pendingOrders
        },
        recentUsers,
        recentPosts,
        recentOrders,
        popularProducts: popularProducts.map(p => ({
          ...p,
          image: p.images ? JSON.parse(p.images)[0] : null
        })),
        popularPosts,
        trends: {
          orders: orderTrend,
          users: userTrend
        }
      })
    }

    // 쇼핑몰 비활성화 시 응답
    return NextResponse.json({
      pluginStatus: {
        shop: shopEnabled,
        auction: auctionEnabled
      },
      stats: {
        totalUsers,
        userGrowth: parseFloat(userGrowth),
        totalPosts,
        postGrowth: parseFloat(postGrowth),
        activeUsers: todayActiveUsers,
        activeUserGrowth: parseFloat(activeUserGrowth)
      },
      recentUsers,
      recentPosts,
      popularPosts,
      trends: {
        users: userTrend
      }
    })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    )
  }
}
