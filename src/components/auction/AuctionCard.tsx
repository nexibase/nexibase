"use client"

import Link from "next/link"
import { AuctionStatusBadge } from "./AuctionStatusBadge"
import { AuctionTimer } from "./AuctionTimer"
import { Gavel } from "lucide-react"

interface AuctionCardProps {
  auction: {
    id: number
    title: string
    image: string | null
    currentPrice: number
    startingPrice: number
    bidCount: number
    status: string
    endsAt: string
    seller: { nickname: string }
  }
}

export function AuctionCard({ auction }: AuctionCardProps) {
  return (
    <Link
      href={`/auction/${auction.id}`}
      className="block border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-card"
    >
      <div className="aspect-[4/3] bg-muted relative">
        {auction.image ? (
          <img
            src={auction.image}
            alt={auction.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gavel className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <AuctionStatusBadge status={auction.status} />
        </div>
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2">{auction.title}</h3>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs text-muted-foreground">현재가</p>
            <p className="text-lg font-bold">
              {auction.currentPrice.toLocaleString()}
              <span className="text-sm font-normal">원</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">입찰</p>
            <p className="text-sm font-medium">{auction.bidCount}회</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
          <span>{auction.seller.nickname}</span>
          <AuctionTimer endsAt={auction.endsAt} status={auction.status} />
        </div>
      </div>
    </Link>
  )
}
