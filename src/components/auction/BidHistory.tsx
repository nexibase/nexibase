"use client"

import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"

interface Bid {
  id: number
  amount: number
  isAutoBid: boolean
  createdAt: string
  user: { id: number; nickname: string }
}

interface BidHistoryProps {
  bids: Bid[]
}

export function BidHistory({ bids }: BidHistoryProps) {
  if (bids.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        아직 입찰이 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {bids.map((bid, index) => (
        <div
          key={bid.id}
          className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
            index === 0
              ? "bg-primary/5 border border-primary/20"
              : "border border-border"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{bid.user.nickname}</span>
            {bid.isAutoBid && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                자동
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="font-bold">{bid.amount.toLocaleString()}원</span>
            <span className="text-xs text-muted-foreground ml-2">
              {formatDistanceToNow(new Date(bid.createdAt), {
                addSuffix: true,
                locale: ko,
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
