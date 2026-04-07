"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Loader2, Save, Trash2, ExternalLink } from "lucide-react"
import Link from "next/link"

interface Board {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
  listMemberOnly: boolean
  readMemberOnly: boolean
  writeMemberOnly: boolean
  commentMemberOnly: boolean
  useComment: boolean
  useReaction: boolean
  useFile: boolean
  useSecret: boolean
  postsPerPage: number
  sortOrder: string
  displayType: string
  isActive: boolean
  postCount: number
}

export default function BoardEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [board, setBoard] = useState<Board | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    listMemberOnly: false,
    readMemberOnly: false,
    writeMemberOnly: true,
    commentMemberOnly: true,
    useComment: true,
    useReaction: true,
    useFile: true,
    useSecret: false,
    postsPerPage: 20,
    sortOrder: 'latest',
    displayType: 'list',
    isActive: true,
  })

  useEffect(() => {
    fetch(`/api/admin/boards/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.board) {
          const b = data.board
          setBoard(b)
          setFormData({
            name: b.name || '',
            description: b.description || '',
            category: b.category || '',
            listMemberOnly: b.listMemberOnly ?? false,
            readMemberOnly: b.readMemberOnly ?? false,
            writeMemberOnly: b.writeMemberOnly ?? true,
            commentMemberOnly: b.commentMemberOnly ?? true,
            useComment: b.useComment ?? true,
            useReaction: b.useReaction ?? true,
            useFile: b.useFile ?? true,
            useSecret: b.useSecret ?? false,
            postsPerPage: b.postsPerPage ?? 20,
            sortOrder: b.sortOrder || 'latest',
            displayType: b.displayType || 'list',
            isActive: b.isActive ?? true,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/boards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (res.ok) {
        alert('저장되었습니다.')
        router.push('/admin/boards')
      } else {
        alert(data.error || '저장 실패')
      }
    } catch {
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!board) return
    if (!confirm(`"${board.name}" 게시판을 삭제하시겠습니까?\n게시글, 댓글, 반응이 모두 삭제됩니다.`)) return
    try {
      const res = await fetch(`/api/admin/boards/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/boards')
      } else {
        alert('삭제 실패')
      }
    } catch {
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-6 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-6">
          <p className="text-muted-foreground">게시판을 찾을 수 없습니다.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href="/admin/boards">
                <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">게시판 수정</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>/{board.slug}</span>
                  <span>·</span>
                  <span>게시글 {board.postCount}개</span>
                  <Link href={`/boards/${board.slug}`} target="_blank" className="hover:text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> 삭제
            </Button>
          </div>

          {/* 기본 정보 */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">기본 정보</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>슬러그</Label>
                  <Input value={board.slug} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">슬러그는 변경할 수 없습니다</p>
                </div>
                <div className="space-y-2">
                  <Label>게시판 이름 <span className="text-red-500">*</span></Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>설명</Label>
                  <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="게시판 설명" />
                </div>
                <div className="space-y-2">
                  <Label>카테고리</Label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="">선택 안함</option>
                    <option value="community">커뮤니티</option>
                    <option value="support">고객지원</option>
                    <option value="notice">공지</option>
                    <option value="gallery">갤러리</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>페이지당 글 수</Label>
                  <Input type="number" min={5} max={100} value={formData.postsPerPage} onChange={e => setFormData({ ...formData, postsPerPage: parseInt(e.target.value) || 20 })} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 권한 설정 */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">권한 설정</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">체크하면 회원만 이용 가능</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center space-x-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50">
                  <input type="checkbox" checked={formData.listMemberOnly} onChange={e => setFormData({ ...formData, listMemberOnly: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">목록 보기</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50">
                  <input type="checkbox" checked={formData.readMemberOnly} onChange={e => setFormData({ ...formData, readMemberOnly: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">글 읽기</span>
                </label>
                <label className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30 opacity-70">
                  <input type="checkbox" checked={true} disabled className="rounded border-gray-300" />
                  <span className="text-sm">글 쓰기</span>
                </label>
                <label className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30 opacity-70">
                  <input type="checkbox" checked={true} disabled className="rounded border-gray-300" />
                  <span className="text-sm">댓글 쓰기</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* 기능 설정 */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">기능 설정</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useComment} onChange={e => setFormData({ ...formData, useComment: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">댓글 사용</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useReaction} onChange={e => setFormData({ ...formData, useReaction: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">반응 사용</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useFile} onChange={e => setFormData({ ...formData, useFile: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">파일 첨부</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useSecret} onChange={e => setFormData({ ...formData, useSecret: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm">비밀글</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* 표시 설정 */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">표시 설정</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>표시 형식</Label>
                  <select value={formData.displayType} onChange={e => setFormData({ ...formData, displayType: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="list">목록형</option>
                    <option value="gallery">갤러리형</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>정렬 순서</Label>
                  <select value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="latest">최신순</option>
                    <option value="popular">인기순</option>
                    <option value="oldest">오래된순</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 상태 + 저장 */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm font-medium">게시판 활성화</span>
                </label>
                <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  저장
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
