"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"

interface Board {
  id: number
  slug: string
  name: string
  description: string | null
  postCount: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function BoardCards({ settings }: { settings?: Record<string, any> }) {
  const [boards, setBoards] = useState<Board[]>(settings?.initialBoards ?? [])
  const [loading, setLoading] = useState(!Array.isArray(settings?.initialBoards))
  const limit = settings?.limit || 4

  useEffect(() => {
    if (Array.isArray(settings?.initialBoards)) {
      setBoards(settings.initialBoards)
      setLoading(false)
      return
    }
    const fetchBoards = async () => {
      try {
        const res = await fetch(`/api/boards?limit=${limit}`)
        if (res.ok) {
          const data = await res.json()
          setBoards(data.boards || [])
        }
      } catch (error) {
        console.error('BoardCards fetch failed:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchBoards()
  }, [limit, settings?.initialBoards])

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: limit }).map((_, i) => (
          <Card key={i} className="h-full">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (boards.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
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
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
