'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/admin/Sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  FileText,
  ScrollText,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Recipe {
  id: number
  slug: string
  titleEn: string
  titleKo: string
  difficulty: string
  type: string
  generatedAt: string
}

interface GenerationLog {
  id: number
  startedAt: string
  finishedAt: string | null
  status: string
  difficulty: string
  type: string
  slot: number
  recipeId: number | null
  errorMessage: string | null
  tokensUsed: number | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const DIFF_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  running: 'bg-blue-100 text-blue-800',
  skipped: 'bg-gray-100 text-gray-800',
}

export default function VibeRecipesAdminPage() {
  const t = useTranslations('vibe-coding-recipes.admin')
  const [tab, setTab] = useState<'recipes' | 'logs'>('recipes')

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('headerDesc')}</p>
          </div>

          <div className="flex gap-2 mb-6">
            <Button
              variant={tab === 'recipes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('recipes')}
              className="gap-1"
            >
              <FileText className="h-4 w-4" />
              {t('tabRecipes')}
            </Button>
            <Button
              variant={tab === 'logs' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('logs')}
              className="gap-1"
            >
              <ScrollText className="h-4 w-4" />
              {t('tabLogs')}
            </Button>
          </div>

          {tab === 'recipes' ? <RecipesTab /> : <LogsTab />}
        </div>
      </div>
    </div>
  )
}

function RecipesTab() {
  const t = useTranslations('vibe-coding-recipes.admin')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [difficulty, setDifficulty] = useState('')
  const [type, setType] = useState('')
  const [showGenerate, setShowGenerate] = useState(false)
  const [generating, setGenerating] = useState(false)

  const fetchRecipes = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (difficulty) params.set('difficulty', difficulty)
      if (type) params.set('type', type)

      const res = await fetch(`/api/admin/vibe-coding-recipes?${params}`)
      const data = await res.json()
      if (data.success) {
        setRecipes(data.recipes)
        setPagination(data.pagination)
      }
    } finally {
      setLoading(false)
    }
  }, [difficulty, type])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  const handleDelete = async (id: number) => {
    if (!confirm(t('deleteConfirm'))) return
    const res = await fetch(`/api/admin/vibe-coding-recipes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchRecipes(pagination.page)
    } else {
      alert(t('deleteFailed'))
    }
  }

  const handleGenerate = async (genDifficulty: string, genType: string, genTopic: string) => {
    setGenerating(true)
    try {
      const body: Record<string, string> = { difficulty: genDifficulty, type: genType }
      if (genTopic.trim()) body.topic = genTopic.trim()
      const res = await fetch('/api/admin/vibe-coding-recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        alert(t('generateSuccess'))
        setShowGenerate(false)
        fetchRecipes()
      } else {
        alert(`${t('generateFailed')}: ${data.error || ''}`)
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={difficulty} onValueChange={(v) => setDifficulty(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('colDifficulty')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={(v) => setType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('colType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="plugin">Plugin</SelectItem>
            <SelectItem value="widget">Widget</SelectItem>
            <SelectItem value="plugin_with_widget">Plugin + Widget</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button onClick={() => setShowGenerate(true)} className="gap-1">
          <Sparkles className="h-4 w-4" />
          {t('generateBtn')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No recipes</div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">{t('colTitle')}</th>
                <th className="text-left p-3">{t('colSlug')}</th>
                <th className="text-left p-3">{t('colDifficulty')}</th>
                <th className="text-left p-3">{t('colType')}</th>
                <th className="text-left p-3">{t('colGeneratedAt')}</th>
                <th className="text-right p-3">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <a
                      href={`/en/vibe-coding-recipes/${r.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-left hover:underline font-medium"
                    >
                      {r.titleEn}
                    </a>
                  </td>
                  <td className="p-3 text-muted-foreground">{r.slug}</td>
                  <td className="p-3">
                    <Badge variant="secondary" className={DIFF_COLORS[r.difficulty]}>{r.difficulty}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant="secondary">{r.type.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(r.generatedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => fetchRecipes(pagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchRecipes(pagination.page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}

    </>
  )
}

function LogsTab() {
  const t = useTranslations('vibe-coding-recipes.admin')
  const [logs, setLogs] = useState<GenerationLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 30, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/vibe-coding-recipes/logs?${params}`)
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs)
        setPagination(data.pagination)
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('logColStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="success">{t('statusSuccess')}</SelectItem>
            <SelectItem value="failed">{t('statusFailed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No logs</div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">{t('logColTime')}</th>
                <th className="text-left p-3">{t('logColSlot')}</th>
                <th className="text-left p-3">{t('logColDifficulty')}</th>
                <th className="text-left p-3">{t('logColType')}</th>
                <th className="text-left p-3">{t('logColStatus')}</th>
                <th className="text-left p-3">{t('logColTokens')}</th>
                <th className="text-left p-3">{t('logColError')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className={`border-t ${log.status === 'failed' ? 'bg-red-50 dark:bg-red-950/20' : 'hover:bg-muted/30'}`}
                >
                  <td className="p-3 text-muted-foreground">
                    {new Date(log.startedAt).toLocaleString()}
                  </td>
                  <td className="p-3">{log.slot}</td>
                  <td className="p-3">
                    <Badge variant="secondary" className={DIFF_COLORS[log.difficulty]}>{log.difficulty}</Badge>
                  </td>
                  <td className="p-3">{log.type.replace(/_/g, ' ')}</td>
                  <td className="p-3">
                    <Badge variant="secondary" className={STATUS_COLORS[log.status]}>{log.status}</Badge>
                  </td>
                  <td className="p-3">{log.tokensUsed?.toLocaleString() ?? '-'}</td>
                  <td className="p-3 text-xs max-w-xs truncate" title={log.errorMessage ?? ''}>
                    {log.errorMessage ? log.errorMessage.slice(0, 80) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => fetchLogs(pagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchLogs(pagination.page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  )
}

function GenerateModal({
  onClose,
  onGenerate,
  generating,
}: {
  onClose: () => void
  onGenerate: (difficulty: string, type: string, topic: string) => void
  generating: boolean
}) {
  const t = useTranslations('vibe-coding-recipes.admin')
  const [difficulty, setDifficulty] = useState('beginner')
  const [type, setType] = useState('plugin')
  const [topic, setTopic] = useState('')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-96">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('generateBtn')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t('selectDifficulty')}</label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t('selectType')}</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plugin">Plugin</SelectItem>
                <SelectItem value="widget">Widget</SelectItem>
                <SelectItem value="plugin_with_widget">Plugin + Widget</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t('topicLabel')}</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('topicPlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={generating}>
              {t('cancel')}
            </Button>
            <Button onClick={() => onGenerate(difficulty, type, topic)} disabled={generating} className="gap-1">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? t('generating') : t('generate')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

