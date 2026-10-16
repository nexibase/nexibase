'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { aligoTemplateLabel, usableAligoTemplate, type AligoTemplate } from '@/lib/notifications/template-options'
import { NotificationNavigation } from './NotificationNavigation'
import { mobileDeliveryDescription } from './MobileDeliveryOptions'
import type { NotificationRuleEditor as Rule } from './notification-admin-types'

const channels = { email: '메일', alimtalk: '알림톡', sms: '문자' } as const
const fieldClass = 'rounded-md border bg-background px-3 py-2 text-sm'
type Configuration = { channels: Record<keyof typeof channels, boolean>; rules: Rule[]; canLoadTemplates: boolean }
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border rounded-lg p-5 space-y-4"><h2 className="font-semibold text-lg">{title}</h2>{children}</section>
}
export function NotificationRulesAdmin() {
  const [data, setData] = useState<Configuration | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [test, setTest] = useState({ channel: 'email', userId: '', mode: 'test', eventType: 'post_comment' })
  const [templates, setTemplates] = useState<AligoTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState('')
  const templatesRequest = useRef<AbortController | null>(null)
  const loadTemplates = useCallback(async () => {
    templatesRequest.current?.abort()
    const controller = new AbortController()
    templatesRequest.current = controller
    setTemplatesLoading(true); setTemplatesError('')
    try {
      const response = await fetch('/api/admin/notifications/templates', { cache: 'no-store', signal: controller.signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '템플릿 목록을 불러오지 못했습니다.')
      setTemplates(result.templates)
    } catch (error) {
      if (!controller.signal.aborted) { setTemplates([]); setTemplatesError(error instanceof Error ? error.message : '템플릿 목록 조회 실패') }
    } finally { if (!controller.signal.aborted) setTemplatesLoading(false) }
  }, [])
  useEffect(() => () => templatesRequest.current?.abort(), [])

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/notifications/rules', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '이벤트 설정을 불러오지 못했습니다.')
      result.rules = result.rules.map((rule: Rule) => ({ ...rule,
        buttonsText: rule.alimtalkButtons ? JSON.stringify(rule.alimtalkButtons, null, 2) : '',
        mappingText: rule.variableMapping ? JSON.stringify(rule.variableMapping, null, 2) : '' }))
      setData(result); setDirty(false)
      if (result.canLoadTemplates) void loadTemplates()
      else {
        templatesRequest.current?.abort(); setTemplates([]); setTemplatesLoading(false)
        setTemplatesError('알림 설정에서 알리고 아이디와 기존 API Key·Senderkey를 저장하면 템플릿 목록을 불러올 수 있습니다.')
      }
      return true
    } catch (error) { setMessage(error instanceof Error ? error.message : '이벤트 설정 조회 실패'); return false }
  }, [loadTemplates])
  useEffect(() => { void load() }, [load])
  const rule = (eventType: string, patch: Partial<Rule>) => {
    setData(previous => previous ? { ...previous, rules: previous.rules.map(r => r.eventType === eventType ? { ...r, ...patch } : r) } : previous); setDirty(true)
  }
  function selectTemplate(eventType: string, code: string) {
    if (!code) { rule(eventType, { alimtalkCode: '', alimtalkTemplate: '', buttonsText: '', alimtalkEnabled: false }); return }
    const template = templates.find(item => item.code === code)
    if (!template || !usableAligoTemplate(template)) return
    rule(eventType, { alimtalkCode: template.code, alimtalkTemplate: template.content,
      buttonsText: template.buttons ? JSON.stringify(template.buttons, null, 2) : '' })
  }
  async function save() {
    if (!data || busy || !dirty) return
    setBusy(true); setMessage('')
    try {
      const rules = data.rules.map(rule => ({ ...rule,
        alimtalkButtons: rule.buttonsText.trim() ? JSON.parse(rule.buttonsText) : null,
        variableMapping: rule.mappingText.trim() ? JSON.parse(rule.mappingText) : {} }))
      const response = await fetch('/api/admin/notifications/rules', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '이벤트 설정 저장 실패')
      if (!await load()) throw new Error('이벤트 설정은 저장했지만 다시 불러오지 못했습니다. 새로고침 후 확인하세요.')
      setMessage('이벤트별 발송 설정을 저장했습니다.')
    } catch (error) { setMessage(error instanceof SyntaxError ? '버튼 정보와 변수 매핑의 JSON 형식을 확인하세요.' : error instanceof Error ? error.message : '이벤트 설정 저장 실패') }
    finally { setBusy(false) }
  }
  async function sendTest() {
    if (!data || busy || dirty) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/admin/notifications/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...test, userId: test.userId ? Number(test.userId) : undefined }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setMessage(`테스트를 등록했습니다. 발송 내역에서 결과를 확인하세요. (${result.eventId})`)
    } catch (error) { setMessage(error instanceof Error ? error.message : '테스트 요청 실패') } finally { setBusy(false) }
  }
  return <div className="w-full p-6 space-y-5">
    <NotificationNavigation page="events" />
    <p className="text-sm text-muted-foreground">이벤트별 메일·문자·알림톡 사용 여부와 메시지 템플릿을 설정하고 테스트 발송을 요청합니다. 채널 전체 사용 여부와 연결 정보는 알림 설정에서 관리합니다.</p>
    {data && <div className="sticky top-0 z-20 border rounded-lg bg-background/95 p-3 shadow-sm space-y-2" aria-label="이벤트 설정 저장 영역">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{dirty ? '저장하지 않은 변경사항이 있습니다.' : '저장된 설정입니다.'}</span>
        <Button onClick={save} disabled={busy || !dirty} aria-label="이벤트별 발송 설정 저장"><Save className="h-4 w-4 mr-2" />{busy ? '저장 중…' : '설정 저장'}</Button>
      </div>{message && <div role="status" className="text-sm whitespace-pre-wrap break-words">{message}</div>}
    </div>}
    {!data && message && <div role="status" className="text-sm text-destructive">{message}</div>}
    {!data ? <p>설정을 불러오는 중입니다.</p> : <>
      <Section title="이벤트별 발송 설정"><p className="text-sm text-muted-foreground">사이트 내 알림은 필수입니다. 알림 설정에서 켠 채널만 아래에서 변경할 수 있습니다. 채널을 꺼도 이벤트별 설정값은 유지됩니다.</p>
        <div className="rounded-md bg-muted p-3 space-y-2 text-sm">
          <p>문자만 보내려면 문자만 켜고, 알림톡만 보내려면 알림톡만 켜세요. 둘 다 켜면 알림톡을 먼저 보내고 최종 실패한 경우에만 알리고가 문자로 자동 대체 발송합니다. 알림톡이 성공하면 문자를 보내지 않습니다.</p>
          <p className="text-xs text-muted-foreground">알림 설정과 이 페이지에서 모두 켠 채널만 자동 발송에 사용합니다. 회원의 수신 동의·연락처와 발송 모드도 적용됩니다. 알림톡에는 승인된 템플릿, 대체 문자에는 문자 본문이 필요하며, 알리고 접수 전에 설정·템플릿 문제로 알림톡 발송이 생략되면 대체 문자도 보내지 않습니다.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">저장된 알리고 계정의 승인된 템플릿을 이름으로 선택합니다.</p><Button type="button" variant="outline" disabled={busy || templatesLoading} onClick={() => void loadTemplates()}><RefreshCw className={`h-4 w-4 mr-2 ${templatesLoading ? 'animate-spin' : ''}`} />{templatesLoading ? '템플릿 불러오는 중…' : '템플릿 목록 새로고침'}</Button></div>
        {templatesError && <p role="status" className="text-sm text-destructive">{templatesError}</p>}
        {data.rules.filter(r => r.eventType !== 'notification_test').map(r => <div key={r.eventType} className="border rounded-lg p-4 space-y-3"><div className="flex flex-wrap gap-4 items-center justify-between"><div><h3 className="font-medium">{r.label}</h3><p className="text-xs text-muted-foreground">{r.eventType}</p></div><div className="flex flex-wrap gap-5">{Object.entries(channels).map(([channel,label]) => <label key={channel} className={`flex gap-2 items-center text-sm ${!data.channels[channel as keyof typeof channels] ? 'text-muted-foreground' : ''}`} title={!data.channels[channel as keyof typeof channels] ? `알림 설정에서 ${label} 보내기를 켜세요.` : undefined}><Switch aria-label={`${r.label} ${label} 보내기`} disabled={!data.channels[channel as keyof typeof channels]} checked={r[`${channel as keyof typeof channels}Enabled`]} onCheckedChange={v => rule(r.eventType, { [`${channel}Enabled`]: v })} />{label} 보내기</label>)}</div></div>
          <p className="text-sm text-muted-foreground" aria-label={`${r.label} 문자·알림톡 발송 방식`}>문자·알림톡: {mobileDeliveryDescription(data.channels.sms && r.smsEnabled, data.channels.alimtalk && r.alimtalkEnabled)}</p>
          <details><summary className="text-sm cursor-pointer text-primary">문자·알림톡 템플릿</summary><div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">기본 변수: {'#{title}, #{message}, #{link}, #{name}, #{eventType}'}. 주문 이벤트: {'#{orderNo}, #{status}, #{totalAmount}, #{trackingNumber}, #{customerName}'}. 승인된 알림톡 본문의 줄바꿈을 유지하세요.</p>
            <div className="grid lg:grid-cols-2 gap-4"><label className="space-y-2 text-sm">문자 본문<Textarea value={r.smsTemplate} onChange={e => rule(r.eventType, { smsTemplate: e.target.value })} rows={4} /></label>
              <div className="space-y-2"><Label htmlFor={`tpl-${r.eventType}`}>알림톡 템플릿명</Label><select id={`tpl-${r.eventType}`} className={`${fieldClass} w-full h-10`} value={r.alimtalkCode} disabled={busy || templatesLoading || !templates.length} onChange={event => selectTemplate(r.eventType, event.target.value)}>
                <option value="">{templatesLoading ? '템플릿을 불러오는 중입니다.' : '템플릿을 선택하세요'}</option>
                {r.alimtalkCode && !templates.some(template => template.code === r.alimtalkCode) && <option value={r.alimtalkCode} disabled>현재 저장된 템플릿 ({r.alimtalkCode}) · 목록에서 확인 필요</option>}
                {templates.map(template => <option key={template.code} value={template.code} disabled={!usableAligoTemplate(template)}>{aligoTemplateLabel(template)}{templates.filter(item => item.name === template.name).length > 1 ? ` · ${template.code}` : ''}</option>)}
              </select><p className="text-xs text-muted-foreground">선택하면 승인된 본문과 버튼 정보를 자동으로 채웁니다. 승인된 템플릿은 대기 상태여도 선택할 수 있습니다. 미승인·반려된 템플릿은 선택할 수 없습니다.</p></div></div>
            <label className="block space-y-2 text-sm">알림톡 본문<Textarea value={r.alimtalkTemplate} onChange={e => rule(r.eventType, { alimtalkTemplate: e.target.value })} rows={4} /></label>
            <div className="grid lg:grid-cols-2 gap-4"><label className="space-y-2 text-sm">알림톡 버튼 정보 · JSON<Textarea value={r.buttonsText} onChange={e => rule(r.eventType, { buttonsText: e.target.value })} placeholder={'{"button": []}'} rows={3} /></label><label className="space-y-2 text-sm">변수 매핑 · JSON<Textarea value={r.mappingText} onChange={e => rule(r.eventType, { mappingText: e.target.value })} placeholder={'{"고객명": "name", "주문번호": "orderNo"}'} rows={3} /></label></div>
          </div></details></div>)}
      </Section>
      <Section title="테스트 발송"><p className="text-sm text-muted-foreground">선택한 회원의 등록된 연락처를 사용합니다. 테스트는 해당 회원의 수신 설정과 채널 켜기 여부에 관계없이 요청하며, 사이트 내 테스트 알림도 기록합니다.</p>
        <div className="flex flex-wrap gap-3 items-end"><label className="text-sm space-y-2">테스트 회원 ID<Input type="number" min={1} placeholder="비워두면 내 계정" value={test.userId} onChange={e => setTest(v => ({ ...v, userId: e.target.value }))} /></label>
          <label className="text-sm grid gap-2">채널<select className={fieldClass} value={test.channel} onChange={e => setTest(v => ({ ...v, channel: e.target.value }))}>{Object.entries(channels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="text-sm grid gap-2">템플릿 이벤트<select className={fieldClass} value={test.eventType} onChange={e => setTest(v => ({ ...v, eventType: e.target.value }))}>{data.rules.filter(r => r.eventType !== 'notification_test').map(r => <option key={r.eventType} value={r.eventType}>{r.label}</option>)}</select></label>
          <label className="text-sm grid gap-2">발송 방식<select className={fieldClass} value={test.mode} onChange={e => setTest(v => ({ ...v, mode: e.target.value }))}><option value="test">테스트 모드 · 실제 발송 없음</option><option value="live">실제 발송 · 과금 발생</option></select></label>
          <Button onClick={sendTest} disabled={busy || dirty}>테스트 요청</Button>
        </div><p className="text-xs text-muted-foreground">테스트 발송은 선택한 채널 1개만 확인합니다. 알림톡 실패 후 문자 전환은 자동 발송에 적용됩니다. 테스트 모드 접수는 실제 수신 성공을 의미하지 않습니다. 이벤트 설정을 변경했다면 상단에서 먼저 저장하세요. 발송 결과는 발송 내역에서 확인할 수 있습니다.</p>
      </Section>
    </>}
  </div>
}
