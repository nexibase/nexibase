'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Secrets } from '@/lib/notifications/config'

export function NotificationSecretField({ name, label, value, configured, disabled, onChange }: {
  name: keyof Secrets; label: string; value: string; configured: boolean; disabled?: boolean; onChange: (value: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const [savedValue, setSavedValue] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  async function toggle() {
    setError('')
    if (visible) { setVisible(false); setSavedValue(null); return }
    if (value) { setVisible(true); return }
    if (!configured) return
    const controller = new AbortController()
    pending.current = controller
    setLoading(true)
    try {
      const response = await fetch('/api/admin/notifications/secrets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: controller.signal,
        body: JSON.stringify({ key: name }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '저장된 값을 불러오지 못했습니다.')
      setSavedValue(result.value); setVisible(true)
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '저장된 값을 불러오지 못했습니다.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
      if (pending.current === controller) pending.current = null
    }
  }
  const id = `notification-${name}`
  const toggleLabel = `${label} ${visible ? '숨기기' : '보기'}`
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input id={id} type={visible ? 'text' : 'password'} value={savedValue ?? value} className="pr-11" autoComplete="new-password" spellCheck={false}
        disabled={disabled || loading} placeholder={configured ? '설정됨 · 변경할 때만 입력' : '미설정'} aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => { setSavedValue(null); setError(''); onChange(event.target.value) }} />
      <Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-0.5 h-8 w-9" aria-label={toggleLabel} title={toggleLabel}
        aria-pressed={visible} aria-controls={id} aria-busy={loading} disabled={disabled || loading || (!value && !configured)} onClick={toggle}>
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}
