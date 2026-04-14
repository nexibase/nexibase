"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from 'next-intl'
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  LayoutGrid,
  FileText,
  MessageSquare,
  Eye,
  ChevronLeft,
  ChevronRight,
  Check,
  ExternalLink,
  Heart,
  Sparkles,
  Clipboard,
} from "lucide-react"

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
  createdAt: string
  selected?: boolean
}

interface BoardStats {
  totalBoards: number
  activeBoards: number
  totalPosts: number
}

// 카테고리 배지
function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null

  const config: Record<string, { bg: string; text: string }> = {
    community: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
    support: { bg: 'bg-green-500/10 dark:bg-green-500/20', text: 'text-green-600 dark:text-green-400' },
    notice: { bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400' },
    gallery: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
  }
  const { bg, text } = config[category] || { bg: 'bg-muted', text: 'text-muted-foreground' }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {category}
    </span>
  )
}

// 게시판 모달
function BoardModal({
  isOpen,
  onClose,
  board,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  board: Board | null
  onSave: (data: Partial<Board>) => void
}) {
  const t = useTranslations('boards')
  const [formData, setFormData] = useState({
    slug: '',
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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (board) {
      setFormData({
        slug: board.slug || '',
        name: board.name || '',
        description: board.description || '',
        category: board.category || '',
        listMemberOnly: board.listMemberOnly ?? false,
        readMemberOnly: board.readMemberOnly ?? false,
        writeMemberOnly: board.writeMemberOnly ?? true,
        commentMemberOnly: board.commentMemberOnly ?? true,
        useComment: board.useComment ?? true,
        useReaction: board.useReaction ?? true,
        useFile: board.useFile ?? true,
        useSecret: board.useSecret ?? false,
        postsPerPage: board.postsPerPage ?? 20,
        sortOrder: board.sortOrder || 'latest',
        displayType: board.displayType || 'list',
        isActive: board.isActive ?? true,
      })
    } else {
      setFormData({
        slug: '',
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
    }
  }, [board, isOpen])

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
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {board ? t('admin.edit') : t('admin.addBoard')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('admin.basicInfo')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slug">
                  {t('admin.slug')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="slug"
                  placeholder="free, notice, qa..."
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                  className={board ? 'bg-muted' : ''}
                  disabled={!!board}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin.slugDesc')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  {t('admin.boardName')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder={t('admin.namePlaceholder')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">{t('admin.description')}</Label>
                <Input
                  id="description"
                  placeholder={t('admin.descPlaceholder')}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t('admin.category')}</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">{t('admin.categoryNone')}</option>
                  <option value="community">{t('admin.categoryCommunity')}</option>
                  <option value="support">{t('admin.categorySupport')}</option>
                  <option value="notice">{t('admin.categoryNotice')}</option>
                  <option value="gallery">{t('admin.categoryGallery')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="postsPerPage">{t('admin.postsPerPage')}</Label>
                <Input
                  id="postsPerPage"
                  type="number"
                  min={5}
                  max={100}
                  value={formData.postsPerPage}
                  onChange={(e) => setFormData({ ...formData, postsPerPage: parseInt(e.target.value) || 20 })}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* 권한 설정 */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('admin.permissions')}</h3>
            <p className="text-xs text-muted-foreground mb-4">{t('admin.permDesc')}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={formData.listMemberOnly}
                  onChange={(e) => setFormData({ ...formData, listMemberOnly: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{t('admin.listView')}</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={formData.readMemberOnly}
                  onChange={(e) => setFormData({ ...formData, readMemberOnly: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{t('admin.readPost')}</span>
              </label>
              <label className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30 cursor-not-allowed opacity-70" title={t('admin.writeNotSupportedGuest')}>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{t('admin.writePost')} <span className="text-xs text-muted-foreground">{t('admin.writeMemberOnlyShort')}</span></span>
              </label>
              <label className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30 cursor-not-allowed opacity-70" title={t('admin.commentNotSupportedGuest')}>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{t('admin.commentWrite')} <span className="text-xs text-muted-foreground">{t('admin.writeMemberOnlyShort')}</span></span>
              </label>
            </div>
          </div>

          <Separator />

          {/* 기능 설정 */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('admin.features')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.useComment}
                  onChange={(e) => setFormData({ ...formData, useComment: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{t('admin.useComment')}</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.useReaction}
                  onChange={(e) => setFormData({ ...formData, useReaction: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{t('admin.useReaction')}</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.useFile}
                  onChange={(e) => setFormData({ ...formData, useFile: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{t('admin.useFile')}</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.useSecret}
                  onChange={(e) => setFormData({ ...formData, useSecret: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{t('admin.useSecret')}</span>
              </label>
            </div>
          </div>

          <Separator />

          {/* 표시 설정 */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('admin.displaySettings')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayType">{t('admin.displayType')}</Label>
                <select
                  id="displayType"
                  value={formData.displayType}
                  onChange={(e) => setFormData({ ...formData, displayType: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="list">{t('admin.displayList')}</option>
                  <option value="gallery">{t('admin.displayGallery')}</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {formData.displayType === 'gallery'
                    ? t('admin.displayGalleryDesc')
                    : t('admin.displayListDesc')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">{t('admin.sortOrder')}</Label>
                <select
                  id="sortOrder"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="latest">{t('admin.sortLatest')}</option>
                  <option value="popular">{t('admin.sortPopular')}</option>
                  <option value="oldest">{t('admin.sortOldest')}</option>
                </select>
              </div>
            </div>
          </div>

          <Separator />

          {/* 상태 설정 */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('admin.statusSection')}</h3>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{t('admin.activate')}</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('admin.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {board ? t('edit') : t('admin.add')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 통계 카드
function StatCard({ icon: Icon, label, value, color, href, onClick, isActive }: {
  icon: React.ElementType
  label: string
  value: number
  color: string
  href?: string
  onClick?: () => void
  isActive?: boolean
}) {
  const cardContent = (
    <CardContent className="p-4">
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        </div>
      </div>
    </CardContent>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          {cardContent}
        </Card>
      </a>
    )
  }

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        className="cursor-pointer"
      >
        <Card className={`hover:bg-muted/50 transition-colors ${isActive ? 'ring-2 ring-primary' : ''}`}>
          {cardContent}
        </Card>
      </div>
    )
  }

  return (
    <Card>
      {cardContent}
    </Card>
  )
}

export default function BoardsPage() {
  const t = useTranslations('boards')
  const [activeMenu, setActiveMenu] = useState("boards")
  const [boards, setBoards] = useState<Board[]>([])
  const [stats, setStats] = useState<BoardStats>({ totalBoards: 0, activeBoards: 0, totalPosts: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBoard, setEditingBoard] = useState<Board | null>(null)
  const [selectedAll, setSelectedAll] = useState(false)
  const [seedingBoards, setSeedingBoards] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active'>('all')

  // 기본 게시판 생성
  const handleSeedBoards = async () => {
    if (!confirm(t('admin.createDefaultConfirm'))) return

    setSeedingBoards(true)
    try {
      const response = await fetch('/api/admin/boards/seed', {
        method: 'POST'
      })
      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        fetchBoards()
      } else {
        alert(data.error || t('admin.createFailed'))
      }
    } catch (error) {
      console.error('기본 게시판 생성 에러:', error)
      alert(t('admin.createError'))
    } finally {
      setSeedingBoards(false)
    }
  }

  // 게시판 목록 조회
  const fetchBoards = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search
      })

      const response = await fetch(`/api/admin/boards?${params}`)
      const data = await response.json()

      if (data.success) {
        setBoards(data.boards.map((b: Board) => ({ ...b, selected: false })))
        setTotalPages(data.pagination.totalPages)

        // 통계 계산
        const totalPosts = data.boards.reduce((sum: number, b: Board) => sum + (b.postCount || 0), 0)
        const activeBoards = data.boards.filter((b: Board) => b.isActive).length

        setStats({
          totalBoards: data.pagination.total,
          activeBoards,
          totalPosts
        })
      }
    } catch (error) {
      console.error('게시판 목록 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  // 게시판 저장
  const handleSaveBoard = async (formData: Partial<Board>) => {
    try {
      const url = editingBoard
        ? `/api/admin/boards/${editingBoard.id}`
        : '/api/admin/boards'

      const response = await fetch(url, {
        method: editingBoard ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setModalOpen(false)
        setEditingBoard(null)
        fetchBoards()
      } else {
        alert(data.error || t('admin.saveFailed'))
      }
    } catch (error) {
      console.error('게시판 저장 에러:', error)
      alert(t('admin.saveError'))
    }
  }

  // 게시판 삭제
  const handleDelete = async (board: Board) => {
    if (!confirm(t('admin.deleteBoardConfirm', { name: board.name }))) return

    try {
      const response = await fetch(`/api/admin/boards/${board.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchBoards()
      } else {
        const data = await response.json()
        alert(data.error || t('admin.deleteFailed'))
      }
    } catch (error) {
      console.error('게시판 삭제 에러:', error)
      alert(t('admin.deleteError'))
    }
  }

  // 선택 삭제
  const handleBulkDelete = async () => {
    const selectedIds = boards.filter(b => b.selected).map(b => b.id)
    if (selectedIds.length === 0) {
      alert(t('admin.selectToDelete'))
      return
    }

    if (!confirm(t('admin.bulkDeleteConfirm', { count: selectedIds.length }))) return

    try {
      const response = await fetch('/api/admin/boards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })

      if (response.ok) {
        setSelectedAll(false)
        fetchBoards()
      } else {
        const data = await response.json()
        alert(data.error || t('admin.deleteFailed'))
      }
    } catch (error) {
      console.error('일괄 삭제 에러:', error)
      alert(t('admin.deleteError'))
    }
  }

  // 전체 선택
  const handleSelectAll = () => {
    const newSelected = !selectedAll
    setSelectedAll(newSelected)
    setBoards(boards.map(b => ({ ...b, selected: newSelected })))
  }

  // 개별 선택
  const handleSelect = (id: string) => {
    setBoards(boards.map(b =>
      b.id === id ? { ...b, selected: !b.selected } : b
    ))
  }

  // 검색
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchBoards()
  }

  // 필터링된 게시판 목록
  const filteredBoards = statusFilter === 'active'
    ? boards.filter(b => b.isActive)
    : boards

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
        <main className="flex-1 lg:ml-0 p-6">
          {/* 헤더 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clipboard className="h-6 w-6" />
              {t('admin.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('admin.subtitle')}</p>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard
              icon={LayoutGrid}
              label={t('admin.totalBoards')}
              value={stats.totalBoards}
              color="bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
              onClick={() => setStatusFilter('all')}
              isActive={statusFilter === 'all'}
            />
            <StatCard
              icon={Check}
              label={t('admin.activeBoards')}
              value={stats.activeBoards}
              color="bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400"
              onClick={() => setStatusFilter('active')}
              isActive={statusFilter === 'active'}
            />
            <StatCard
              icon={FileText}
              label={t('admin.totalPosts')}
              value={stats.totalPosts}
              color="bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400"
              href="/posts/latest"
            />
          </div>

          {/* 검색 및 액션 */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('admin.searchPlaceholder')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button type="submit" variant="outline">{t('admin.search')}</Button>
                </form>

                <div className="flex gap-2">
                  <Button onClick={() => { setEditingBoard(null); setModalOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('admin.addBoard')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 게시판 목록 */}
          <Card id="board-list">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {t('admin.boardList')}
                  {statusFilter === 'active' && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{t('admin.activeOnly')}</span>
                  )}
                </CardTitle>
                {statusFilter !== 'all' && (
                  <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
                    {t('admin.resetFilter')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : boards.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">{t('admin.noBoards')}</p>
                  <Button onClick={handleSeedBoards} disabled={seedingBoards}>
                    {seedingBoards ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {t('admin.createDefault')}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('admin.createDefaultDesc')}
                  </p>
                </div>
              ) : filteredBoards.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">{t('admin.noFilterMatch')}</p>
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
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">{t('admin.colBoard')}</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">{t('admin.colSlug')}</th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">{t('admin.colCategory')}</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">{t('admin.colPosts')}</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">{t('admin.colFunc')}</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">{t('admin.colStatus')}</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">{t('admin.colManage')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBoards.map((board) => (
                          <tr key={board.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={board.selected}
                                onChange={() => handleSelect(board.id)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="p-3">
                              <div>
                                <div className="font-medium text-foreground">{board.name}</div>
                                {board.description && (
                                  <div className="text-sm text-muted-foreground truncate max-w-xs">
                                    {board.description}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <a
                                href={`/boards/${board.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-muted hover:bg-primary/20 rounded text-sm transition-colors group"
                              >
                                <code className="group-hover:text-primary">/{board.slug}</code>
                                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                              </a>
                            </td>
                            <td className="p-3">
                              <CategoryBadge category={board.category} />
                            </td>
                            <td className="p-3 text-center">
                              <span className="font-medium">{board.postCount || 0}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex justify-center gap-1">
                                {board.useComment && (
                                  <span title={t('admin.iconComment')} className="p-1 bg-blue-500/10 dark:bg-blue-500/20 rounded">
                                    <MessageSquare className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                  </span>
                                )}
                                {board.useReaction && (
                                  <span title={t('admin.iconReaction')} className="p-1 bg-pink-500/10 dark:bg-pink-500/20 rounded">
                                    <Heart className="h-3 w-3 text-pink-600 dark:text-pink-400" />
                                  </span>
                                )}
                                {board.useFile && (
                                  <span title={t('admin.iconFile')} className="p-1 bg-green-500/10 dark:bg-green-500/20 rounded">
                                    <FileText className="h-3 w-3 text-green-600 dark:text-green-400" />
                                  </span>
                                )}
                                {board.useSecret && (
                                  <span title={t('admin.iconSecret')} className="p-1 bg-yellow-500/10 dark:bg-yellow-500/20 rounded">
                                    <Eye className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {board.isActive ? (
                                <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/10 dark:bg-green-500/20 dark:text-green-400">
                                  {t('admin.active')}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">{t('admin.inactive')}</Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex justify-center gap-1">
                                <a href={`/admin/boards/${board.id}`}>
                                  <Button variant="ghost" size="sm">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </a>
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
      <BoardModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingBoard(null); }}
        board={editingBoard}
        onSave={handleSaveBoard}
      />
    </div>
  )
}
