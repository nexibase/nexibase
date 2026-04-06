"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { AuctionStatusBadge } from "@/plugins/auction/components/AuctionStatusBadge"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import { ArrowLeft, AlertTriangle } from "lucide-react"

interface AdminAuctionDetail {
  id: number
  title: string
  description: string
  image: string | null
  startingPrice: number
  currentPrice: number
  buyNowPrice: number | null
  bidIncrement: number
  bidCount: number
  status: string
  startsAt: string
  endsAt: string
  createdAt: string
  seller: { id: number; nickname: string; email: string }
  winner: { id: number; nickname: string } | null
  bids: {
    id: number
    amount: number
    isAutoBid: boolean
    createdAt: string
    user: { id: number; nickname: string }
  }[]
  autoBids: {
    id: number
    maxAmount: number
    isActive: boolean
    user: { id: number; nickname: string }
  }[]
}

export default function AdminAuctionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const auctionId = parseInt(params.id as string)

  const [auction, setAuction] = useState<AdminAuctionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const fetchAuction = async () => {
      try {
        const res = await fetch(`/api/admin/auction/${auctionId}`)
        if (res.ok) {
          const data = await res.json()
          setAuction(data.auction)
        }
      } catch (error) {
        console.error("관리자 경매 조회 에러:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchAuction()
  }, [auctionId])

  const handleForceEnd = async () => {
    if (!confirm("정말 이 경매를 강제 종료하시겠습니까?")) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/auction/${auctionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "force-end" }),
      })

      if (res.ok) {
        alert("경매가 강제 종료되었습니다.")
        router.push("/admin/auction")
      } else {
        const data = await res.json()
        alert(data.error || "처리에 실패했습니다.")
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!auction) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        경매를 찾을 수 없습니다.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={() => router.push("/admin/auction")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> 목록으로
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{auction.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <AuctionStatusBadge status={auction.status} />
            <span className="text-sm text-muted-foreground">
              ID: {auction.id}
            </span>
          </div>
        </div>
        {auction.status !== "ended" && (
          <button
            onClick={handleForceEnd}
            disabled={actionLoading}
            className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" />
            {actionLoading ? "처리 중..." : "강제 종료"}
          </button>
        )}
      </div>

      {/* 경매 정보 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">현재가</p>
          <p className="text-xl font-bold">
            {auction.currentPrice.toLocaleString()}원
          </p>
        </div>
        <div className="p-4 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">시작가</p>
          <p className="text-xl font-bold">
            {auction.startingPrice.toLocaleString()}원
          </p>
        </div>
        <div className="p-4 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">판매자</p>
          <p className="font-medium">
            {auction.seller.nickname} ({auction.seller.email})
          </p>
        </div>
        <div className="p-4 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">낙찰자</p>
          <p className="font-medium">
            {auction.winner ? auction.winner.nickname : "-"}
          </p>
        </div>
      </div>

      {/* 입찰 내역 테이블 */}
      <h2 className="text-lg font-bold mb-3">
        입찰 내역 ({auction.bids.length}건)
      </h2>
      <div className="border border-border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">입찰자</th>
              <th className="text-right px-4 py-2 font-medium">금액</th>
              <th className="text-center px-4 py-2 font-medium">유형</th>
              <th className="text-left px-4 py-2 font-medium">시간</th>
            </tr>
          </thead>
          <tbody>
            {auction.bids.map((bid) => (
              <tr key={bid.id} className="border-t border-border">
                <td className="px-4 py-2">{bid.user.nickname}</td>
                <td className="px-4 py-2 text-right font-medium">
                  {bid.amount.toLocaleString()}원
                </td>
                <td className="px-4 py-2 text-center">
                  {bid.isAutoBid ? (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                      자동
                    </span>
                  ) : (
                    "수동"
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {formatDistanceToNow(new Date(bid.createdAt), {
                    addSuffix: true,
                    locale: ko,
                  })}
                </td>
              </tr>
            ))}
            {auction.bids.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-4 text-center text-muted-foreground"
                >
                  입찰 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
