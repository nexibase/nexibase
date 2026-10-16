'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NotificationNavigation } from './NotificationNavigation'

type AligoSettings = { aligoUserId: string; sender: string }
type AligoSecrets = { aligoKey?: string; senderKey?: string }
type Configuration = { settings: AligoSettings; configuredSecrets: Record<keyof AligoSecrets, boolean>; encryptionReady: boolean }

export function AligoSettingsAdmin() {
  const [data, setData] = useState<Configuration | null>(null)
  const [secrets, setSecrets] = useState<AligoSecrets>({})
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/notifications/settings/aligo', { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '알리고 설정을 불러오지 못했습니다.')
    setData(result); setSecrets({}); setDirty(false)
  }, [])
  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : '설정 조회 실패')) }, [load])
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data || busy || !dirty) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/admin/notifications/settings/aligo', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: data.settings, secrets }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '알리고 설정을 저장하지 못했습니다.')
      await load()
      setMessage('알리고 설정을 저장했습니다.')
    } catch (error) { setMessage(error instanceof Error ? error.message : '설정 저장 실패') }
    finally { setBusy(false) }
  }
  function textField(key: keyof AligoSettings, label: string) {
    return <div className="space-y-2"><Label htmlFor={`notification-${key}`}>{label}</Label><Input id={`notification-${key}`} value={data!.settings[key]} autoComplete="off" disabled={busy}
      onChange={event => { setData(previous => previous ? { ...previous, settings: { ...previous.settings, [key]: event.target.value } } : previous); setDirty(true) }} /></div>
  }
  function secretField(key: keyof AligoSecrets, label: string) {
    return <div className="space-y-2"><Label htmlFor={`notification-${key}`}>{label}</Label><Input id={`notification-${key}`} type="password" value={secrets[key] || ''} autoComplete="new-password" disabled={busy}
      placeholder={data!.configuredSecrets[key] ? '설정됨 · 변경할 때만 입력' : '미설정'}
      onChange={event => { setSecrets(previous => ({ ...previous, [key]: event.target.value })); setDirty(true) }} /></div>
  }
  return <div className="w-full p-6 space-y-5">
    <NotificationNavigation page="aligo" />
    <p className="text-sm text-muted-foreground">문자와 알림톡 발송에 사용할 알리고 연결 정보를 설정합니다. 채널 사용 여부와 이벤트별 발송 설정은 알림 설정에서 관리합니다.</p>
    {message && <div role="status" className="border rounded-md p-3 text-sm whitespace-pre-wrap break-words">{message}</div>}
    {!data ? <p>설정을 불러오는 중입니다.</p> : <form onSubmit={save} className="space-y-5">
      {!data.encryptionReady && <p className="text-destructive">서버 알림 암호화 키 설정이 필요합니다. 외부 발송 정보를 저장할 수 없습니다.</p>}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border rounded-lg bg-background/95 p-3 shadow-sm" aria-label="알리고 설정 저장 영역">
        <span className="text-sm text-muted-foreground">{dirty ? '저장하지 않은 변경사항이 있습니다.' : '저장된 설정입니다.'}</span>
        <Button type="submit" disabled={busy || !dirty || !data.encryptionReady}><Save className="h-4 w-4 mr-2" />{busy ? '저장 중…' : '설정 저장'}</Button>
      </div>
      <section className="border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold text-lg">알리고 연결 정보</h2>
        <div className="grid sm:grid-cols-2 gap-4">{textField('aligoUserId', '알리고 아이디')}{secretField('aligoKey', '알리고 API 키')}{textField('sender', '등록된 발신번호')}{secretField('senderKey', '카카오 발신프로필 키')}</div>
        <p className="text-xs text-muted-foreground">알리고의 발신번호 등록, API 서버 IP 허용, 카카오채널 연동 및 템플릿 승인이 필요합니다. 비밀값은 빈칸으로 저장하면 기존 값을 유지합니다.</p>
      </section>
    </form>}
  </div>
}
