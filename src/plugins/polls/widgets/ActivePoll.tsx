"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { BarChart3, Loader2, Vote } from "lucide-react"
import Link from "next/link"
import PollResultBar from "@/plugins/polls/components/PollResultBar"
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
  isMultiple: boolean
  status: string
  totalVotes: number
  hasVoted: boolean
  votedOptionIds?: number[]
  options: PollOption[]
}

export default function ActivePoll() {
  const { user } = useSite()
  const router = useRouter()
  const pathname = usePathname()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [voting, setVoting] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const fetchPoll = useCallback(async () => {
    try {
      const res = await fetch("/api/polls/current")
      if (res.ok) {
        const data = await res.json()
        setPoll(data.poll || null)
      }
    } catch (err) {
      console.error("ActivePoll fetch failed:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPoll()
  }, [fetchPoll])

  useEffect(() => {
    if (poll?.hasVoted) setShowResults(true)
  }, [poll])

  if (loading) return null
  if (!poll) return null

  const toggleSelect = (optId: number) => {
    if (poll.isMultiple) {
      setSelected((prev) => (prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]))
    } else {
      setSelected([optId])
    }
  }

  const handleVote = async () => {
    if (selected.length === 0) return
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

  return (
    <div className="flex flex-col gap-3">
      {/* Label */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <BarChart3 className="h-3.5 w-3.5" />
        Poll
      </div>

      {/* Question */}
      <Link href={`/polls/${poll.id}`} className="text-sm font-semibold hover:text-primary transition-colors leading-snug">
        {poll.question}
      </Link>

      {/* Options */}
      {showResults ? (
        <div className="space-y-1">
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
        <div className="space-y-1.5">
          {poll.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleSelect(opt.id)}
              className={`w-full text-left px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                selected.includes(opt.id)
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {opt.emoji && <span className="mr-1.5">{opt.emoji}</span>}
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        {!showResults ? (
          <Button size="sm" className="h-7 text-xs" onClick={handleVote} disabled={selected.length === 0 || voting}>
            {voting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            <Vote className="h-3 w-3 mr-1" />
            Vote
          </Button>
        ) : (
          <Link href={`/polls/${poll.id}`} className="text-xs text-primary hover:underline">
            Details &rarr;
          </Link>
        )}
        <span className="text-[11px] text-muted-foreground">
          {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}
