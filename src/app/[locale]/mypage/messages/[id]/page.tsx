"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ConversationView } from "@/components/messaging/ConversationView"

interface Me { id: number }

export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const conversationId = parseInt(id)
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

  if (!me || !Number.isFinite(conversationId)) return null
  return (
    <div className="max-w-3xl mx-auto w-full">
      <ConversationView conversationId={conversationId} selfId={me.id} />
    </div>
  )
}
