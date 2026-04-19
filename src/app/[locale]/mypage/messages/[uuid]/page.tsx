"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ConversationView } from "@/components/messaging/ConversationView"

interface Me { id: number; nickname: string; image: string | null }

export default function ThreadPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params)
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setMe(data.user)
        else router.replace('/login')
      })
  }, [router])

  if (!me || !uuid) return null
  return (
    <div className="max-w-3xl mx-auto w-full">
      <ConversationView conversationUuid={uuid} self={me} />
    </div>
  )
}
