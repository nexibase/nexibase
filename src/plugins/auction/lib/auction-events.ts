import { EventEmitter } from "events"

const globalForAuction = globalThis as unknown as {
  auctionEmitter: EventEmitter | undefined
  auctionViewers: Map<number, Set<string>> | undefined
}

export const auctionEmitter =
  globalForAuction.auctionEmitter ?? new EventEmitter()

// 경매별 SSE 연결 관리 (참여자 수 추적)
export const auctionViewers: Map<number, Set<string>> =
  globalForAuction.auctionViewers ?? new Map()

if (process.env.NODE_ENV !== "production") {
  globalForAuction.auctionEmitter = auctionEmitter
  globalForAuction.auctionViewers = auctionViewers
}

auctionEmitter.setMaxListeners(1000)

export interface BidEvent {
  auctionId: number
  currentPrice: number
  bidCount: number
  bidderNickname: string
  amount: number
  isAutoBid: boolean
  time: string
}

export interface EndedEvent {
  auctionId: number
  winnerId: number | null
  winnerNickname: string | null
  finalPrice: number
}

export interface ExtendedEvent {
  auctionId: number
  newEndsAt: string
}

export function emitBid(data: BidEvent) {
  auctionEmitter.emit(`bid:${data.auctionId}`, data)
}

export function emitEnded(data: EndedEvent) {
  auctionEmitter.emit(`end:${data.auctionId}`, data)
}

export function emitExtended(data: ExtendedEvent) {
  auctionEmitter.emit(`extended:${data.auctionId}`, data)
}

export function addViewer(auctionId: number, connectionId: string) {
  if (!auctionViewers.has(auctionId)) {
    auctionViewers.set(auctionId, new Set())
  }
  auctionViewers.get(auctionId)!.add(connectionId)
}

export function removeViewer(auctionId: number, connectionId: string) {
  const viewers = auctionViewers.get(auctionId)
  if (viewers) {
    viewers.delete(connectionId)
    if (viewers.size === 0) {
      auctionViewers.delete(auctionId)
    }
  }
}

export function getViewerCount(auctionId: number): number {
  return auctionViewers.get(auctionId)?.size ?? 0
}
