"use client"

import { useState } from "react"

interface BidFormProps {
  auctionId: number
  currentPrice: number
  bidIncrement: number
  status: string
  isOwner: boolean
  isHighestBidder: boolean
}

export function BidForm({
  auctionId,
  currentPrice,
  bidIncrement,
  status,
  isOwner,
  isHighestBidder,
}: BidFormProps) {
  const [amount, setAmount] = useState(currentPrice + bidIncrement)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const minBid = currentPrice + bidIncrement
  const disabled = status !== "active" || isOwner || isHighestBidder || loading

  const handleBid = async () => {
    if (amount < minBid) {
      setError(`최소 ${minBid.toLocaleString()}원 이상 입찰해주세요.`)
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/auction/${auctionId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "입찰에 실패했습니다.")
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const quickBid = (add: number) => {
    setAmount(currentPrice + bidIncrement + add)
  }

  // currentPrice 변경 시 최소 금액 업데이트
  if (amount < minBid) {
    setAmount(minBid)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">입찰 금액</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            min={minBid}
            step={bidIncrement}
            disabled={disabled}
            className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-sm"
          />
          <span className="flex items-center text-sm text-muted-foreground">원</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => quickBid(0)}
          disabled={disabled}
          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          최소
        </button>
        <button
          type="button"
          onClick={() => quickBid(10000)}
          disabled={disabled}
          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          +1만
        </button>
        <button
          type="button"
          onClick={() => quickBid(50000)}
          disabled={disabled}
          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          +5만
        </button>
        <button
          type="button"
          onClick={() => quickBid(100000)}
          disabled={disabled}
          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          +10만
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {isOwner && (
        <p className="text-sm text-muted-foreground">본인의 경매에는 입찰할 수 없습니다.</p>
      )}

      {isHighestBidder && (
        <p className="text-sm text-blue-600 dark:text-blue-400">
          현재 최고가 입찰자입니다.
        </p>
      )}

      <button
        type="button"
        onClick={handleBid}
        disabled={disabled}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "입찰 중..." : `${amount.toLocaleString()}원 입찰하기`}
      </button>
    </div>
  )
}
