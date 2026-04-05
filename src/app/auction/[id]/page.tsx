"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { AuctionTimer } from "@/components/auction/AuctionTimer"
import { BidForm } from "@/components/auction/BidForm"
import { BidHistory } from "@/components/auction/BidHistory"
import { AutoBidForm } from "@/components/auction/AutoBidForm"
import { Gavel, Users, MessageCircle } from "lucide-react"
import Link from "next/link"
import { UserLayout } from "@/components/layout/UserLayout"

interface Auction {
  id: number
  sellerId: number
  title: string
  description: string
  image: string | null
  startingPrice: number
  currentPrice: number
  buyNowPrice: number | null
  bidIncrement: number
  bidCount: number
  startsAt: string
  endsAt: string
  status: string
  winnerId: number | null
  seller: { id: number; nickname: string; image: string | null }
  winner: { id: number; nickname: string } | null
  bids: {
    id: number
    amount: number
    isAutoBid: boolean
    createdAt: string
    user: { id: number; nickname: string }
  }[]
}

export default function AuctionDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const auctionId = parseInt(params.id as string)

  const validTabs = ["bids", "description", "qna"] as const
  type TabType = typeof validTabs[number]
  const tabParam = searchParams.get("tab") as TabType | null
  const initialTab = tabParam && validTabs.includes(tabParam) ? tabParam : "bids"

  const [auction, setAuction] = useState<Auction | null>(null)
  const [viewerCount, setViewerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [buyNowLoading, setBuyNowLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    const qs = tab === "bids" ? "" : `?tab=${tab}`
    window.history.replaceState(null, "", `/auction/${auctionId}${qs}`)
  }
  const eventSourceRef = useRef<EventSource | null>(null)

  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(`/api/auction/${auctionId}`)
      if (res.ok) {
        const data = await res.json()
        setAuction(data.auction)
        setViewerCount(data.viewerCount)
      }
    } catch (error) {
      console.error("경매 조회 에러:", error)
    } finally {
      setLoading(false)
    }
  }, [auctionId])

  // 현재 유저 정보
  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUserId(data.user.id)
      })
      .catch(() => {})
  }, [])

  // 경매 데이터 로드
  useEffect(() => {
    fetchAuction()
  }, [fetchAuction])

  // SSE 연결
  useEffect(() => {
    if (!auctionId) return

    const es = new EventSource(`/api/auction/${auctionId}/sse`)
    eventSourceRef.current = es

    es.addEventListener("bid", (e) => {
      const data = JSON.parse(e.data)
      setAuction((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          currentPrice: data.currentPrice,
          bidCount: prev.bidCount + 1,
          bids: [
            {
              id: Date.now(),
              amount: data.amount,
              isAutoBid: data.isAutoBid,
              createdAt: data.time,
              user: { id: 0, nickname: data.bidderNickname },
            },
            ...prev.bids,
          ].slice(0, 20),
        }
      })
    })

    es.addEventListener("ended", (e) => {
      const data = JSON.parse(e.data)
      setAuction((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          status: "ended",
          winnerId: data.winnerId,
          winner: data.winnerNickname
            ? { id: data.winnerId, nickname: data.winnerNickname }
            : null,
        }
      })
    })

    es.addEventListener("extended", (e) => {
      const data = JSON.parse(e.data)
      setAuction((prev) => {
        if (!prev) return prev
        return { ...prev, endsAt: data.newEndsAt }
      })
    })

    es.addEventListener("viewers", (e) => {
      const data = JSON.parse(e.data)
      setViewerCount(data.count)
    })

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [auctionId])

  const handleBuyNow = async () => {
    if (!confirm("즉시구매 하시겠습니까?")) return

    setBuyNowLoading(true)
    try {
      const res = await fetch(`/api/auction/${auctionId}/buy-now`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "즉시구매에 실패했습니다.")
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.")
    } finally {
      setBuyNowLoading(false)
    }
  }

  if (loading) {
    return (
      <UserLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
      </UserLayout>
    )
  }

  if (!auction) {
    return (
      <UserLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">경매를 찾을 수 없습니다.</p>
        <Link href="/auction" className="text-primary mt-4 inline-block">
          목록으로 돌아가기
        </Link>
      </div>
      </UserLayout>
    )
  }

  const isOwner = currentUserId === auction.sellerId
  const highestBidder = auction.bids[0]?.user
  const isHighestBidder =
    currentUserId !== null && highestBidder?.id === currentUserId

  return (
    <UserLayout>
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 상단 제목 */}
      <h1 className="text-xl font-bold mb-6">{auction.title}</h1>

      {/* 상단: 이미지 + 경매 정보 */}
      <div className="border border-border rounded-lg bg-card p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 왼쪽: 이미지 */}
          <div>
            <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              {auction.image ? (
                <img
                  src={auction.image}
                  alt={auction.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Gavel className="w-16 h-16 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 경매 정보 */}
          <div>
            {/* 판매자 + 시청자 */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                판매자: {auction.seller.nickname}
              </span>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                {viewerCount}명 시청중
              </div>
            </div>

            {/* 현재가 */}
            <div className="flex justify-between items-baseline py-3 border-t border-border">
              <span className="font-medium">현재가</span>
              <span className="text-3xl font-bold text-red-500">
                {auction.currentPrice.toLocaleString()}
                <span className="text-lg font-medium">원</span>
              </span>
            </div>

            {/* 가격 상세 */}
            <div className="space-y-2 py-3 border-t border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">시작가</span>
                <span>{auction.startingPrice.toLocaleString()}원</span>
              </div>
              {auction.buyNowPrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">즉시구매가</span>
                  <span className="font-medium">{auction.buyNowPrice.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">입찰 단위</span>
                <span>{auction.bidIncrement.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">입찰 횟수</span>
                <span>{auction.bidCount}회</span>
              </div>
            </div>

            {/* 남은 시간 */}
            <div className="py-3 border-t border-border">
              <p className="text-sm text-muted-foreground mb-1.5">남은 시간</p>
              <span className="inline-block px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded text-sm font-mono font-medium">
                <AuctionTimer
                  endsAt={auction.endsAt}
                  status={auction.status}
                  onExpired={fetchAuction}
                />
              </span>
            </div>

            {/* 종료된 경매 */}
            {auction.status === "ended" && (
              <div className="py-4 border-t border-border text-center">
                {auction.winner ? (
                  <p className="text-sm">
                    <span className="font-bold">{auction.winner.nickname}</span>
                    <span className="text-muted-foreground">님이 </span>
                    <span className="font-bold text-red-500">{auction.currentPrice.toLocaleString()}원</span>
                    <span className="text-muted-foreground">에 낙찰</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">유찰되었습니다.</p>
                )}
              </div>
            )}

            {/* 입찰 영역 */}
            {auction.status === "active" && currentUserId && (
              <div className="pt-3 border-t border-border space-y-3">
                <BidForm
                  auctionId={auction.id}
                  currentPrice={auction.currentPrice}
                  bidIncrement={auction.bidIncrement}
                  status={auction.status}
                  isOwner={isOwner}
                  isHighestBidder={isHighestBidder}
                />

                {auction.buyNowPrice && !isOwner && (
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={buyNowLoading}
                    className="w-full py-2.5 border border-orange-400 text-orange-500 rounded-md text-sm font-medium hover:bg-orange-50 dark:hover:bg-orange-950 disabled:opacity-50"
                  >
                    {buyNowLoading
                      ? "처리 중..."
                      : `${auction.buyNowPrice.toLocaleString()}원 즉시구매`}
                  </button>
                )}

                {!isOwner && (
                  <AutoBidForm
                    auctionId={auction.id}
                    currentPrice={auction.currentPrice}
                    bidIncrement={auction.bidIncrement}
                    status={auction.status}
                    isOwner={isOwner}
                  />
                )}
              </div>
            )}

            {/* 로그인 안내 */}
            {auction.status === "active" && !currentUserId && (
              <div className="pt-4 border-t border-border text-center">
                <p className="text-sm text-muted-foreground">
                  입찰하려면{" "}
                  <a
                    href={`/login?callbackUrl=${encodeURIComponent(`/auction/${auctionId}`)}`}
                    className="text-primary hover:underline font-medium"
                  >
                    로그인
                  </a>
                  이 필요합니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단: 탭 (입찰 히스토리 / 상품 설명 / Q&A) */}
      <div>
        <div className="flex border-b border-border">
          {[
            { key: "bids" as const, label: "입찰 히스토리" },
            { key: "description" as const, label: "상품 설명" },
            { key: "qna" as const, label: "Q&A" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="py-4">
          {/* 입찰 히스토리 */}
          {activeTab === "bids" && (
            <div className="divide-y divide-border">
              {auction.bids.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  아직 입찰이 없습니다.
                </p>
              ) : (
                auction.bids.map((bid) => (
                  <div
                    key={bid.id}
                    className="flex items-center justify-between py-4 px-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">{bid.user.nickname}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(bid.createdAt).toLocaleString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </span>
                      {bid.isAutoBid && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                          자동
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-red-500 text-sm">
                      {bid.amount.toLocaleString()}원
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 상품 설명 */}
          {activeTab === "description" && (
            <div className="px-2">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {auction.description}
              </p>
            </div>
          )}

          {/* Q&A */}
          {activeTab === "qna" && (
            <div>
              {currentUserId ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const form = e.target as HTMLFormElement
                    const textarea = form.querySelector("textarea") as HTMLTextAreaElement
                    const content = textarea.value.trim()
                    if (!content) return
                    alert("문의가 등록되었습니다. (Q&A API 연동 예정)")
                    textarea.value = ""
                  }}
                  className="mb-6"
                >
                  <textarea
                    placeholder="판매자에게 문의할 내용을 입력하세요."
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm resize-y"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
                    >
                      문의하기
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mb-6 p-4 border border-border rounded-md text-center">
                  <p className="text-sm text-muted-foreground">
                    문의를 작성하려면{" "}
                    <a href={`/login?callbackUrl=${encodeURIComponent(`/auction/${auctionId}`)}`} className="text-primary hover:underline">
                      로그인
                    </a>
                    이 필요합니다.
                  </p>
                </div>
              )}
              <div className="text-center py-8">
                <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  등록된 문의가 없습니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </UserLayout>
  )
}
