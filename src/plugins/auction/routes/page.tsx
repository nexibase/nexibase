"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AuctionCard } from "@/plugins/auction/components/AuctionCard"
import { Gavel, ChevronLeft, ChevronRight } from "lucide-react"
import { UserLayout } from "@/components/layout/UserLayout"

interface Auction {
  id: number
  title: string
  images: string | string[] | null
  currentPrice: number
  startingPrice: number
  bidCount: number
  status: string
  endsAt: string
  seller: { nickname: string }
}

const STATUS_TABS = [
  { value: "", label: "전체" },
  { value: "active", label: "진행중" },
  { value: "pending", label: "예정" },
  { value: "ended", label: "종료" },
]

export default function AuctionListPage() {
  return (
    <Suspense>
      <AuctionListContent />
    </Suspense>
  )
}

function AuctionListContent() {
  const searchParams = useSearchParams()
  const initialPage = parseInt(searchParams.get("page") || "1")
  const initialStatus = searchParams.get("status") || ""

  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(initialPage)
  const [status, setStatus] = useState(initialStatus)

  const updateURL = useCallback((newPage: number, newStatus: string) => {
    const params = new URLSearchParams()
    if (newPage > 1) params.set("page", String(newPage))
    if (newStatus) params.set("status", newStatus)
    const qs = params.toString()
    window.history.replaceState(null, "", `/auction${qs ? `?${qs}` : ""}`)
    setPage(newPage)
    setStatus(newStatus)
  }, [])

  const fetchAuctions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "12",
        ...(status && { status }),
      })

      const res = await fetch(`/api/auction?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAuctions(data.auctions)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error("경매 목록 조회 에러:", error)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    fetchAuctions()
  }, [fetchAuctions])

  const handleStatusChange = (newStatus: string) => {
    updateURL(1, newStatus)
  }

  return (
    <UserLayout>
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Gavel className="w-6 h-6" />
          <h1 className="text-2xl font-bold">경매</h1>
        </div>
        <a
          href="/auction/create"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          경매 등록
        </a>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              status === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-6 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Gavel className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>등록된 경매가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => updateURL(Math.max(1, page - 1), status)}
            disabled={page === 1}
            className="p-2 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground px-4">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => updateURL(Math.min(totalPages, page + 1), status)}
            disabled={page === totalPages}
            className="p-2 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
    </UserLayout>
  )
}
