"use client"

import { useState, useEffect } from "react"

interface AuctionTimerProps {
  endsAt: string
  status: string
  onExpired?: () => void
  showFull?: boolean // 항상 시:분:초 표시
}

export function AuctionTimer({ endsAt, status, onExpired, showFull }: AuctionTimerProps) {
  const [timeLeft, setTimeLeft] = useState("")
  const [isUrgent, setIsUrgent] = useState(false)

  useEffect(() => {
    if (status !== "active") {
      setTimeLeft(status === "pending" ? "시작 전" : "종료됨")
      return
    }

    const update = () => {
      const now = new Date().getTime()
      const end = new Date(endsAt).getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeLeft("종료됨")
        onExpired?.()
        return false
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setIsUrgent(diff < 5 * 60 * 1000) // 5분 미만

      if (showFull) {
        const hh = String(hours).padStart(2, "0")
        const mm = String(minutes).padStart(2, "0")
        const ss = String(seconds).padStart(2, "0")
        setTimeLeft(days > 0 ? `${days}일 ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`)
      } else if (days > 0) {
        setTimeLeft(`${days}일 ${hours}시간`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}시간 ${minutes}분`)
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}분 ${seconds}초`)
      } else {
        setTimeLeft(`${seconds}초`)
      }

      return true
    }

    update()
    const interval = setInterval(() => {
      if (!update()) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [endsAt, status, onExpired])

  return (
    <span
      className={`font-mono ${
        isUrgent
          ? "text-red-600 dark:text-red-400 font-bold animate-pulse"
          : "text-muted-foreground"
      }`}
    >
      {timeLeft}
    </span>
  )
}
