"use client"

interface AuctionStatusBadgeProps {
  status: string
}

export function AuctionStatusBadge({ status }: AuctionStatusBadgeProps) {
  const config: Record<string, { label: string; className: string }> = {
    pending: {
      label: "예정",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    },
    active: {
      label: "진행중",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    },
    ended: {
      label: "종료",
      className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    },
  }

  const { label, className } = config[status] || config.ended

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
