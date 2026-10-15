'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Bell, Mail, MessageSquare, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { NotificationSettings, Secrets } from '@/lib/notifications/config'

const channels = { email: '메일', alimtalk: '알림톡', sms: '문자' } as const
const smtpProviders = {
  gmail: { label: 'GMAIL', host: 'smtp.gmail.com', port: 587, secure: false },
  naver: { label: '네이버', host: 'smtp.naver.com', port: 465, secure: true },
  kakao: { label: '카카오', host: 'smtp.kakao.com', port: 465, secure: true },
  daum: { label: '다음', host: 'smtp.daum.net', port: 465, secure: true },
} as const
type SmtpProvider = keyof typeof smtpProviders | 'custom'
const smtpProviderForHost = (host: string): SmtpProvider => (Object.entries(smtpProviders).find(([, provider]) => provider.host === host.trim().toLowerCase())?.[0] as keyof typeof smtpProviders | undefined) || 'custom'
const smtpPorts = [465, 587, 25] as const
const smtpPortDescriptions = {
  465: 'SSL/TLS · 연결부터 암호화',
  587: 'STARTTLS · 일반 메일 발송',
  25: 'SMTP · 서버 간 메일 전달',
} as const
type SmtpPortSelection = `${typeof smtpPorts[number]}` | 'custom'
const smtpPortSelectionFor = (port: number): SmtpPortSelection => smtpPorts.some(value => value === port) ? String(port) as SmtpPortSelection : 'custom'
const statuses: Record<string, string> = { pending: '발송 대기', waiting: '알림톡 실패 시 발송', processing: '요청 중', accepted: '접수 완료 · 결과 대기', delivered: '전달 완료', failed: '실패', unknown: '결과 확인 필요', skipped: '발송 안 함', tested: '테스트 처리' }
type Rule = { eventType: string; label: string; owner: string; emailEnabled: boolean; smsEnabled: boolean; alimtalkEnabled: boolean; smsTemplate: string; alimtalkCode: string; alimtalkTemplate: string; alimtalkButtons: unknown; variableMapping: unknown; buttonsText: string; mappingText: string }
type Configuration = { settings: NotificationSettings; configuredSecrets: Record<keyof Secrets, boolean>; environment: string; encryptionReady: boolean; missing: Record<keyof typeof channels, string[]>; rules: Rule[] }
const fieldClass = 'rounded-md border bg-background px-3 py-2 text-sm'

function Navigation({ settings }: { settings?: boolean }) {
  const t = useTranslations('notifications')
  return <div className="flex flex-wrap items-center justify-between gap-3 mb-6"><h1 className="text-2xl font-bold flex gap-2 items-center"><Bell className="h-6 w-6" />{settings ? t('settings') : t('history')}</h1>
    <nav className="flex gap-2"><Button asChild variant={settings ? 'default' : 'outline'}><Link href="/admin/notifications/settings">{t('settings')}</Link></Button><Button asChild variant={settings ? 'outline' : 'default'}><Link href="/admin/notifications">{t('history')}</Link></Button></nav></div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border rounded-lg p-5 space-y-4"><h2 className="font-semibold text-lg">{title}</h2>{children}</section>
}
function SmtpTest({ data, dirty, busy }: { data: Configuration; dirty: boolean; busy: boolean }) {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [eventId, setEventId] = useState('')
  const [result, setResult] = useState('')
  const [waiting, setWaiting] = useState(false)
  const unavailable = dirty ? '변경한 설정을 먼저 저장하세요.' : !data.settings.liveEnabled ? '상단의 실제 외부 발송 허용을 켜고 저장하세요.'
    : data.missing.email.length ? `SMTP 설정 필요: ${data.missing.email.join(', ')}` : !data.encryptionReady ? '서버 알림 암호화 키 설정이 필요합니다.' : ''
  useEffect(() => {
    if (!eventId) return
    const controller = new AbortController()
    const startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      let pending = true
      try {
        const response = await fetch(`/api/admin/notifications/test?eventId=${encodeURIComponent(eventId)}`, { cache: 'no-store', signal: controller.signal })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || '발송 결과를 조회하지 못했습니다.')
        const delivery = body.delivery
        setResult(`${delivery.status === 'accepted' ? 'SMTP 서버 접수 완료' : statuses[delivery.status] || delivery.status} · ${delivery.recipientMasked}${delivery.reason ? `\n${delivery.reason}` : ''}`)
        pending = ['pending', 'processing'].includes(delivery.status)
      } catch (error) {
        if (controller.signal.aborted) return
        setResult(error instanceof Error ? error.message : '발송 결과 조회 실패')
      }
      if (controller.signal.aborted) return
      if (pending && Date.now() - startedAt < 120000) timer = setTimeout(poll, 3000)
      else {
        setWaiting(false)
        if (pending) setResult(previous => `${previous}\n처리가 계속되고 있습니다. 발송 내역에서 결과를 확인하세요.`)
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [eventId])
  async function send() {
    setSending(true); setResult(''); setEventId('')
    try {
      const response = await fetch('/api/admin/notifications/test', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'email', mode: 'live', recipientEmail: recipientEmail.trim() }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '테스트 메일 요청 실패')
      if (!body.eventId) throw new Error('테스트 발송 내역을 만들지 못했습니다.')
      setResult('테스트 메일을 발송 대기열에 등록했습니다. 결과를 확인하고 있습니다.'); setWaiting(true); setEventId(body.eventId)
    } catch (error) { setResult(error instanceof Error ? error.message : '테스트 메일 요청 실패') }
    finally { setSending(false) }
  }
  return <div className="border-t pt-4 space-y-3">
    <h3 className="font-medium">테스트 메일 발송</h3>
    <p className="text-xs text-muted-foreground">저장한 SMTP 설정으로 실제 테스트 메일을 보냅니다. 비워두면 내 계정의 이메일로 보냅니다. dev에서는 수신 이메일을 상단의 실발송 테스트 수신자에 등록하고 저장하세요.</p>
    <form className="flex flex-wrap gap-3 items-end" onSubmit={e => { e.preventDefault(); if (!unavailable && !busy && !sending && !waiting) void send() }}>
      <div className="space-y-2 flex-1 min-w-0 sm:min-w-64"><Label htmlFor="smtp-test-recipient">수신 회원 이메일</Label><Input id="smtp-test-recipient" type="email" maxLength={254} value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="비워두면 내 이메일" autoComplete="off" disabled={sending || waiting} /></div>
      <Button type="submit" disabled={!!unavailable || busy || sending || waiting}><Mail className="h-4 w-4 mr-2" />{sending ? '요청 중…' : waiting ? '발송 결과 확인 중…' : '테스트 메일 보내기'}</Button>
    </form>
    {unavailable && <p className="text-sm text-muted-foreground">{unavailable}</p>}
    {result && <div role="status" className="border rounded-md p-3 text-sm whitespace-pre-wrap">{result}</div>}
    <p className="text-xs text-muted-foreground">SMTP 서버 접수 후 수신함·스팸함에서 도착 여부를 확인하세요. <Link href="/admin/notifications" className="text-primary underline">발송 내역 보기</Link></p>
  </div>
}
export function NotificationSettingsAdmin() {
  const [data, setData] = useState<Configuration | null>(null)
  const [secrets, setSecrets] = useState<Secrets>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [allowlist, setAllowlist] = useState('')
  const [smtpProvider, setSmtpProvider] = useState<SmtpProvider>('custom')
  const [smtpPortSelection, setSmtpPortSelection] = useState<SmtpPortSelection>('custom')
  const [test, setTest] = useState({ channel: 'email', userId: '', mode: 'test', eventType: 'post_comment' })
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/notifications/settings', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '설정을 불러오지 못했습니다.')
      result.rules = result.rules.map((r: Rule) => ({ ...r, buttonsText: r.alimtalkButtons ? JSON.stringify(r.alimtalkButtons, null, 2) : '', mappingText: r.variableMapping ? JSON.stringify(r.variableMapping, null, 2) : '' }))
      setData(result); setAllowlist(result.settings.testRecipients.join('\n')); setSecrets({}); setDirty(false)
      setSmtpProvider(smtpProviderForHost(result.settings.smtpHost))
      setSmtpPortSelection(smtpPortSelectionFor(result.settings.smtpPort))
    } catch (error) { setMessage(error instanceof Error ? error.message : '설정 조회 실패') }
  }, [])
  useEffect(() => { void load() }, [load])
  const setting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    setData(previous => previous ? { ...previous, settings: { ...previous.settings, [key]: value } } : previous); setDirty(true)
  }
  const rule = (eventType: string, patch: Partial<Rule>) => {
    setData(previous => previous ? { ...previous, rules: previous.rules.map(r => r.eventType === eventType ? { ...r, ...patch } : r) } : previous); setDirty(true)
  }
  function selectSmtpProvider(provider: SmtpProvider) {
    setSmtpProvider(provider)
    if (provider === 'custom') return
    const preset = smtpProviders[provider]
    setSmtpPortSelection(smtpPortSelectionFor(preset.port))
    setData(previous => previous ? { ...previous, settings: { ...previous.settings, smtpHost: preset.host, smtpPort: preset.port, smtpSecure: preset.secure } } : previous)
    setDirty(true)
  }
  function selectSmtpPort(selection: SmtpPortSelection) {
    setSmtpPortSelection(selection)
    if (selection === 'custom') return
    const port = Number(selection)
    setData(previous => previous ? { ...previous, settings: { ...previous.settings, smtpPort: port, smtpSecure: port === 465 } } : previous)
    setDirty(true)
  }
  async function save() {
    if (!data) return
    setBusy(true); setMessage('')
    try {
      const rules = data.rules.map(r => ({ ...r, alimtalkButtons: r.buttonsText.trim() ? JSON.parse(r.buttonsText) : null, variableMapping: r.mappingText.trim() ? JSON.parse(r.mappingText) : {} }))
      const response = await fetch('/api/admin/notifications/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: data.settings, secrets, rules }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '설정 저장 실패')
      await load(); setMessage('알림 설정을 저장했습니다.')
    } catch (error) { setMessage(error instanceof SyntaxError ? '버튼 정보와 변수 매핑의 JSON 형식을 확인하세요.' : error instanceof Error ? error.message : '설정 저장 실패') }
    finally { setBusy(false) }
  }
  async function checkTemplate(r: Rule) {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/notifications/templates?code=${encodeURIComponent(r.alimtalkCode)}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      const template = result.templates.find((t: { code: string }) => t.code === r.alimtalkCode)
      if (!template) throw new Error('등록된 템플릿을 찾을 수 없습니다.')
      setMessage(`템플릿 ${template.name}: ${template.approval === 'APR' ? '승인됨' : template.approval} / ${template.status === 'A' ? '사용 가능' : template.status}`)
      if (template.approval === 'APR' && template.status === 'A') rule(r.eventType, { alimtalkTemplate: template.content })
    } catch (error) { setMessage(error instanceof Error ? error.message : '템플릿 조회 실패') } finally { setBusy(false) }
  }
  async function sendTest() {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/admin/notifications/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...test, userId: test.userId ? Number(test.userId) : undefined }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setMessage(`테스트를 등록했습니다. 발송 내역에서 결과를 확인하세요. (${result.eventId})`)
    } catch (error) { setMessage(error instanceof Error ? error.message : '테스트 요청 실패') } finally { setBusy(false) }
  }
  function textField(key: 'smtpHost' | 'smtpUser' | 'smtpFrom' | 'aligoUserId' | 'sender', label: string) {
    return <div className="space-y-2"><Label htmlFor={`notification-${key}`}>{label}</Label><Input id={`notification-${key}`} value={data!.settings[key]} onChange={e => setting(key, e.target.value)} autoComplete="off" /></div>
  }
  function secretField(key: keyof Secrets, label: string) {
    return <div className="space-y-2"><Label htmlFor={`notification-${key}`}>{label}</Label><Input id={`notification-${key}`} type="password" value={secrets[key] || ''} autoComplete="new-password" placeholder={data!.configuredSecrets[key] ? '설정됨 · 변경할 때만 입력' : '미설정'} onChange={e => { setSecrets(s => ({ ...s, [key]: e.target.value })); setDirty(true) }} /></div>
  }
  return <div className="w-full p-6 space-y-5"><Navigation settings />
    <p className="text-sm text-muted-foreground">사이트 내 알림은 항상 기록합니다. 알림톡과 문자를 함께 켜면 알림톡 최종 실패 시에만 문자를 보냅니다. 외부 발송은 회원의 수신 설정을 따릅니다.</p>
    {message && <div role="status" className="border rounded-md p-3 text-sm whitespace-pre-wrap break-all">{message}</div>}
    {!data ? <p>설정을 불러오는 중입니다.</p> : <>
      {!data.encryptionReady && <p className="text-destructive">서버 알림 암호화 키 설정이 필요합니다. 외부 발송 정보를 저장할 수 없습니다.</p>}
      <Section title="발송 채널"><div className="grid gap-4 md:grid-cols-3">{Object.entries(channels).map(([channel, label]) => <div key={channel} className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-2"><Label htmlFor={`channel-${channel}`}>{label} 보내기</Label><Switch id={`channel-${channel}`} checked={data.settings[`${channel as keyof typeof channels}Enabled`]} onCheckedChange={v => setting(`${channel as keyof typeof channels}Enabled`, v)} /></div>
        <p className="text-xs text-muted-foreground">{data.missing[channel as keyof typeof channels].length ? `설정 필요: ${data.missing[channel as keyof typeof channels].join(', ')}` : '연결 정보 설정됨 · 실제 연결은 테스트로 확인하세요.'}</p>
      </div>)}</div></Section>
      <Section title="발송 모드"><div className="flex items-center gap-3"><Switch id="notification-live" checked={data.settings.liveEnabled} onCheckedChange={v => setting('liveEnabled', v)} /><Label htmlFor="notification-live">실제 외부 발송 허용</Label></div>
        <p className="text-sm text-muted-foreground">끄면 메일은 모의 처리하고, 문자·알림톡은 알리고 테스트 모드를 사용합니다. {data.environment === 'development' && 'dev에서는 켜더라도 아래 허용 목록의 수신자에게만 실제로 발송합니다.'}</p>
        <div className="space-y-2"><Label htmlFor="notification-allowlist">dev 실발송 테스트 수신자</Label><Textarea id="notification-allowlist" value={allowlist} placeholder="이메일 또는 전화번호를 한 줄에 하나씩 입력" onChange={e => { setAllowlist(e.target.value); setting('testRecipients', e.target.value.split(/[\n,]/).map(v => v.trim()).filter(Boolean)) }} /></div>
      </Section>
      <div className="grid gap-5"><Section title="메일 · SMTP"><div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2"><Label htmlFor="notification-smtp-provider">SMTP 호스트</Label><select id="notification-smtp-provider" className={`${fieldClass} w-full h-10`} value={smtpProvider} onChange={e => selectSmtpProvider(e.target.value as SmtpProvider)}>{Object.entries(smtpProviders).map(([key, provider]) => <option key={key} value={key}>{provider.label}</option>)}<option value="custom">직접 입력</option></select>
          <Label htmlFor="notification-smtpHost" className="sr-only">SMTP 서버 주소</Label><Input id="notification-smtpHost" value={data.settings.smtpHost} onChange={e => { setting('smtpHost', e.target.value); setSmtpProvider('custom') }} placeholder="smtp.example.com" autoComplete="off" />
        </div>
        <div className="space-y-2"><Label htmlFor="notification-port-selection">SMTP 포트</Label><select id="notification-port-selection" className={`${fieldClass} w-full h-10`} value={smtpPortSelection} onChange={e => selectSmtpPort(e.target.value as SmtpPortSelection)}>{smtpPorts.map(port => <option key={port} value={String(port)}>{port} — {smtpPortDescriptions[port]}</option>)}<option value="custom">직접 입력</option></select>
          {smtpPortSelection === 'custom' && <><Label htmlFor="notification-port" className="sr-only">SMTP 포트 직접 입력</Label><Input id="notification-port" type="number" min={1} max={65535} value={data.settings.smtpPort} onChange={e => setting('smtpPort', Number(e.target.value))} /></>}
        </div>
        {textField('smtpUser', 'SMTP 계정')}{secretField('smtpPass', 'SMTP 비밀번호')}{textField('smtpFrom', '발신 이메일')}
        <div className="flex gap-3 items-center"><Switch id="notification-tls" checked={data.settings.smtpSecure} onCheckedChange={v => setting('smtpSecure', v)} /><Label htmlFor="notification-tls">연결 시 TLS 사용 · 보통 465 포트</Label></div>
      </div><p className="text-xs text-muted-foreground">인증 메일은 일반 알림의 메일 켜기·끄기와 별개로 동작하며, 발송 모드와 dev 허용 목록은 동일하게 적용합니다.</p><SmtpTest data={data} dirty={dirty} busy={busy} /></Section>
        <Section title="문자·알림톡 · 알리고"><div className="grid sm:grid-cols-2 gap-4">{textField('aligoUserId', '알리고 아이디')}{secretField('aligoKey', '알리고 API 키')}{textField('sender', '등록된 발신번호')}{secretField('senderKey', '카카오 발신프로필 키')}</div><p className="text-xs text-muted-foreground">알리고의 발신번호 등록, API 서버 IP 허용, 카카오채널 연동 및 템플릿 승인이 필요합니다. 비밀값은 빈칸으로 저장하면 기존 값을 유지합니다.</p></Section></div>
      <Section title="이벤트별 발송 설정"><p className="text-sm text-muted-foreground">사이트 내 알림은 필수입니다. 상단 발송 채널에서 켠 채널만 아래에서 변경할 수 있습니다. 채널을 꺼도 이벤트별 설정값은 유지됩니다.</p>
        {data.rules.filter(r => r.eventType !== 'notification_test').map(r => <div key={r.eventType} className="border rounded-lg p-4 space-y-3"><div className="flex flex-wrap gap-4 items-center justify-between"><div><h3 className="font-medium">{r.label}</h3><p className="text-xs text-muted-foreground">{r.eventType}</p></div><div className="flex flex-wrap gap-5">{Object.entries(channels).map(([channel,label]) => <label key={channel} className={`flex gap-2 items-center text-sm ${!data.settings[`${channel as keyof typeof channels}Enabled`] ? 'text-muted-foreground' : ''}`} title={!data.settings[`${channel as keyof typeof channels}Enabled`] ? `상단에서 ${label} 보내기를 켜세요.` : undefined}><Switch aria-label={`${r.label} ${label} 보내기`} disabled={!data.settings[`${channel as keyof typeof channels}Enabled`]} checked={r[`${channel as keyof typeof channels}Enabled`]} onCheckedChange={v => rule(r.eventType, { [`${channel}Enabled`]: v })} />{label} 보내기</label>)}</div></div>
          <details><summary className="text-sm cursor-pointer text-primary">문자·알림톡 템플릿</summary><div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">기본 변수: {'#{title}, #{message}, #{link}, #{name}, #{eventType}'}. 주문 이벤트: {'#{orderNo}, #{status}, #{totalAmount}, #{trackingNumber}, #{customerName}'}. 승인된 알림톡 본문의 줄바꿈을 유지하세요.</p>
            <div className="grid lg:grid-cols-2 gap-4"><label className="space-y-2 text-sm">문자 본문<Textarea value={r.smsTemplate} onChange={e => rule(r.eventType, { smsTemplate: e.target.value })} rows={4} /></label>
              <div className="space-y-2"><Label htmlFor={`tpl-${r.eventType}`}>알림톡 템플릿 코드</Label><div className="flex gap-2"><Input id={`tpl-${r.eventType}`} value={r.alimtalkCode} onChange={e => rule(r.eventType, { alimtalkCode: e.target.value })} /><Button type="button" variant="outline" disabled={busy || !r.alimtalkCode} onClick={() => checkTemplate(r)}>승인 조회</Button></div><p className="text-xs text-muted-foreground">승인 조회는 저장된 알리고 계정으로 확인하고, 승인된 본문을 가져옵니다.</p></div></div>
            <label className="block space-y-2 text-sm">알림톡 본문<Textarea value={r.alimtalkTemplate} onChange={e => rule(r.eventType, { alimtalkTemplate: e.target.value })} rows={4} /></label>
            <div className="grid lg:grid-cols-2 gap-4"><label className="space-y-2 text-sm">알림톡 버튼 정보 · JSON<Textarea value={r.buttonsText} onChange={e => rule(r.eventType, { buttonsText: e.target.value })} placeholder={'{"button": []}'} rows={3} /></label><label className="space-y-2 text-sm">변수 매핑 · JSON<Textarea value={r.mappingText} onChange={e => rule(r.eventType, { mappingText: e.target.value })} placeholder={'{"고객명": "name", "주문번호": "orderNo"}'} rows={3} /></label></div>
          </div></details></div>)}
      </Section>
      <div className="flex items-center gap-3"><Button onClick={save} disabled={busy || !dirty}><Save className="h-4 w-4 mr-2" />설정 저장</Button>{dirty && <span className="text-sm text-muted-foreground">저장하지 않은 변경사항이 있습니다.</span>}</div>
      <Section title="테스트 발송"><p className="text-sm text-muted-foreground">선택한 회원의 등록된 연락처를 사용합니다. 테스트는 해당 회원의 수신 설정과 채널 켜기 여부에 관계없이 요청하며, 사이트 내 테스트 알림도 기록합니다.</p>
        <div className="flex flex-wrap gap-3 items-end"><label className="text-sm space-y-2">테스트 회원 ID<Input type="number" min={1} placeholder="비워두면 내 계정" value={test.userId} onChange={e => setTest(v => ({ ...v, userId: e.target.value }))} /></label>
          <label className="text-sm grid gap-2">채널<select className={fieldClass} value={test.channel} onChange={e => setTest(v => ({ ...v, channel: e.target.value }))}>{Object.entries(channels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="text-sm grid gap-2">템플릿 이벤트<select className={fieldClass} value={test.eventType} onChange={e => setTest(v => ({ ...v, eventType: e.target.value }))}>{data.rules.filter(r => r.eventType !== 'notification_test').map(r => <option key={r.eventType} value={r.eventType}>{r.label}</option>)}</select></label>
          <label className="text-sm grid gap-2">발송 방식<select className={fieldClass} value={test.mode} onChange={e => setTest(v => ({ ...v, mode: e.target.value }))}><option value="test">테스트 모드 · 실제 발송 없음</option><option value="live">실제 발송 · 과금 발생</option></select></label>
          <Button onClick={sendTest} disabled={busy || dirty}>테스트 요청</Button>
        </div><p className="text-xs text-muted-foreground">테스트 모드 접수는 실제 수신 성공을 의미하지 않습니다. 템플릿·인증 정보 변경은 먼저 저장하세요.</p>
      </Section>
    </>}
  </div>
}

type Delivery = { id: string; eventId: string; channel: keyof typeof channels; status: string; recipientMasked: string; providerId: string | null; providerCode: string | null; reason: string | null; attempts: number; nextAttemptAt: string; acceptedAt: string | null; completedAt: string | null; lastCheckedAt: string | null; createdAt: string; event: { type: string; user: { id: number; nickname: string } } }
const deliveryLabel = (delivery: Delivery) => delivery.channel === 'email' && delivery.status === 'accepted' ? 'SMTP 접수 완료' : statuses[delivery.status] || delivery.status
export function NotificationHistoryAdmin() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [total, setTotal] = useState(0), [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ search: '', channel: '', status: '', start: '', end: '' })
  const [query, setQuery] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Delivery | null>(null)
  const [events, setEvents] = useState<Record<string,string>>({})
  const load = useCallback(async () => {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/notifications?page=${page}&${query}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '발송 내역 조회 실패')
      setDeliveries(result.deliveries); setTotal(result.total); setEvents(result.events || {}); setMessage('')
      setSelected(previous => previous ? result.deliveries.find((d: Delivery) => d.id === previous.id) || previous : null)
    } catch (error) { setMessage(error instanceof Error ? error.message : '발송 내역 조회 실패') } finally { setBusy(false) }
  }, [page, query])
  useEffect(() => { void load(); const timer = setInterval(load, 15000); return () => clearInterval(timer) }, [load])
  const date = (value: string | null) => value ? new Date(value).toLocaleString('ko-KR') : '—'
  return <div className="w-full p-6 space-y-5"><Navigation />
    <p className="text-sm text-muted-foreground">외부 채널의 접수와 최종 전달 결과를 구분해서 표시합니다. 메일은 SMTP 서버 접수까지 확인합니다. 발송 내역은 자동 삭제하지 않습니다.</p>
    <form className="flex flex-wrap gap-3 items-end" onSubmit={e => { e.preventDefault(); setPage(1); const next = new URLSearchParams(filters).toString(); if (next === query && page === 1) void load(); else setQuery(next) }}>
      <label className="text-sm grid gap-2">회원·연락처·이벤트<Input placeholder="회원 닉네임 또는 표시된 연락처" value={filters.search} onChange={e => setFilters(v => ({ ...v, search: e.target.value }))} /></label>
      <label className="text-sm grid gap-2">채널<select className={fieldClass} value={filters.channel} onChange={e => setFilters(v => ({ ...v, channel: e.target.value }))}><option value="">전체</option>{Object.entries(channels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="text-sm grid gap-2">상태<select className={fieldClass} value={filters.status} onChange={e => setFilters(v => ({ ...v, status: e.target.value }))}><option value="">전체</option>{Object.entries(statuses).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="text-sm grid gap-2">시작일<Input type="date" value={filters.start} onChange={e => setFilters(v => ({ ...v, start: e.target.value }))} /></label><label className="text-sm grid gap-2">종료일<Input type="date" value={filters.end} onChange={e => setFilters(v => ({ ...v, end: e.target.value }))} /></label>
      <Button disabled={busy}>조회</Button><Button type="button" variant="outline" onClick={load} disabled={busy}><RefreshCw className="h-4 w-4 mr-2" />새로고침</Button>
    </form>
    {message && <p role="alert" className="text-destructive">{message}</p>}
    <div className="border rounded-lg overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-muted"><tr>{['요청 시각', '이벤트', '회원', '채널', '수신자', '상태 · 상세', '처리 사유'].map(h => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{deliveries.map(d => <tr key={d.id} className="border-t"><td className="p-3 whitespace-nowrap">{date(d.createdAt)}</td><td className="p-3">{events[d.event.type] || d.event.type}</td><td className="p-3"><Link className="text-primary hover:underline" href={`/admin/users/${d.event.user.id}`}>{d.event.user.nickname}</Link></td><td className="p-3">{d.channel === 'email' ? <Mail className="inline h-4 w-4 mr-1" /> : <MessageSquare className="inline h-4 w-4 mr-1" />}{channels[d.channel]}</td><td className="p-3 whitespace-nowrap">{d.recipientMasked}</td><td className="p-3"><button className="text-primary underline underline-offset-4 whitespace-nowrap" onClick={() => setSelected(d)}>{deliveryLabel(d)}</button></td><td className="p-3 min-w-48 max-w-sm break-words">{d.reason || '—'}</td></tr>)}{!deliveries.length && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">{busy ? '불러오는 중입니다.' : '발송 내역이 없습니다.'}</td></tr>}</tbody></table></div>
    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">총 {total.toLocaleString()}건 · {page} / {Math.max(1, Math.ceil(total / 30))} 페이지</span><div className="flex gap-2"><Button variant="outline" disabled={busy || page <= 1} onClick={() => setPage(p => p - 1)}>이전</Button><Button variant="outline" disabled={busy || page * 30 >= total} onClick={() => setPage(p => p + 1)}>다음</Button></div></div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>발송 상세 내역</DialogTitle></DialogHeader>{selected && <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm break-all">{Object.entries({ '이벤트': events[selected.event.type] || selected.event.type, '회원': `${selected.event.user.nickname} (#${selected.event.user.id})`, '수신자': selected.recipientMasked, '채널': channels[selected.channel], '상태': deliveryLabel(selected), '시도 횟수': selected.attempts, '요청 시각': date(selected.createdAt), '접수 시각': date(selected.acceptedAt), '완료 시각': date(selected.completedAt), '마지막 결과 조회': date(selected.lastCheckedAt), '알리고·SMTP 메시지 ID': selected.providerId || '—', '결과 코드': selected.providerCode || '—', '처리 사유': selected.reason || '—', '이벤트 ID': selected.eventId }).map(([k,v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}</dl>}</DialogContent></Dialog>
  </div>
}
