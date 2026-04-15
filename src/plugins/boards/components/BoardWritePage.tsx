"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { UserLayout } from "@/components/layout/UserLayout"
import { TiptapEditor } from "@/components/editors/TiptapEditor"
import {
  Loader2,
  ArrowLeft,
  Lock,
  Paperclip,
  X,
  Upload,
  GripVertical,
} from "lucide-react"

interface Board {
  id: string
  slug: string
  name: string
  writeMemberOnly: boolean
  useSecret: boolean
  useFile: boolean
}

interface User {
  id: string
  name: string
}

interface AttachmentFile {
  filename: string
  storedName: string
  filePath: string
  thumbnailPath?: string | null
  fileSize: number
  mimeType: string
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Pick file icon
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.includes('pdf')) return '📕'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📘'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📙'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦'
  return '📄'
}

export default function BoardWritePage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const t = useTranslations('boards')

  const [user, setUser] = useState<User | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSecret, setIsSecret] = useState(false)

  // File attachment state
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Login check — writing is member-only
  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/me')
      const data = await response.json()
      if (data.user) {
        setUser(data.user)
      } else {
        // Redirect to the login page when unauthenticated
        alert(t('errors.loginRequiredDot'))
        router.push(`/login?callbackUrl=/boards/${slug}/create`)
        return
      }
    } catch (err) {
      console.error('session check error:', err)
      alert(t('errors.loginRequiredDot'))
      router.push(`/login?callbackUrl=/boards/${slug}/create`)
      return
    } finally {
      setSessionChecked(true)
    }
  }, [router, slug, t])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    // Load the board after the login check
    if (!sessionChecked || !user) return

    const fetchBoard = async () => {
      try {
        const response = await fetch(`/api/boards/${slug}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || t('loadFailed'))
          return
        }

        setBoard(data.board)
      } catch (err) {
        console.error('failed to fetch board:', err)
        setError(t('loadError'))
      } finally {
        setLoading(false)
      }
    }

    fetchBoard()
  }, [slug, sessionChecked, user, t])

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Up to 5 items
    if (attachments.length + files.length > 5) {
      alert(t('post.maxAttachments'))
      return
    }

    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('boardSlug', slug)

        const response = await fetch('/api/attachments', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (response.ok && data.file) {
          setAttachments(prev => [...prev, data.file])
        } else {
          alert(data.error || t('post.uploadFailed', { name: file.name }))
        }
      }
    } catch (error) {
      console.error('file upload error:', error)
      alert(t('post.uploadError'))
    } finally {
      setUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Delete file
  const handleRemoveFile = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Drag start
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  // Drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  // Drag end
  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newAttachments = [...attachments]
      const [draggedItem] = newAttachments.splice(draggedIndex, 1)
      newAttachments.splice(dragOverIndex, 0, draggedItem)
      setAttachments(newAttachments)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // Drag leave
  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      alert(t('post.titleRequired'))
      return
    }

    if (!content.trim()) {
      alert(t('post.contentRequired'))
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/boards/${slug}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          isSecret,
          attachments // 첨부파일 정보 포함
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          alert(t('errors.loginRequiredDot'))
          router.push('/login')
          return
        }
        if (response.status === 403) {
          alert(data.error || t('post.writePermDenied'))
          return
        }
        alert(data.error || t('post.writeFailed'))
        return
      }

      // After creation, navigate to the post
      router.push(`/boards/${slug}/${data.post.id}`)
    } catch (error) {
      console.error('failed to create post:', error)
      alert(t('post.writeError'))
    } finally {
      setSubmitting(false)
    }
  }

  // Show loading while the session is being checked or while redirecting unauthenticated users
  if (!sessionChecked || !user || loading) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </UserLayout>
    )
  }

  if (error || !board) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center py-20">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">{error || t('boardNotFound')}</p>
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('post.goBack')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </UserLayout>
    )
  }

  return (
    <UserLayout>
      <div className="max-w-4xl mx-auto sm:px-4 py-2 sm:py-6">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/boards/${slug}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{t('post.writeTitle')}</h1>
            <p className="text-sm text-muted-foreground">{board.name}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">
                  {t('post.title')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder={t('post.titlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {t('post.content')} <span className="text-destructive">*</span>
                </Label>
                <TiptapEditor
                  content={content}
                  onChange={setContent}
                  placeholder={t('post.contentPlaceholder')}
                />
              </div>

              {/* File attachment */}
              {board.useFile && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    {t('post.fileAttach')}
                    <span className="text-xs text-muted-foreground">{t('post.fileAttachDesc')}</span>
                  </Label>

                  {/* File picker button */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv,.zip,.rar,.7z,.jpg,.jpeg,.png,.gif,.webp,.bmp,.hwp,.hwpx"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || attachments.length >= 5}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {t('post.fileSelect')}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {t('post.filesCount', { count: attachments.length })}
                    </span>
                  </div>

                  {/* Attached file list */}
                  {attachments.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          onDragLeave={handleDragLeave}
                          className={`flex items-center justify-between px-3 py-2 cursor-move transition-colors ${
                            draggedIndex === index ? 'opacity-50 bg-muted' : ''
                          } ${
                            dragOverIndex === index ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                            {file.mimeType.startsWith('image/') ? (
                              <div className="w-10 h-10 shrink-0 rounded overflow-hidden bg-muted">
                                <img
                                  src={file.filePath}
                                  alt={file.filename}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <span className="text-lg">{getFileIcon(file.mimeType)}</span>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{file.filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.fileSize)}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(index)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {board.useSecret && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isSecret"
                    checked={isSecret}
                    onCheckedChange={(checked) => setIsSecret(checked === true)}
                  />
                  <Label htmlFor="isSecret" className="flex items-center gap-1 cursor-pointer">
                    <Lock className="h-4 w-4" />
                    {t('post.secret')}
                  </Label>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  {t('post.cancel')}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('post.publish')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  )
}
