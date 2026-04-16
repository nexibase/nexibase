"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Loader2, Sparkles, Lock, Vote } from "lucide-react"
import Link from "next/link"
import PollResultBar from "./PollResultBar"
import { useSite } from "@/lib/SiteContext"

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
  isMultiple: boolean
  isAi?: boolean
  status: string
  closesAt?: string
  totalVotes: number
  hasVoted: boolean
  votedOptionIds?: number[]
  options: PollOption[]
}

export default function PollDetail() {
  const { user } = useSite()
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const pollId = params?.id as string

  const [poll, setPoll] = useState<Poll | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [voting, setVoting] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const fetchPoll = useCallback(async () => {
    try {
      const res = await fetch(`/api/polls?limit=100`)
      if (res.ok) {
        const data = await res.json()
        const found = data.polls?.find((p: Poll) => String(p.id) === pollId)
        if (found) setPoll(found)
      }
    } catch (err) {
      console.error("Failed to fetch poll:", err)
    } finally {
      setLoading(false)
    }
  }, [pollId])

  useEffect(() => {
    fetchPoll()
  }, [fetchPoll])

  useEffect(() => {
    if (poll?.hasVoted || poll?.status === "closed") {
      setShowResults(true)
    }
  }, [poll])

  const isClosed = poll?.status === "closed" || (poll?.closesAt && new Date(poll.closesAt) < new Date())

  const toggleSelect = (optId: number) => {
    if (poll?.isMultiple) {
      setSelected((prev) => (prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]))
    } else {
      setSelected([optId])
    }
  }

  const handleVote = async () => {
    if (!poll || selected.length === 0) return
    if (!user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`)
      return
    }
    setVoting(true)
    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: selected }),
      })
      if (res.ok) {
        await fetchPoll()
        setSelected([])
        setShowResults(true)
      }
    } catch (err) {
      console.error("Vote failed:", err)
    } finally {
      setVoting(false)
    }
  }

  const handleCancelVote = async () => {
    if (!poll) return
    setVoting(true)
    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, { method: "DELETE" })
      if (res.ok) {
        await fetchPoll()
        setShowResults(false)
      }
    } catch (err) {
      console.error("Cancel vote failed:", err)
    } finally {
      setVoting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!poll) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-muted-foreground mb-4">Poll not found</p>
        <Link href="/polls">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Polls
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/polls" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Polls
      </Link>

      <Card>
        <CardContent className="p-6">
          {/* Header */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 mb-2">
              {poll.category && (
                <Badge variant="secondary">{poll.category}</Badge>
              )}
              {poll.isAi && (
                <Badge className="bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
              {isClosed && (
                <Badge variant="destructive">
                  <Lock className="h-3 w-3 mr-1" />
                  Closed
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold">{poll.question}</h1>
            {poll.description && (
              <p className="text-muted-foreground mt-1">{poll.description}</p>
            )}
          </div>

          {/* Options / Results */}
          {showResults ? (
            <div className="space-y-2">
              {poll.options.map((opt, i) => (
                <PollResultBar
                  key={opt.id}
                  label={opt.label}
                  emoji={opt.emoji}
                  votes={opt.votes}
                  total={poll.totalVotes}
                  index={i}
                  isSelected={poll.votedOptionIds?.includes(opt.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {poll.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleSelect(opt.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selected.includes(opt.id)
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {opt.emoji && <span className="mr-2">{opt.emoji}</span>}
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex items-center justify-between">
            <div className="flex gap-2">
              {!showResults && !isClosed && (
                <>
                  <Button onClick={handleVote} disabled={selected.length === 0 || voting}>
                    {voting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Vote className="h-4 w-4 mr-1" />
                    Vote
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowResults(true)}>
                    View results
                  </Button>
                </>
              )}
              {showResults && !poll.hasVoted && !isClosed && (
                <Button variant="outline" size="sm" onClick={() => setShowResults(false)}>
                  Back to vote
                </Button>
              )}
              {poll.hasVoted && !isClosed && (
                <Button variant="ghost" size="sm" onClick={handleCancelVote} disabled={voting}>
                  Cancel my vote
                </Button>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
