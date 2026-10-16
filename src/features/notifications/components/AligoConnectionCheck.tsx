'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AligoConnectionCheck as Check } from '@/lib/notifications/aligo-connection'

export function AligoConnectionCheck({ dirty, busy, onSave }: { dirty: boolean; busy: boolean; onSave: () => Promise<boolean> }) {
  const [checking, setChecking] = useState(false)
  const [checks, setChecks] = useState<Check[]>([])
  const [error, setError] = useState('')
  async function check() {
    setChecking(true); setChecks([]); setError('')
    try {
      if (dirty && !await onSave()) throw new Error('설정 저장에 실패하여 연결을 확인하지 않았습니다. 상단의 오류를 확인하세요.')
      const response = await fetch('/api/admin/notifications/aligo/check', { method: 'POST', cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '알리고 연결 확인 실패')
      setChecks(result.checks)
    } catch (error) { setError(error instanceof Error ? error.message : '알리고 연결 확인 실패') }
    finally { setChecking(false) }
  }
  return <div className="border-t pt-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">문자 API 인증과 카카오 발신프로필·채널 상태를 조회합니다. 문자와 알림톡을 발송하지 않습니다.</p>
      <Button type="button" variant="outline" disabled={busy || checking} onClick={check}><RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />{checking ? '알리고 연결 확인 중…' : dirty ? '저장 후 알리고 연결 확인' : '알리고 연결 확인'}</Button>
    </div>
    {(checks.length > 0 || error) && <div role="status" className="border rounded-md p-3 text-sm space-y-2" aria-label="알리고 연결 확인 결과">
      {error && <p className="text-destructive">{error}</p>}
      {checks.map(item => <p key={item.id} className={item.status === 'error' ? 'text-destructive' : item.status === 'warning' ? 'text-amber-700 dark:text-amber-400' : ''}><span className="font-medium">{item.status === 'ok' ? '성공' : item.status === 'warning' ? '확인 필요' : '실패'} · {item.id === 'sms' ? '문자' : '알림톡'}</span><br />{item.message}</p>)}
      {checks.length > 0 && <p className="text-xs text-muted-foreground">발신번호 등록 여부, 승인된 템플릿과 실제 수신은 테스트 발송으로 확인하세요.</p>}
    </div>}
  </div>
}
