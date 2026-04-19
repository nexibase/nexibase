"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, EyeOff, Eye, Send } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko, enUS } from "date-fns/locale"

interface Message {
  id: number
  senderId: number
  content: string
  createdAt: string
}

// Guard against races between polling and post-send refetch:
// both call /api/messages/<uuid>?after=<lastId> and can overlap.
function mergeUniqueAppend(prev: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return prev
  const seen = new Set(prev.map(m => m.id))
  const filtered = incoming.filter(m => !seen.has(m.id))
  return filtered.length === 0 ? prev : [...prev, ...filtered]
}
function mergeUniquePrepend(prev: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return prev
  const seen = new Set(prev.map(m => m.id))
  const filtered = incoming.filter(m => !seen.has(m.id))
  return filtered.length === 0 ? prev : [...filtered, ...prev]
}

interface ConversationMeta {
  id: number
  opponent: { id: number; nickname: string; image: string | null }
  hiddenByMe: boolean
}

interface Self {
  id: number
  nickname: string
  image: string | null
}

interface Props {
  conversationUuid: string
  self: Self
}

export function ConversationView({ conversationUuid, self }: Props) {
  const t = useTranslations('mypage.messagesThread')
  const tMessages = useTranslations('mypage.messages')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dfLocale = locale === 'ko' ? ko : enUS
  const router = useRouter()

  const [meta, setMeta] = useState<ConversationMeta | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const topSentinelRef = useRef<HTMLDivElement | null>(null)

  const markRead = useCallback(() => {
    fetch(`/api/messages/${conversationUuid}/read`, { method: 'PUT' }).catch(() => {})
  }, [conversationUuid])

  // Initial load
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/messages/${conversationUuid}`)
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) router.replace('/mypage/messages')
        return
      }
      const data = await res.json()
      if (cancelled) return
      setMeta(data.conversation)
      setMessages(data.messages)
      setHasMore(data.hasMore)
      setLoading(false)
      markRead()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (el) el.scrollTo({ top: el.scrollHeight })
        })
      })
    })()
    return () => { cancelled = true }
  }, [conversationUuid, markRead, router])

  // Polling for new messages — scoped to this page only.
  // Pauses when the tab is not visible (no background polling).
  useEffect(() => {
    if (loading) return
    let timer: ReturnType<typeof setInterval> | null = null
    const poll = async () => {
      if (messages.length === 0) return
      const lastId = messages[messages.length - 1].id
      const res = await fetch(`/api/messages/${conversationUuid}?after=${lastId}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.messages.length > 0) {
        const el = scrollRef.current
        const nearBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight < 200) : true
        setMessages(prev => mergeUniqueAppend(prev, data.messages))
        markRead()
        if (nearBottom) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const el2 = scrollRef.current
              if (el2) el2.scrollTo({ top: el2.scrollHeight })
            })
          })
        }
      }
    }
    const start = () => {
      if (timer) return
      timer = setInterval(poll, 5000)
    }
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null }
    }
    if (document.visibilityState === 'visible') start()
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        poll() // immediate catch-up on re-focus
        start()
      } else {
        stop()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      stop()
    }
  }, [loading, messages, conversationUuid, markRead])

  // Load earlier when the top sentinel appears
  useEffect(() => {
    if (loading || !hasMore) return
    const sentinel = topSentinelRef.current
    if (!sentinel) return
    const obs = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting) return
      if (loadingEarlier || messages.length === 0) return
      setLoadingEarlier(true)
      const firstId = messages[0].id
      const el = scrollRef.current
      const prevScrollHeight = el?.scrollHeight ?? 0
      const res = await fetch(`/api/messages/${conversationUuid}?before=${firstId}`)
      setLoadingEarlier(false)
      if (!res.ok) return
      const data = await res.json()
      setMessages(prev => mergeUniquePrepend(prev, data.messages))
      setHasMore(data.hasMore)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!el) return
          const diff = el.scrollHeight - prevScrollHeight
          el.scrollTop = diff
        })
      })
    })
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [loading, hasMore, messages, conversationUuid, loadingEarlier])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    const content = draft.trim()
    if (content.length === 0 || content.length > 2000) return
    setSending(true)
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: meta!.opponent.id, content }),
      })
      if (!res.ok) return
      setDraft('')
      setTimeout(async () => {
        const lastId = messages[messages.length - 1]?.id ?? 0
        const r2 = await fetch(`/api/messages/${conversationUuid}?after=${lastId}`)
        if (r2.ok) {
          const d2 = await r2.json()
          if (d2.messages.length > 0) {
            setMessages(prev => mergeUniqueAppend(prev, d2.messages))
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                const el = scrollRef.current
                if (el) el.scrollTo({ top: el.scrollHeight })
              })
            })
          }
        }
      }, 300)
    } finally {
      setSending(false)
    }
  }

  async function toggleHide() {
    if (!meta) return
    const next = !meta.hiddenByMe
    await fetch(`/api/messages/${conversationUuid}/hide`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: next }),
    })
    setMeta({ ...meta, hiddenByMe: next })
  }

  if (loading || !meta) {
    return <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[70vh] md:max-h-[720px] md:border md:rounded-lg md:overflow-hidden md:my-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/mypage/messages')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {meta.opponent.image ? (
              <img src={meta.opponent.image} alt={meta.opponent.nickname} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-medium text-primary">{(meta.opponent.nickname || '?').charAt(0)}</span>
            )}
          </div>
          <span className="font-medium truncate">{meta.opponent.nickname}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleHide} title={meta.hiddenByMe ? tMessages('unhideAction') : tMessages('hideAction')}>
          {meta.hiddenByMe ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {hasMore && <div ref={topSentinelRef} className="text-center text-xs text-muted-foreground py-2">{tc('loading')}</div>}
        {messages.map(m => {
          const mine = m.senderId === self.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%]">
                <div
                  className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
                <div
                  className={`text-[10px] text-muted-foreground mt-0.5 ${mine ? 'text-right' : 'text-left'}`}
                  title={new Date(m.createdAt).toLocaleString(locale)}
                >
                  {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: dfLocale })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <form onSubmit={send} className="p-3 border-t flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              send(e as unknown as React.FormEvent)
            }
          }}
          placeholder={t('placeholder')}
          rows={1}
          maxLength={2000}
          className="resize-none"
        />
        <Button type="submit" disabled={sending || draft.trim().length === 0}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <div className="px-3 py-1 text-[10px] text-muted-foreground text-right">
        {draft.length}/2000
      </div>
    </div>
  )
}
