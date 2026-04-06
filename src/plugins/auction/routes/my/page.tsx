"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AuctionStatusBadge } from "@/plugins/auction/components/AuctionStatusBadge"
import { Gavel, ShoppingBag } from "lucide-react"
import { UserLayout } from "@/components/layout/UserLayout"

interface MyBid {
  id: number
  amount: number
  createdAt: string
  auction: {
    id: number
    title: string
    currentPrice: number
    status: string
    winnerId: number | null
  }
}

interface MyAuction {
  id: number
  title: string
  currentPrice: number
  bidCount: number
  status: string
  endsAt: string
  winnerId: number | null
}

export default function MyAuctionPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"bids" | "selling">("bids")
  const [myBids, setMyBids] = useState<MyBid[]>([])
  const [myAuctions, setMyAuctions] = useState<MyAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<number | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch("/api/me")
        if (!meRes.ok) {
          router.push("/login")
          return
        }
        const meData = await meRes.json()
        if (!meData.user) {
          router.push("/login")
          return
        }
        setUserId(meData.user.id)

        // 내 입찰과 내 판매 경매를 동시 조회
        const [bidsRes, auctionsRes] = await Promise.all([
          fetch("/api/auction?myBids=true"),
          fetch("/api/auction?mySelling=true"),
        ])

        // 내 입찰 — 별도 API가 없으므로 전체 경매에서 클라이언트 필터
        // 실제로는 서버에서 처리하는 게 좋지만, 현재 API 구조에서는 상세 조회로 대체
        if (auctionsRes.ok) {
          const data = await auctionsRes.json()
          setMyAuctions(data.auctions || [])
        }
      } catch {
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  if (loading) {
    return (
      <UserLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </div>
      </UserLayout>
    )
  }

  return (
    <UserLayout>
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">내 경매</h1>

      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setTab("bids")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "bids"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <Gavel className="w-4 h-4 inline mr-1" />내 입찰
        </button>
        <button
          onClick={() => setTab("selling")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "selling"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <ShoppingBag className="w-4 h-4 inline mr-1" />내 판매
        </button>
      </div>

      {tab === "selling" && (
        <div className="space-y-3">
          {myAuctions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              등록한 경매가 없습니다.
            </p>
          ) : (
            myAuctions.map((auction) => (
              <Link
                key={auction.id}
                href={`/auction/${auction.id}`}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{auction.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <AuctionStatusBadge status={auction.status} />
                    <span className="text-sm text-muted-foreground">
                      입찰 {auction.bidCount}회
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">
                    {auction.currentPrice.toLocaleString()}원
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === "bids" && (
        <p className="text-center py-8 text-muted-foreground">
          입찰 내역은 각 경매 상세 페이지에서 확인할 수 있습니다.
        </p>
      )}
    </div>
    </UserLayout>
  )
}
