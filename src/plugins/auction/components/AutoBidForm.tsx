"use client"

import { useState } from "react"
import { X } from "lucide-react"

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
  const [isOpen, setIsOpen] = useState(false)
  const [maxAmount, setMaxAmount] = useState(
    existingAutoBid?.maxAmount || minAmount
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const disabled = status !== "active" || isOwner || loading

  const handleSubmit = async () => {
    if (maxAmount < minAmount) {
      setError(`최소 ${minAmount.toLocaleString()}원 이상이어야 합니다.`)
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/auction/${auctionId}/auto-bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxAmount }),
      })

      const data = await res.json()
      if (res.ok) {
        alert(`자동 입찰이 설정되었습니다. (최대 ${maxAmount.toLocaleString()}원)`)
        setIsOpen(false)
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
    <>
      <button
        type="button"
        onClick={() => { setMaxAmount(minAmount); setError(""); setIsOpen(true) }}
        disabled={disabled}
        className="w-full py-2 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
      >
        {existingAutoBid?.isActive
          ? `자동 입찰 중 (최대 ${existingAutoBid.maxAmount.toLocaleString()}원)`
          : "자동 입찰 설정"}
      </button>

      {/* 모달 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold mb-1">자동 입찰 설정</h3>
            <p className="text-xs text-muted-foreground mb-4">
              설정한 최대 금액까지 다른 사람이 입찰할 때마다 자동으로 입찰합니다.
            </p>

            <label className="block text-sm font-medium mb-1">최대 금액</label>
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(parseInt(e.target.value) || 0)}
                min={minAmount}
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-sm"
              />
              <span className="flex items-center text-sm text-muted-foreground">원</span>
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 py-2 text-sm border border-border rounded-md hover:bg-muted"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "설정 중..." : "설정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
