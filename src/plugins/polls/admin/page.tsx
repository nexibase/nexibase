"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  BarChart3,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Vote,
  ListChecks,
} from "lucide-react"
import PollForm from "@/plugins/polls/components/PollForm"

interface PollOption {
  id: number
  label: string
  emoji?: string
  votes: number
}

interface Poll {
  id: number
  question: string
  description?: string
  category?: string
  isMultiple: boolean
  isAI?: boolean
  status: string
  closesAt?: string
  totalVotes: number
  createdAt: string
  options: PollOption[]
}

interface Stats {
  total: number
  activeCount: number
  totalVotes: number
}

export default function PollsAdminPage() {
  const [activeMenu, setActiveMenu] = useState("polls")
  const [polls, setPolls] = useState<Poll[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, activeCount: 0, totalVotes: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null)
  const [saving, setSaving] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiTopic, setAiTopic] = useState("")
  const [aiLoading, setAiLoading] = useState(false)

  const fetchPolls = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        search,
      })
      const res = await fetch(`/api/admin/polls?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPolls(data.polls || [])
        setStats(data.stats || { total: 0, activeCount: 0, totalVotes: 0 })
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (err) {
      console.error("Failed to fetch polls:", err)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchPolls()
  }, [fetchPolls])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchPolls()
  }

  const handleCreate = async (data: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setFormOpen(false)
        fetchPolls()
      } else {
        const d = await res.json()
        alert(d.error || "Failed to create poll")
      }
    } catch (err) {
      console.error(err)
      alert("Failed to create poll")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editingPoll) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/polls/${editingPoll.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setFormOpen(false)
        setEditingPoll(null)
        fetchPolls()
      } else {
        const d = await res.json()
        alert(d.error || "Failed to update poll")
      }
    } catch (err) {
      console.error(err)
      alert("Failed to update poll")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (poll: Poll) => {
    if (!confirm(`Delete "${poll.question}"?`)) return
    try {
      const res = await fetch(`/api/admin/polls/${poll.id}`, { method: "DELETE" })
      if (res.ok) fetchPolls()
      else alert("Failed to delete poll")
    } catch (err) {
      console.error(err)
      alert("Failed to delete poll")
    }
  }

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch("/api/admin/polls/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic }),
      })
      if (res.ok) {
        setAiOpen(false)
        setAiTopic("")
        fetchPolls()
      } else {
        const d = await res.json()
        alert(d.error || "AI generation failed")
      }
    } catch (err) {
      console.error(err)
      alert("AI generation failed")
    } finally {
      setAiLoading(false)
    }
  }

  const openEdit = (poll: Poll) => {
    setEditingPoll(poll)
    setFormOpen(true)
  }

  const openCreate = () => {
    setEditingPoll(null)
    setFormOpen(true)
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/10 dark:bg-green-500/20 dark:text-green-400">Active</Badge>
      case "draft":
        return <Badge variant="secondary">Draft</Badge>
      case "closed":
        return <Badge variant="destructive">Closed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
        <main className="flex-1 lg:ml-0 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Polls
              </h1>
              <p className="text-muted-foreground mt-1">Manage community polls</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAiOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Generate
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">{stats.activeCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                    <Vote className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Votes</p>
                    <p className="text-2xl font-bold">{stats.totalVotes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search polls..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button type="submit" variant="outline">Search</Button>
              </form>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Poll List</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : polls.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No polls yet. Create one or use AI Generate.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">Question</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">Status</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">Votes</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">Options</th>
                          <th className="p-3 text-center text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {polls.map((poll) => (
                          <tr key={poll.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="p-3">
                              <div>
                                <div className="font-medium text-foreground flex items-center gap-2">
                                  {poll.question}
                                  {poll.isAI && (
                                    <Badge className="bg-violet-500/10 text-violet-600 hover:bg-violet-500/10 dark:text-violet-400 text-[10px] px-1.5 py-0">
                                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                      AI
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {poll.category && (
                                    <span className="text-xs text-muted-foreground">{poll.category}</span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(poll.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center">{statusBadge(poll.status)}</td>
                            <td className="p-3 text-center font-medium">{poll.totalVotes}</td>
                            <td className="p-3 text-center">{poll.options?.length || 0}</td>
                            <td className="p-3">
                              <div className="flex justify-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEdit(poll)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(poll)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
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

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditingPoll(null) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPoll ? "Edit Poll" : "Create Poll"}</DialogTitle>
          </DialogHeader>
          <PollForm
            initial={editingPoll ? {
              question: editingPoll.question,
              description: editingPoll.description || "",
              category: editingPoll.category || "",
              status: editingPoll.status,
              closesAt: editingPoll.closesAt || "",
              isMultiple: editingPoll.isMultiple,
              options: editingPoll.options?.map((o) => ({ label: o.label, emoji: o.emoji })),
            } : undefined}
            onSubmit={editingPoll ? handleUpdate : handleCreate}
            onCancel={() => { setFormOpen(false); setEditingPoll(null) }}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              AI Generate Poll
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Topic</label>
              <Input
                placeholder="e.g., favorite programming language, weekend activities..."
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
              <Button onClick={handleAiGenerate} disabled={!aiTopic.trim() || aiLoading}>
                {aiLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Sparkles className="h-4 w-4 mr-1" />
                Generate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
