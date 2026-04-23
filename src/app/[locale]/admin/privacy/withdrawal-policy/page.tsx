'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/admin/Sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Job = {
  id: number
  userId: number
  anonNickname: string | null
  status: string
  attempts: number
  lastError: string | null
  reasonCode: string | null
  reasonText: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

type Data = {
  jobs: Job[]
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  done: 'default',
  failed: 'destructive',
  running: 'secondary',
  pending: 'outline',
}

const STATUS_LABEL: Record<string, string> = {
  done: '완료',
  failed: '실패',
  running: '진행 중',
  pending: '대기',
}

const REASON_LABEL: Record<string, string> = {
  rarely_used: '서비스를 잘 사용하지 않음',
  no_feature: '원하는 기능이 없음',
  moved_service: '비슷한 다른 서비스로 이동',
  privacy: '개인정보 걱정',
  other: '기타',
}

export default function WithdrawalPolicyAdminPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/withdrawal/jobs')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function retry(jobId: number) {
    setRetrying(jobId)
    await fetch('/api/admin/withdrawal/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
    await load()
    setRetrying(null)
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div>
          <h1 className="text-2xl font-bold">탈퇴 기록</h1>
          <p className="text-sm text-muted-foreground mt-1">
            최근 100건까지 보관됩니다.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full" />
          </div>
        )}

        {!loading && !data && (
          <p className="text-red-600">권한이 없거나 데이터를 불러올 수 없습니다.</p>
        )}

        {!loading && data && (
          <section>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2 font-medium">ID</th>
                      <th className="p-2 font-medium">회원</th>
                      <th className="p-2 font-medium">상태</th>
                      <th className="p-2 font-medium">시도</th>
                      <th className="p-2 font-medium">사유</th>
                      <th className="p-2 font-medium">신청 시각</th>
                      <th className="p-2 font-medium">완료 시각</th>
                      <th className="p-2 font-medium">오류</th>
                      <th className="p-2 font-medium">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jobs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-4 text-center text-muted-foreground">
                          탈퇴 기록 없음
                        </td>
                      </tr>
                    ) : (
                      data.jobs.map(j => (
                        <tr key={j.id} className="border-t">
                          <td className="p-2">{j.id}</td>
                          <td className="p-2">
                            <div>#{j.userId}</div>
                            {j.anonNickname && (
                              <div className="text-xs text-muted-foreground">{j.anonNickname}</div>
                            )}
                          </td>
                          <td className="p-2">
                            <Badge variant={STATUS_VARIANT[j.status] ?? 'outline'}>
                              {STATUS_LABEL[j.status] ?? j.status}
                            </Badge>
                          </td>
                          <td className="p-2">{j.attempts}회</td>
                          <td className="p-2 text-xs">
                            {j.reasonCode ? (REASON_LABEL[j.reasonCode] ?? j.reasonCode) : ''}
                            {j.reasonText ? ` — ${j.reasonText}` : ''}
                            {!j.reasonCode && !j.reasonText ? '—' : ''}
                          </td>
                          <td className="p-2 text-xs whitespace-nowrap">
                            {new Date(j.createdAt).toLocaleString('ko-KR')}
                          </td>
                          <td className="p-2 text-xs whitespace-nowrap">
                            {j.completedAt ? new Date(j.completedAt).toLocaleString('ko-KR') : '—'}
                          </td>
                          <td className="p-2 text-xs text-red-600 max-w-xs truncate" title={j.lastError || ''}>
                            {j.lastError || ''}
                          </td>
                          <td className="p-2">
                            {(j.status === 'failed' || j.status === 'pending') && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={retrying === j.id}
                                onClick={() => retry(j.id)}
                              >
                                {retrying === j.id ? '...' : '재시도'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
          </section>
        )}
      </main>
    </div>
  )
}
