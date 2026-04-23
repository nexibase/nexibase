'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/admin/Sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Job = {
  id: number
  userId: number
  status: string
  attempts: number
  lastError: string | null
  reasonCode: string | null
  reasonText: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

type PolicyEntry = {
  model: string
  policy: string
  reason?: string
  parent?: string
  handler?: string
  field?: string
}

type Data = {
  jobs: Job[]
  policies: Record<string, PolicyEntry[]>
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  done: 'default',
  failed: 'destructive',
  running: 'secondary',
  pending: 'outline',
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

  const grouped: Record<string, Array<{ plugin: string } & PolicyEntry>> = {
    retain: [],
    delete: [],
    'retain-via-parent': [],
    custom: [],
  }

  if (data) {
    for (const [plugin, entries] of Object.entries(data.policies)) {
      for (const e of entries) {
        ;(grouped[e.policy] ||= []).push({ plugin, ...e })
      }
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6 space-y-8 overflow-auto">
        <h1 className="text-2xl font-bold">탈퇴 정책 감사</h1>

        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full" />
          </div>
        )}

        {!loading && !data && (
          <p className="text-red-600">권한이 없거나 데이터를 불러올 수 없습니다.</p>
        )}

        {!loading && data && (
          <>
            {/* Policy declarations */}
            <section>
              <h2 className="font-semibold text-lg mb-4">선언된 정책</h2>
              {(['retain', 'retain-via-parent', 'delete', 'custom'] as const).map(policy => (
                <div key={policy} className="mb-6">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <span className="font-mono">{policy}</span>{' '}
                    <span className="text-sm text-muted-foreground">
                      ({grouped[policy]?.length || 0}건)
                    </span>
                  </h3>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="p-2 font-medium">플러그인</th>
                          <th className="p-2 font-medium">모델</th>
                          <th className="p-2 font-medium">메모</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(grouped[policy] || []).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-2 text-muted-foreground text-center">
                              항목 없음
                            </td>
                          </tr>
                        ) : (
                          (grouped[policy] || []).map((r, i) => (
                            <tr key={`${r.plugin}/${r.model}/${i}`} className="border-t">
                              <td className="p-2 text-muted-foreground">{r.plugin}</td>
                              <td className="p-2 font-mono">{r.model}</td>
                              <td className="p-2 text-muted-foreground text-xs">
                                {r.reason || (r.parent ? `via parent ${r.parent}` : r.handler ? `handler: ${r.handler}` : '—')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>

            {/* Recent withdrawal jobs */}
            <section>
              <h2 className="font-semibold text-lg mb-4">
                최근 탈퇴 기록{' '}
                <span className="text-sm font-normal text-muted-foreground">(최대 100건)</span>
              </h2>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2 font-medium">ID</th>
                      <th className="p-2 font-medium">userId</th>
                      <th className="p-2 font-medium">상태</th>
                      <th className="p-2 font-medium">시도</th>
                      <th className="p-2 font-medium">사유</th>
                      <th className="p-2 font-medium">생성</th>
                      <th className="p-2 font-medium">완료</th>
                      <th className="p-2 font-medium">오류</th>
                      <th className="p-2 font-medium">액션</th>
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
                          <td className="p-2">{j.userId}</td>
                          <td className="p-2">
                            <Badge variant={STATUS_VARIANT[j.status] ?? 'outline'}>
                              {j.status}
                            </Badge>
                          </td>
                          <td className="p-2">{j.attempts}</td>
                          <td className="p-2 text-xs">
                            {j.reasonCode}
                            {j.reasonText ? ` / ${j.reasonText}` : ''}
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
          </>
        )}
      </main>
    </div>
  )
}
