"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { AuctionStatusBadge } from "@/plugins/auction/components/AuctionStatusBadge"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import { Gavel, Search, ChevronLeft, ChevronRight } from "lucide-react"

interface AdminAuction {
  id: number
  title: string
  currentPrice: number
  bidCount: number
  status: string
  startsAt: string
  endsAt: string
  createdAt: string
  seller: { id: number; nickname: string; email: string }
  winner: { id: number; nickname: string } | null
  _count: { bids: number }
}

export default function AdminAuctionPage() {
  const [auctions, setAuctions] = useState<AdminAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchAuctions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search && { search }),
        ...(status && { status }),
      })

      const res = await fetch(`/api/admin/auction?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAuctions(data.auctions)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error("관리자 경매 목록 에러:", error)
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    fetchAuctions()
  }, [fetchAuctions])

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Gavel className="w-6 h-6" />
        <h1 className="text-2xl font-bold">경매 관리</h1>
      </div>

      {/* 필터 */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="경매 제목 검색..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-md bg-background text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="px-3 py-2 border border-border rounded-md bg-background text-sm"
        >
          <option value="">전체 상태</option>
          <option value="pending">예정</option>
          <option value="active">진행중</option>
          <option value="ended">종료</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">ID</th>
              <th className="text-left px-4 py-3 font-medium">제목</th>
              <th className="text-left px-4 py-3 font-medium">판매자</th>
              <th className="text-right px-4 py-3 font-medium">현재가</th>
              <th className="text-center px-4 py-3 font-medium">입찰</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="text-left px-4 py-3 font-medium">등록일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : auctions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  경매가 없습니다.
                </td>
              </tr>
            ) : (
              auctions.map((auction) => (
                <tr
                  key={auction.id}
                  className="border-t border-border hover:bg-muted/30"
                >
                  <td className="px-4 py-3">{auction.id}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/auction/${auction.id}`}
                      className="text-primary hover:underline"
                    >
                      {auction.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {auction.seller.nickname}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {auction.currentPrice.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-center">
                    {auction._count.bids}회
                  </td>
                  <td className="px-4 py-3 text-center">
                    <AuctionStatusBadge status={auction.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDistanceToNow(new Date(auction.createdAt), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground px-4">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
