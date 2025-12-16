"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Loader2,
  MessageSquare,
  Lock,
  Send,
} from "lucide-react"

interface Qna {
  id: number
  question: string
  answer: string | null
  answeredAt: string | null
  isSecret: boolean
  canView: boolean
  isOwner: boolean
  createdAt: string
  user: { id: number; name: string }
}

interface QnaSectionProps {
  slug: string
  qnas: Qna[]
  qnasLoading: boolean
  qnaTotal: number
  qnaPage: number
  onFetchQnas: (page: number) => void
}

export function QnaSection({
  slug,
  qnas,
  qnasLoading,
  qnaTotal,
  qnaPage,
  onFetchQnas,
}: QnaSectionProps) {
  const [showQnaForm, setShowQnaForm] = useState(false)
  const [qnaContent, setQnaContent] = useState('')
  const [qnaIsSecret, setQnaIsSecret] = useState(false)
  const [submittingQna, setSubmittingQna] = useState(false)

  // Q&A 작성
  const submitQna = async () => {
    if (!qnaContent.trim()) return
    setSubmittingQna(true)
    try {
      const res = await fetch(`/api/shop/products/${slug}/qna`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: qnaContent.trim(),
          isSecret: qnaIsSecret
        })
      })
      if (res.ok) {
        setShowQnaForm(false)
        setQnaContent('')
        setQnaIsSecret(false)
        onFetchQnas(1)
      } else {
        const data = await res.json()
        alert(data.error || 'Q&A 작성에 실패했습니다.')
      }
    } catch {
      alert('Q&A 작성에 실패했습니다.')
    } finally {
      setSubmittingQna(false)
    }
  }

  return (
    <div>
      {/* Q&A 작성 버튼 */}
      {!showQnaForm && (
        <div className="mb-6">
          <Button onClick={() => setShowQnaForm(true)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            문의하기
          </Button>
        </div>
      )}

      {/* Q&A 작성 폼 */}
      {showQnaForm && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>문의 내용</Label>
              <Textarea
                value={qnaContent}
                onChange={(e) => setQnaContent(e.target.value)}
                placeholder="상품에 대해 궁금한 점을 문의해주세요."
                className="mt-1"
                rows={4}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="qna-secret"
                checked={qnaIsSecret}
                onCheckedChange={setQnaIsSecret}
              />
              <Label htmlFor="qna-secret" className="flex items-center gap-1 cursor-pointer">
                <Lock className="h-4 w-4" />
                비밀글로 작성
              </Label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowQnaForm(false)}>
                취소
              </Button>
              <Button
                onClick={submitQna}
                disabled={submittingQna || !qnaContent.trim()}
              >
                {submittingQna ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                등록
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Q&A 목록 */}
      {qnasLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : qnas.length > 0 ? (
        <div className="space-y-4">
          {qnas.map(qna => (
            <div key={qna.id} className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {qna.isSecret && (
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        비밀글
                      </Badge>
                    )}
                    <span className="font-medium text-sm">{qna.user.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(qna.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                    {qna.answer && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                        답변완료
                      </Badge>
                    )}
                  </div>

                  {/* 질문 */}
                  <div className="mb-3">
                    <span className="inline-block px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded mr-2">Q</span>
                    <span className={`text-sm ${!qna.canView ? 'text-muted-foreground italic' : ''}`}>
                      {qna.question}
                    </span>
                  </div>

                  {/* 답변 */}
                  {qna.answer && (
                    <div className="p-3 bg-muted rounded-lg">
                      <span className="inline-block px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded mr-2">A</span>
                      <span className={`text-sm ${!qna.canView ? 'text-muted-foreground italic' : ''}`}>
                        {qna.answer}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 페이지네이션 */}
          {qnaTotal > 10 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFetchQnas(qnaPage - 1)}
                disabled={qnaPage <= 1}
              >
                이전
              </Button>
              <span className="flex items-center px-3 text-sm">
                {qnaPage} / {Math.ceil(qnaTotal / 10)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFetchQnas(qnaPage + 1)}
                disabled={qnaPage >= Math.ceil(qnaTotal / 10)}
              >
                다음
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-12">
          아직 등록된 Q&A가 없습니다.
        </p>
      )}
    </div>
  )
}
