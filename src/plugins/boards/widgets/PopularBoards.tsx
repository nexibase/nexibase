"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Flame } from "lucide-react"
import Link from "next/link"

interface Board {
  id: number
  slug: string
  name: string
  postCount: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PopularBoards({ settings }: { settings?: Record<string, any> }) {
  const t = useTranslations('boards')
  const [boards, setBoards] = useState<Board[]>([])
  const limit = settings?.limit || 5

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const res = await fetch(`/api/boards?limit=${limit}`)
        if (res.ok) {
          const data = await res.json()
          setBoards(data.boards || [])
        }
      } catch (error) {
        console.error('PopularBoards fetch failed:', error)
      }
    }
    fetchBoards()
  }, [limit])

  if (boards.length === 0) return null

  return (
    <Card className="h-full">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          {t('widgets.popularBoards')}
        </h2>
      </div>
      <CardContent className="p-0">
        <div className="divide-y">
          {boards.slice(0, limit).map((board, index) => (
            <Link
              key={board.id}
              href={`/boards/${board.slug}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                index === 0 ? 'bg-yellow-500 text-yellow-950' :
                index === 1 ? 'bg-gray-400 text-gray-900' :
                index === 2 ? 'bg-amber-600 text-amber-100' :
                'bg-muted text-muted-foreground'
              }`}>
                {index + 1}
              </span>
              <span className="flex-1 text-sm font-medium truncate">{board.name}</span>
              <Badge variant="secondary" className="text-xs">{board.postCount}</Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
