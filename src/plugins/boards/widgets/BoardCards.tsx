"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

interface Board {
  id: number
  slug: string
  name: string
  description: string | null
  postCount: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function BoardCards({ settings }: { settings?: Record<string, any> }) {
  const [boards, setBoards] = useState<Board[]>([])
  const limit = settings?.limit || 4

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const res = await fetch(`/api/boards?limit=${limit}`)
        if (res.ok) {
          const data = await res.json()
          setBoards(data.boards || [])
        }
      } catch (error) {
        console.error('BoardCards 데이터 조회 에러:', error)
      }
    }
    fetchBoards()
  }, [limit])

  if (boards.length === 0) return null

  return (
    <div className="space-y-3">
      {boards.slice(0, limit).map((board) => (
        <Link key={board.id} href={`/boards/${board.slug}`}>
          <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all duration-300 cursor-pointer group">
            <CardContent className="p-4 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">{board.name}</h3>
                  <Badge variant="secondary">{board.postCount}</Badge>
                </div>
                {board.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {board.description}
                  </p>
                )}
              </div>
              <div className="flex items-center text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span>바로가기</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
