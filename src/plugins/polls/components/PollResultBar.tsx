"use client"

const BAR_COLORS = [
  { bg: "bg-blue-500", light: "bg-blue-500/20" },
  { bg: "bg-rose-500", light: "bg-rose-500/20" },
  { bg: "bg-emerald-500", light: "bg-emerald-500/20" },
  { bg: "bg-amber-500", light: "bg-amber-500/20" },
  { bg: "bg-violet-500", light: "bg-violet-500/20" },
  { bg: "bg-fuchsia-500", light: "bg-fuchsia-500/20" },
  { bg: "bg-cyan-500", light: "bg-cyan-500/20" },
  { bg: "bg-orange-500", light: "bg-orange-500/20" },
]

interface PollResultBarProps {
  label: string
  emoji?: string
  votes: number
  total: number
  index: number
  isSelected?: boolean
}

export default function PollResultBar({ label, emoji, votes, total, index, isSelected }: PollResultBarProps) {
  const pct = total > 0 ? Math.round((votes / total) * 100) : 0
  const color = BAR_COLORS[index % BAR_COLORS.length]

  return (
    <div className={`rounded-lg p-2.5 transition-colors ${isSelected ? "ring-2 ring-primary bg-primary/5" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium truncate">
          {emoji && <span className="mr-1.5">{emoji}</span>}
          {label}
        </span>
        <span className="text-xs text-muted-foreground ml-2 shrink-0">
          {pct}% ({votes})
        </span>
      </div>
      <div className={`h-2 rounded-full ${color.light} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color.bg} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
