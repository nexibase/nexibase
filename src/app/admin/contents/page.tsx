"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TiptapEditor } from "@/components/editor/TiptapEditor"
import {
  Search,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  FileText,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react"

interface Content {
  id: number
  slug: string
  title: string
  content: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
  selected?: boolean
}

// 콘텐츠 모달
function ContentModal({
  isOpen,
  onClose,
  content,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  content: Content | null
  onSave: (data: Partial<Content>) => void
}) {
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    content: '',
    isPublic: true,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (content) {
      setFormData({
        slug: content.slug || '',
        title: content.title || '',
        content: content.content || '',
        isPublic: content.isPublic ?? true,
      })
    } else {
      setFormData({
        slug: '',
        title: '',
        content: '',
        isPublic: true,
      })
    }
  }, [content, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await onSave(formData)
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold">
            {content ? '콘텐츠 수정' : '콘텐츠 추가'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">
                슬러그 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                placeholder="about, company, contact..."
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                className={content ? 'bg-muted' : ''}
                disabled={!!content}
                required
              />
              <p className="text-xs text-muted-foreground">
                URL에 사용될 영문 소문자, 숫자, 하이픈
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">
                제목 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="회사소개, About Us..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>내용</Label>
            <TiptapEditor
              content={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              placeholder="내용을 입력하세요..."
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={formData.isPublic}
              onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
              className="rounded border-gray-300"
            />
            <Label htmlFor="isPublic" className="cursor-pointer">공개</Label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {content ? '수정' : '추가'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ContentsPage() {
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContent, setEditingContent] = useState<Content | null>(null)
  const [selectedAll, setSelectedAll] = useState(false)

  // 콘텐츠 목록 조회
  const fetchContents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search
      })

      const response = await fetch(`/api/admin/contents?${params}`)
      const data = await response.json()

      if (data.success) {
        setContents(data.contents.map((c: Content) => ({ ...c, selected: false })))
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('콘텐츠 목록 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchContents()
  }, [fetchContents])

  // 콘텐츠 저장
  const handleSaveContent = async (formData: Partial<Content>) => {
    try {
      const url = editingContent
        ? `/api/admin/contents/${editingContent.id}`
        : '/api/admin/contents'

      const response = await fetch(url, {
        method: editingContent ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setModalOpen(false)
        setEditingContent(null)
        fetchContents()
      } else {
        alert(data.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('콘텐츠 저장 에러:', error)
      alert('저장 중 오류가 발생했습니다.')
    }
  }

  // 콘텐츠 삭제
  const handleDelete = async (content: Content) => {
    if (!confirm(`"${content.title}" 콘텐츠를 삭제하시겠습니까?`)) return

    try {
      const response = await fetch(`/api/admin/contents/${content.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchContents()
      } else {
        const data = await response.json()
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('콘텐츠 삭제 에러:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  // 선택 삭제
  const handleBulkDelete = async () => {
    const selectedIds = contents.filter(c => c.selected).map(c => c.id)
    if (selectedIds.length === 0) {
      alert('삭제할 콘텐츠를 선택해주세요.')
      return
    }

    if (!confirm(`${selectedIds.length}개의 콘텐츠를 삭제하시겠습니까?`)) return

    try {
      const response = await fetch('/api/admin/contents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })

      if (response.ok) {
        setSelectedAll(false)
        fetchContents()
      } else {
        const data = await response.json()
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('일괄 삭제 에러:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  // 전체 선택
  const handleSelectAll = () => {
    const newSelected = !selectedAll
    setSelectedAll(newSelected)
    setContents(contents.map(c => ({ ...c, selected: newSelected })))
  }

  // 개별 선택
  const handleSelect = (id: number) => {
    setContents(contents.map(c =>
      c.id === id ? { ...c, selected: !c.selected } : c
    ))
  }

  // 검색
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchContents()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar activeMenu="contents" />
        <main className="flex-1 lg:ml-0 p-6">
          {/* 헤더 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">콘텐츠 관리</h1>
            <p className="text-muted-foreground mt-1">회사소개, About 등 일반 콘텐츠를 관리합니다</p>
          </div>

          {/* 검색 및 액션 */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="콘텐츠 검색..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button type="submit" variant="outline">검색</Button>
                </form>

                <div className="flex gap-2">
                  {contents.some(c => c.selected) && (
                    <Button variant="destructive" onClick={handleBulkDelete}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      선택 삭제
                    </Button>
                  )}
                  <Button onClick={() => { setEditingContent(null); setModalOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    콘텐츠 추가
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 콘텐츠 목록 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">콘텐츠 목록</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : contents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">콘텐츠가 없습니다.</p>
                  <Button onClick={() => { setEditingContent(null); setModalOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    첫 콘텐츠 추가
                  </Button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left w-10">
                            <input
                              type="checkbox"
                              checked={selectedAll}
                              onChange={handleSelectAll}
                              className="rounded border-gray-300"
                            />
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">제목</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">슬러그</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">상태</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">수정일</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contents.map((content) => (
                          <tr key={content.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={content.selected}
                                onChange={() => handleSelect(content.id)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="p-3">
                              <span className="font-medium text-foreground">{content.title}</span>
                            </td>
                            <td className="p-3">
                              <a
                                href={`/content/${content.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-muted hover:bg-primary/20 rounded text-sm transition-colors group"
                              >
                                <code className="group-hover:text-primary">/{content.slug}</code>
                                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                              </a>
                            </td>
                            <td className="p-3 text-center">
                              {content.isPublic ? (
                                <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/10 dark:bg-green-500/20 dark:text-green-400">
                                  <Eye className="h-3 w-3 mr-1" />
                                  공개
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  비공개
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {new Date(content.updatedAt).toLocaleDateString('ko-KR')}
                            </td>
                            <td className="p-3">
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setEditingContent(content); setModalOpen(true); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(content)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* 모달 */}
      <ContentModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingContent(null); }}
        content={editingContent}
        onSave={handleSaveContent}
      />
    </div>
  )
}
