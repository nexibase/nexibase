"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  Users,
  UserCheck,
  UserX,
  UserMinus,
  UserCog,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  UsersRound,
  Send,
} from "lucide-react"

interface User {
  id: string
  email: string
  nickname: string | null
  image: string | null
  role: string
  status: string
  emailVerified: string | null
  lastLoginAt: string | null
  createdAt: string
  deletedAt: string | null
  level: number
  adminNote: string | null
  providers: string[]
}

interface UserStats {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  bannedUsers: number
  withdrawnUsers: number
  deletedUsers: number
}

// Provider badge
function ProviderBadge({ provider }: { provider: string }) {
  const config: Record<string, { bg: string; text: string; border: string; label: string }> = {
    google: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Google' },
    kakao: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', label: 'Kakao' },
    naver: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', label: 'Naver' },
    github: { bg: 'bg-neutral-200', text: 'text-neutral-800', border: 'border-neutral-300', label: 'GitHub' },
  }
  const { bg, text, border, label } = config[provider] || { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', label: provider }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${bg} ${text} ${border}`}>
      {label}
    </span>
  )
}

// User modal
function UserModal({
  isOpen,
  onClose,
  user,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  user: User | null
  onSave: (data: Partial<User> & { password?: string }) => void
}) {
  const t = useTranslations('admin')
  const [formData, setFormData] = useState({
    email: '',
    nickname: '',
    password: '',
    role: 'user',
    level: 1,
    status: 'active',
    adminNote: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        nickname: user.nickname || '',
        password: '',
        role: user.role || 'user',
        level: user.level ?? 1,
        status: user.status || 'active',
        adminNote: user.adminNote || '',
      })
    } else {
      setFormData({
        email: '',
        nickname: '',
        password: '',
        role: 'user',
        level: 1,
        status: 'active',
        adminNote: '',
      })
    }
  }, [user, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await onSave(formData)
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-50 w-full max-w-lg mx-4 animate-in fade-in-0 zoom-in-95">
        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">
                {user ? t('editUser') : t('newUser')}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              {user ? t('editUserDesc') : t('newUserDesc')}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!user}
                  className={user ? 'bg-muted' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">{t('nicknameRequired')}</Label>
                <Input
                  id="nickname"
                  type="text"
                  placeholder={t('nicknamePlaceholder')}
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">{t('nicknameDesc')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {t('passwordLabel')} {user && <span className="text-muted-foreground font-normal">{t('passwordChangeOnly')}</span>}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!user}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">{t('roleLabel')}</Label>
                  <Select
                    key={`role-${user?.id || 'new'}-${formData.role}`}
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t('normalUser')}</SelectItem>
                      <SelectItem value="manager">{t('roleSubAdmin')}</SelectItem>
                      <SelectItem value="admin">{t('roleAdmin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">{t('levelLabel')}</Label>
                  <Input
                    id="level"
                    type="number"
                    min={1}
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t('statusLabel')}</Label>
                  <Select
                    key={`status-${user?.id || 'new'}-${formData.status}`}
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('statusActive')}</SelectItem>
                      <SelectItem value="inactive">{t('statusInactive')}</SelectItem>
                      <SelectItem value="banned">{t('statusBanned')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNote">{t('adminNote')}</Label>
                <Textarea
                  id="adminNote"
                  placeholder={t('adminNotePlaceholder')}
                  value={formData.adminNote}
                  onChange={(e) => setFormData({ ...formData, adminNote: e.target.value })}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </CardContent>

            <Separator />

            <div className="flex justify-end gap-3 p-6">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancelBtn')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {user ? t('saveBtn') : t('addBtn')}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

// Stats card
function StatCard({
  title,
  value,
  icon: Icon,
  active,
  onClick
}: {
  title: string
  value: number
  icon: React.ElementType
  active?: boolean
  onClick?: () => void
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${active ? 'ring-2 ring-primary' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
          </div>
          <div className={`p-3 rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function UsersPageContent() {
  const t = useTranslations('admin')
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read initial values from URL
  const initialStatus = searchParams.get('status') || ''
  const initialRole = searchParams.get('role') || ''
  const initialPage = parseInt(searchParams.get('page') || '1')
  const editUserId = searchParams.get('edit')

  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    bannedUsers: 0,
    withdrawnUsers: 0,
    deletedUsers: 0
  })
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [roleFilter, setRoleFilter] = useState(initialRole)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // If an edit param is present, open the matching user modal
  useEffect(() => {
    if (editUserId && !loading) {
      const userToEdit = users.find(u => String(u.id) === String(editUserId))
      if (userToEdit) {
        setEditingUser(userToEdit)
        setIsModalOpen(true)
        router.replace('/admin/users')
      } else {
        // Not in the list → fetch directly via the API
        fetch(`/api/admin/users/${editUserId}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.user) {
              // Add providers field
              const userWithProviders = {
                ...data.user,
                providers: data.user.accounts?.map((acc: { provider: string }) => acc.provider) || []
              }
              setEditingUser(userWithProviders)
              setIsModalOpen(true)
            }
            router.replace('/admin/users')
          })
          .catch(console.error)
      }
    }
  }, [editUserId, users, loading, router])

  // URL updater
  const updateURL = useCallback((status: string, role: string, page: number) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (role) params.set('role', role)
    if (page > 1) params.set('page', String(page))
    const query = params.toString()
    router.replace(`/admin/users${query ? `?${query}` : ''}`)
  }, [router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        search,
        status: statusFilter,
        role: roleFilter,
      })

      const response = await fetch(`/api/admin/users?${params}`)
      const data = await response.json()

      if (data.success) {
        setUsers(data.users)
        setStats(data.stats)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('failed to fetch user list:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, search, statusFilter, roleFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSaveUser = async (data: Partial<User> & { password?: string }) => {
    try {
      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : '/api/admin/users'

      const response = await fetch(url, {
        method: editingUser ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success) {
        setIsModalOpen(false)
        fetchUsers()
      } else {
        alert(result.message || t('saveFailed'))
      }
    } catch (error) {
      console.error('failed to save user:', error)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return

    try {
      const response = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.success) {
        fetchUsers()
      } else {
        alert(result.message || t('deleteFailed'))
      }
    } catch (error) {
      console.error('failed to delete user:', error)
    }
  }

  const handleRestoreUser = async (id: string) => {
    if (!confirm(t('confirmRestore'))) return

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' })
      })
      const result = await response.json()

      if (result.success) {
        fetchUsers()
      } else {
        alert(result.message || t('restoreFailed'))
      }
    } catch (error) {
      console.error('failed to restore user:', error)
    }
  }

  const handlePermanentDelete = async (id: string) => {
    if (!confirm(t('confirmPermanentDelete'))) return

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permanent: true })
      })
      const result = await response.json()

      if (result.success) {
        fetchUsers()
      } else {
        alert(result.message || t('permanentDeleteFailed'))
      }
    } catch (error) {
      console.error('failed to permanently delete user:', error)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const yy = String(date.getFullYear()).slice(-2)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yy}-${mm}-${dd}`
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: 'default', label: t('statusActive') },
      inactive: { variant: 'secondary', label: t('statusInactive') },
      banned: { variant: 'destructive', label: t('statusBanned') },
      withdrawn: { variant: 'outline', label: t('statusWithdrawn') },
    }
    const { variant, label } = config[status] || { variant: 'outline' as const, label: status }
    return <Badge variant={variant}>{label}</Badge>
  }

  const getRoleBadge = (role: string) => {
    const config: Record<string, { label: string; className: string }> = {
      admin: { label: t('roleAdmin'), className: 'bg-red-100 text-red-700 border-red-200' },
      manager: { label: t('roleSubAdmin'), className: 'bg-blue-100 text-blue-700 border-blue-200' },
      user: { label: t('roleUser'), className: 'text-xs text-muted-foreground' },
    }
    const { label, className } = config[role] || { label: role, className: 'text-xs text-muted-foreground' }
    if (role === 'user') return <span className={className}>{label}</span>
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${className}`}>
        {label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar activeMenu="users" />

        <main className="flex-1 p-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <UsersRound className="h-6 w-6" />
                {t('userManagement')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('usersDescription')}
              </p>
            </div>
            <Button onClick={() => { setEditingUser(null); setIsModalOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              {t('newUser')}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
            <StatCard
              title={t('allUsers')}
              value={stats.totalUsers}
              icon={Users}
              active={statusFilter === ''}
              onClick={() => { setStatusFilter(''); setCurrentPage(1); updateURL('', roleFilter, 1) }}
            />
            <StatCard
              title={t('activeUsers')}
              value={stats.activeUsers}
              icon={UserCheck}
              active={statusFilter === 'active'}
              onClick={() => { setStatusFilter('active'); setCurrentPage(1); updateURL('active', roleFilter, 1) }}
            />
            <StatCard
              title={t('inactiveUsers')}
              value={stats.inactiveUsers}
              icon={UserCog}
              active={statusFilter === 'inactive'}
              onClick={() => { setStatusFilter('inactive'); setCurrentPage(1); updateURL('inactive', roleFilter, 1) }}
            />
            <StatCard
              title={t('bannedUsers')}
              value={stats.bannedUsers}
              icon={UserX}
              active={statusFilter === 'banned'}
              onClick={() => { setStatusFilter('banned'); setCurrentPage(1); updateURL('banned', roleFilter, 1) }}
            />
            <StatCard
              title={t('withdrawnUsers')}
              value={stats.withdrawnUsers}
              icon={UserMinus}
              active={statusFilter === 'withdrawn'}
              onClick={() => { setStatusFilter('withdrawn'); setCurrentPage(1); updateURL('withdrawn', roleFilter, 1) }}
            />
            <StatCard
              title={t('deletedUsers')}
              value={stats.deletedUsers}
              icon={Trash2}
              active={statusFilter === 'deleted'}
              onClick={() => { setStatusFilter('deleted'); setCurrentPage(1); updateURL('deleted', roleFilter, 1) }}
            />
          </div>

          {/* Table Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Search */}
                <div className="flex flex-1 gap-2 max-w-lg">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t('userSearchPlaceholder')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                      className="pl-9"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); updateURL(statusFilter, e.target.value, 1) }}
                    className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">{t('allRoles')}</option>
                    <option value="admin">{t('roleAdmin')}</option>
                    <option value="manager">{t('roleSubAdmin')}</option>
                    <option value="user">{t('roleUser')}</option>
                  </select>
                </div>

              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-y bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('userColUser')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('userColProvider')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('role')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('userColLevel')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('status')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('createdAt')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {statusFilter === 'withdrawn' || statusFilter === 'deleted' ? t('userColDeletedAt') : t('userColLastLogin')}
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="h-32 text-center">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="h-32 text-center text-muted-foreground">
                          {t('noUsers')}
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <td className="p-4 align-middle">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.image || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                  {(user.nickname || user.email)[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {user.nickname || '-'}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {user.email}
                                </span>
                                {getRoleBadge(user.role)}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex flex-wrap gap-1">
                              {user.providers && user.providers.length > 0 ? (
                                [...new Set(user.providers)].map((provider) => (
                                  <ProviderBadge key={provider} provider={provider} />
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">{t('providerEmail')}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 align-middle text-sm">
                            {getRoleBadge(user.role)}
                          </td>
                          <td className="p-4 align-middle text-sm text-muted-foreground">
                            Lv.{user.level ?? 1}
                          </td>
                          <td className="p-4 align-middle">
                            {getStatusBadge(user.status)}
                          </td>
                          <td className="p-4 align-middle text-sm text-muted-foreground">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="p-4 align-middle text-sm text-muted-foreground">
                            {statusFilter === 'withdrawn' || statusFilter === 'deleted' ? formatDate(user.deletedAt) : formatDate(user.lastLoginAt)}
                          </td>
                          <td className="p-4 align-middle text-right">
                            {statusFilter === 'withdrawn' ? (
                              // Withdrawn user: data is anonymized, so no actions are offered
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : statusFilter === 'deleted' ? (
                              // Admin-deleted: data is retained so a restore is possible
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                onClick={() => handleRestoreUser(user.id)}
                                title={t('restore')}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            ) : (
                              <div className="flex justify-end gap-1">
                                {user.role !== 'admin' && user.role !== 'manager' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={async () => {
                                      const res = await fetch('/api/messages/conversation', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ toUserId: Number(user.id) }),
                                      })
                                      if (!res.ok) { alert(t('messages.send.failure')); return }
                                      const data = await res.json()
                                      window.open(`/mypage/messages/${data.conversationId}`, '_blank')
                                    }}
                                    title={t('messages.send.title')}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => { setEditingUser(user); setIsModalOpen(true) }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {t('totalOfCount', { total: stats.totalUsers, from: (currentPage - 1) * 10 + 1, to: Math.min(currentPage * 10, stats.totalUsers) })}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { const newPage = Math.max(1, currentPage - 1); setCurrentPage(newPage); updateURL(statusFilter, roleFilter, newPage) }}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page: number
                      if (totalPages <= 5) {
                        page = i + 1
                      } else if (currentPage <= 3) {
                        page = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i
                      } else {
                        page = currentPage - 2 + i
                      }
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setCurrentPage(page); updateURL(statusFilter, roleFilter, page) }}
                        >
                          {page}
                        </Button>
                      )
                    })}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { const newPage = Math.min(totalPages, currentPage + 1); setCurrentPage(newPage); updateURL(statusFilter, roleFilter, newPage) }}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={editingUser}
        onSave={handleSaveUser}
      />

    </div>
  )
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <UsersPageContent />
    </Suspense>
  )
}
