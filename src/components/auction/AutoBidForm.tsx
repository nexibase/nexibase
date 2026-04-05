"use client"

import { useState } from "react"

interface AutoBidFormProps {
  auctionId: number
  currentPrice: number
  bidIncrement: number
  status: string
  isOwner: boolean
  existingAutoBid?: { maxAmount: number; isActive: boolean } | null
}

export function AutoBidForm({
  auctionId,
  currentPrice,
  bidIncrement,
  status,
  isOwner,
  existingAutoBid,
}: AutoBidFormProps) {
  const minAmount = currentPrice + bidIncrement
  const [maxAmount, setMaxAmount] = useState(
    existingAutoBid?.maxAmount || minAmount
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const disabled = status !== "active" || isOwner || loading

  const handleSubmit = async () => {
    if (maxAmount < minAmount) {
      setError(`최소 ${minAmount.toLocaleString()}원 이상이어야 합니다.`)
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch(`/api/auction/${auctionId}/auto-bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxAmount }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(
          `자동 입찰이 설정되었습니다. (최대 ${maxAmount.toLocaleString()}원)`
        )
      } else {
        setError(data.error || "자동 입찰 설정에 실패했습니다.")
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
      <h4 className="text-sm font-medium">자동 입찰 설정</h4>
      <p className="text-xs text-muted-foreground">
        설정한 최대 금액까지 자동으로 입찰합니다.
      </p>

      {existingAutoBid?.isActive && (
        <p className="text-xs text-blue-600 dark:text-blue-400">
          현재 자동 입찰 활성: 최대 {existingAutoBid.maxAmount.toLocaleString()}원
        </p>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(parseInt(e.target.value) || 0)}
          min={minAmount}
          disabled={disabled}
          className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-sm"
          placeholder="최대 입찰 금액"
        />
        <span className="flex items-center text-sm text-muted-foreground">원</span>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled}
        className="w-full py-2 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
      >
        {loading ? "설정 중..." : "자동 입찰 설정"}
      </button>
    </div>
  )
}
