"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react"
import Link from "next/link"
import PollResultBar from "./PollResultBar"

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "tech", label: "Tech" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "opinion", label: "Opinion" },
  { value: "fun", label: "Fun" },
  { value: "community", label: "Community" },
]

const MAX_VISIBLE_OPTIONS = 5

interface PollOption {
  id: number
  label: string
  emoji?: string
  votes: number
}

interface Poll {
  id: number
  question: string
  description?: string
  category?: string
  isAI?: boolean
  status: string
  totalVotes: number
  createdAt: string
  options: PollOption[]
}

interface Pagination {
  page: number
  totalPages: number
}

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, totalPages: 1 })
  const [category, setCategory] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchPolls = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "10" })
      if (category) params.set("category", category)
      const res = await fetch(`/api/polls?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPolls(data.polls || [])
        setPagination(data.pagination || { page: 1, totalPages: 1 })
      }
    } catch (err) {
      console.error("Failed to fetch polls:", err)
    } finally {
      setLoading(false)
    }
  }, [page, category])

  useEffect(() => {
    fetchPolls()
  }, [fetchPolls])

  const handleCategoryChange = (cat: string) => {
    setCategory(cat)
    setPage(1)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Polls</h1>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={category === cat.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleCategoryChange(cat.value)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Polls list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : polls.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No polls found.</div>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => {
            const visibleOptions = poll.options.slice(0, MAX_VISIBLE_OPTIONS)
            const hiddenCount = poll.options.length - MAX_VISIBLE_OPTIONS

            return (
              <Card key={poll.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  {/* Question */}
                  <div className="mb-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {poll.category && <Badge variant="secondary">{poll.category}</Badge>}
                      {poll.isAI && (
                        <Badge className="bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI
                        </Badge>
                      )}
                    </div>
                    <Link href={`/polls/${poll.id}`} className="text-lg font-semibold hover:text-primary transition-colors">
                      {poll.question}
                    </Link>
                  </div>

                  {/* Result bars */}
                  <div className="space-y-1.5">
                    {visibleOptions.map((opt, i) => (
                      <PollResultBar
                        key={opt.id}
                        label={opt.label}
                        emoji={opt.emoji}
                        votes={opt.votes}
                        total={poll.totalVotes}
                        index={i}
                      />
                    ))}
                    {hiddenCount > 0 && (
                      <Link href={`/polls/${poll.id}`} className="block text-xs text-primary hover:underline pl-2">
                        +{hiddenCount} more option{hiddenCount > 1 ? "s" : ""}
                      </Link>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(poll.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
