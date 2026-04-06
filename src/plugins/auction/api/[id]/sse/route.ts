import { NextRequest } from "next/server"
import {
  auctionEmitter,
  addViewer,
  removeViewer,
  getViewerCount,
  BidEvent,
  EndedEvent,
  ExtendedEvent,
} from "@/plugins/auction/lib/auction-events"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auctionId = parseInt(id)

  if (isNaN(auctionId)) {
    return new Response("Invalid auction ID", { status: 400 })
  }

  const connectionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // 연결 끊김
        }
      }

      // 연결 시 참여자 등록
      addViewer(auctionId, connectionId)
      send("viewers", { count: getViewerCount(auctionId) })

      // 이벤트 리스너 등록
      const onBid = (data: BidEvent) => send("bid", data)
      const onEnded = (data: EndedEvent) => send("ended", data)
      const onExtended = (data: ExtendedEvent) => send("extended", data)

      auctionEmitter.on(`bid:${auctionId}`, onBid)
      auctionEmitter.on(`end:${auctionId}`, onEnded)
      auctionEmitter.on(`extended:${auctionId}`, onExtended)

      // 30초마다 참여자 수 + keepalive
      const viewerInterval = setInterval(() => {
        send("viewers", { count: getViewerCount(auctionId) })
      }, 30_000)

      // 연결 종료 시 정리
      request.signal.addEventListener("abort", () => {
        removeViewer(auctionId, connectionId)
        auctionEmitter.off(`bid:${auctionId}`, onBid)
        auctionEmitter.off(`end:${auctionId}`, onEnded)
        auctionEmitter.off(`extended:${auctionId}`, onExtended)
        clearInterval(viewerInterval)

        // 다른 참여자들에게 업데이트된 참여자 수 알림
        const remaining = getViewerCount(auctionId)
        auctionEmitter.emit(`viewers:${auctionId}`, { count: remaining })

        try {
          controller.close()
        } catch {
          // 이미 닫힘
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
