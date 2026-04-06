"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Gavel, ArrowRight, Clock } from "lucide-react"
import Link from "next/link"

interface Auction {
  id: number
  title: string
  currentPrice: number
  bidCount: number
  endsAt: string
  images: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AuctionLive({ settings }: { settings?: Record<string, any> }) {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [now, setNow] = useState(new Date())
  const limit = settings?.limit || 4

  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        const res = await fetch(`/api/auction?status=active&limit=${limit}`)
        if (res.ok) {
          const data = await res.json()
          setAuctions(data.auctions || [])
        }
      } catch (error) {
        console.error('AuctionLive 데이터 조회 에러:', error)
      }
    }
    fetchAuctions()
  }, [limit])

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTimeLeft = (endsAt: string) => {
    const end = new Date(endsAt)
    const diff = end.getTime() - now.getTime()
    if (diff <= 0) return '종료'
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    const secs = Math.floor((diff % 60000) / 1000)
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}일 ${hours % 24}시간`
    }
    return `${hours}시간 ${mins}분 ${secs}초`
  }

  if (auctions.length === 0) return null

  return (
    <Card className="h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Gavel className="h-4 w-4 text-primary" />
          진행중 경매
        </h2>
        <Link href="/auction" className="text-sm text-primary hover:underline flex items-center gap-1">
          더보기 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-3">
          {auctions.slice(0, limit).map((auction) => {
            const images = auction.images ? JSON.parse(auction.images) : []
            const thumbnail = images[0] || null
            return (
              <Link key={auction.id} href={`/auction/${auction.id}`}>
                <div className="group cursor-pointer rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all overflow-hidden">
                  {thumbnail && (
                    <div className="aspect-[4/3] bg-muted overflow-hidden">
                      <img
                        src={thumbnail}
                        alt={auction.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-sm font-medium truncate">{auction.title}</p>
                    <p className="text-sm font-bold text-primary mt-1">
                      {auction.currentPrice.toLocaleString()}원
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant="secondary" className="text-xs">
                        입찰 {auction.bidCount}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeLeft(auction.endsAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
