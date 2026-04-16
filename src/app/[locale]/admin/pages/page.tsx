"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"

interface PageItem {
  id: number
  title: string
  slug: string
  layoutTemplate: string
  isActive: boolean
  sortOrder: number
  _count: { widgets: number }
}

const TEMPLATES = [
  { value: "full-width", label: "Full Width" },
  { value: "with-sidebar", label: "With Sidebar" },
  { value: "minimal", label: "Minimal" },
]

export default function AdminPagesPage() {
  const router = useRouter()

  const [pages, setPages] = useState<PageItem[]>([])
  const [loading, setLoading] = useState(true)

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState("")
  const [createSlug, setCreateSlug] = useState("")
  const [createTemplate, setCreateTemplate] = useState("full-width")
  const [createError, setCreateError] = useState("")
  const [creating, setCreating] = useState(false)

  const fetchPages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/pages")
      if (res.ok) {
        const data = await res.json()
        setPages(data.pages || [])
      }
    } catch (err) {
      console.error("Failed to fetch pages:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPages()
  }, [fetchPages])

  const handleToggleActive = async (page: PageItem) => {
    try {
      await fetch(`/api/admin/pages/${page.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !page.isActive }),
      })
      setPages((prev) =>
        prev.map((p) => (p.id === page.id ? { ...p, isActive: !p.isActive } : p))
      )
    } catch (err) {
      console.error("Failed to toggle active:", err)
    }
  }

  const handleDelete = async (page: PageItem) => {
    if (!confirm(`Delete page "${page.title}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/admin/pages/${page.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to delete page.")
        return
      }
      await fetchPages()
    } catch (err) {
      console.error("Failed to delete page:", err)
    }
  }

  const openCreateModal = () => {
    setCreateTitle("")
    setCreateSlug("")
    setCreateTemplate("full-width")
    setCreateError("")
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!createTitle.trim()) {
      setCreateError("Title is required.")
      return
    }
    if (!createSlug.trim() && createSlug !== "") {
      setCreateError("Slug is required.")
      return
    }
    setCreating(true)
    setCreateError("")
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          slug: createSlug.trim(),
          layoutTemplate: createTemplate,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setCreateError(data.error || "Failed to create page.")
        return
      }
      setCreateOpen(false)
      await fetchPages()
    } catch (err) {
      console.error("Failed to create page:", err)
      setCreateError("An unexpected error occurred.")
    } finally {
      setCreating(false)
    }
  }

  const isHome = (page: PageItem) => page.slug === ""

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Pages</h1>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-1" />
              New Page
            </Button>
          </div>

          {/* Content */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">All Pages</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pages.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No pages yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead className="text-center">Widgets</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map((page) => (
                      <TableRow key={page.id}>
                        <TableCell className="font-medium">
                          {isHome(page) ? (
                            <span>🏠 {page.title}</span>
                          ) : (
                            page.title
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {isHome(page) ? "/" : `/${page.slug}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {TEMPLATES.find((t) => t.value === page.layoutTemplate)?.label ??
                              page.layoutTemplate}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {page._count.widgets}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={page.isActive}
                            onCheckedChange={() => handleToggleActive(page)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin/pages/${page.id}`)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={isHome(page)}
                              onClick={() => handleDelete(page)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Page Modal */}
      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="page-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="page-title"
                placeholder="About Us"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-slug">
                Slug <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">/</span>
                <Input
                  id="page-slug"
                  placeholder="about-us"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                />
              </div>
              {createSlug && (
                <p className="text-xs text-muted-foreground">
                  URL preview: <span className="font-mono">/{createSlug}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-template">Layout Template</Label>
              <Select value={createTemplate} onValueChange={setCreateTemplate}>
                <SelectTrigger id="page-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Page"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
