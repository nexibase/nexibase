'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MyPageLayout } from '@/components/layout/MyPageLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

type PreviewRow = { plugin: string; model: string; count: number; reason?: string; retentionYears?: number }
type Preview = {
  toDelete: PreviewRow[]
  toRetainAnonymized: PreviewRow[]
  toRetainLegal: PreviewRow[]
}

const REASON_OPTIONS = [
  { value: 'rarely_used',   label: '서비스를 잘 사용하지 않음' },
  { value: 'no_feature',    label: '원하는 기능이 없음' },
  { value: 'moved_service', label: '비슷한 다른 서비스로 이동' },
  { value: 'privacy',       label: '개인정보 걱정' },
  { value: 'other',         label: '기타' },
]

function displayLabel(row: PreviewRow): string {
  const map: Record<string, string> = {
    Order: '주문 내역',
    Post: '내가 쓴 게시글',
    Comment: '내가 쓴 댓글',
    ProductReview: '내가 쓴 상품 리뷰',
    ProductQna: '내가 쓴 상품 Q&A',
    Reaction: '좋아요/반응',
    Conversation: '대화방',
    Message: '메시지',
    Wishlist: '위시리스트',
    UserAddress: '배송지',
    Notification: '알림',
    NotificationPreference: '알림 설정',
    Account: '소셜 로그인 연동',
    PendingOrder: '미결제 주문',
    Poll: '내가 만든 투표',
    PollVote: '투표 참여',
  }
  return map[row.model] || row.model
}

export default function WithdrawPage() {
  const router = useRouter()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [reasonCode, setReasonCode] = useState<string>('')
  const [reasonText, setReasonText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me/withdraw/preview')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setPreview)
      .catch(() => setError('미리보기를 불러오지 못했습니다. 다시 로그인해주세요.'))
      .finally(() => setLoading(false))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const body: Record<string, string> = {}
    if (password) body.password = password
    if (reasonCode) body.reasonCode = reasonCode
    if (reasonCode === 'other' && reasonText) body.reasonText = reasonText

    const res = await fetch('/api/me/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      router.push('/?withdrawn=1')
      return
    }
    const err = await res.json().catch(() => ({ error: 'unknown' }))
    const map: Record<string, string> = {
      invalid_password: '비밀번호가 일치하지 않습니다.',
      password_required: '비밀번호를 입력해주세요.',
      unauthorized: '로그인이 필요합니다.',
    }
    setError(map[err.error] || '탈퇴 처리 중 오류가 발생했습니다.')
    setSubmitting(false)
  }

  if (loading) return <MyPageLayout><div className="p-6 text-sm text-muted-foreground">로딩 중…</div></MyPageLayout>
  if (!preview) return <MyPageLayout><div className="p-6 text-sm text-destructive">{error || '미리보기를 불러올 수 없습니다.'}</div></MyPageLayout>

  return (
    <MyPageLayout>
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <h1 className="text-2xl font-bold">회원 탈퇴</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">삭제되는 정보</CardTitle>
          </CardHeader>
          <CardContent>
            {preview.toDelete.length === 0 ? (
              <p className="text-sm text-muted-foreground">삭제할 항목 없음</p>
            ) : (
              <ul className="text-sm list-disc pl-5 space-y-1">
                {preview.toDelete.map(r => (
                  <li key={`${r.plugin}/${r.model}`}>{displayLabel(r)} {r.count}개</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">익명 처리되는 정보</CardTitle>
          </CardHeader>
          <CardContent>
            {preview.toRetainAnonymized.length === 0 ? (
              <p className="text-sm text-muted-foreground">해당 없음</p>
            ) : (
              <>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  {preview.toRetainAnonymized.map(r => (
                    <li key={`${r.plugin}/${r.model}`}>{displayLabel(r)} {r.count}개</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  작성자 이름이 &quot;탈퇴한회원_xxxxxx&quot;로 바뀌며 글/대화 내용은 남습니다.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">법적으로 유지되는 정보</CardTitle>
          </CardHeader>
          <CardContent>
            {preview.toRetainLegal.length === 0 ? (
              <p className="text-sm text-muted-foreground">해당 없음</p>
            ) : (
              <ul className="text-sm list-disc pl-5 space-y-1">
                {preview.toRetainLegal.map(r => (
                  <li key={`${r.plugin}/${r.model}`}>
                    {displayLabel(r)} {r.count}건 ({r.retentionYears}년간 보관 후 파기 — 전자상거래법)
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground mt-2">재가입하셔도 조회할 수 없습니다.</p>
          </CardContent>
        </Card>

        <form onSubmit={onSubmit} className="space-y-6 border-t pt-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">탈퇴 사유 (선택)</Label>
            <RadioGroup value={reasonCode} onValueChange={setReasonCode} className="gap-3 pt-1">
              {REASON_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-3">
                  <RadioGroupItem value={opt.value} id={`reason-${opt.value}`} />
                  <Label htmlFor={`reason-${opt.value}`} className="text-base font-normal cursor-pointer leading-relaxed">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {reasonCode === 'other' && (
              <Textarea
                maxLength={500}
                rows={3}
                placeholder="탈퇴 사유를 적어주세요 (500자 이내)"
                value={reasonText}
                onChange={e => setReasonText(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-password" className="font-semibold">비밀번호 확인</Label>
            <Input
              id="withdraw-password"
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <p className="text-xs text-muted-foreground">소셜 로그인만 사용 중이면 비워두셔도 됩니다.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={submitting}
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={submitting}
            >
              {submitting ? '처리 중…' : '탈퇴하기'}
            </Button>
          </div>
        </form>

        <p className="text-xs text-muted-foreground">※ 탈퇴 후에는 복구할 수 없습니다.</p>
      </div>
    </MyPageLayout>
  )
}
