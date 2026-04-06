"use client"

import { useState, useEffect, useRef } from "react"
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
  useSecret: boolean
  useFile: boolean
}

interface ExistingAttachment {
  id: number
  filename: string
  filePath: string
  fileSize: number
  mimeType: string
  downloadCount: number
}

interface AttachmentFile {
  id?: number
  filename: string
  storedName?: string
  filePath: string
  thumbnailPath?: string | null
  fileSize: number
  mimeType: string
  isNew?: boolean
}

interface Post {
  id: string
  title: string
  content: string
  isSecret: boolean
  attachments?: ExistingAttachment[]
}

// 파일 크기 포맷
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 파일 아이콘 선택
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.includes('pdf')) return '📕'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📘'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📙'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦'
  return '📄'
}

export default function BoardEditPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const postId = params.postId as string

  const [board, setBoard] = useState<Board | null>(null)
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSecret, setIsSecret] = useState(false)

  // 파일 첨부 상태
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 드래그 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/boards/${slug}/posts/${postId}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || '게시글을 불러올 수 없습니다.')
          return
        }

        setBoard(data.board)
        setPost(data.post)
        setTitle(data.post.title)
        setContent(data.post.content)
        setIsSecret(data.post.isSecret)

        // 기존 첨부파일 로드
        if (data.post.attachments && data.post.attachments.length > 0) {
          setAttachments(data.post.attachments.map((att: ExistingAttachment) => ({
            id: att.id,
            filename: att.filename,
            filePath: att.filePath,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
            isNew: false
          })))
        }
      } catch (error) {
        console.error('게시글 조회 에러:', error)
        setError('게시글을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [slug, postId])

  // 파일 업로드 핸들러
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // 최대 5개까지
    if (attachments.length + files.length > 5) {
      alert('첨부파일은 최대 5개까지 가능합니다.')
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
          setAttachments(prev => [...prev, { ...data.file, isNew: true }])
        } else {
          alert(data.error || `${file.name} 업로드에 실패했습니다.`)
        }
      }
    } catch (error) {
      console.error('파일 업로드 에러:', error)
      alert('파일 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 파일 삭제
  const handleRemoveFile = (index: number) => {
    const fileToRemove = attachments[index]

    // 기존 파일이면 삭제 목록에 추가
    if (fileToRemove.id && !fileToRemove.isNew) {
      setDeletedAttachmentIds(prev => [...prev, fileToRemove.id!])
    }

    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // 드래그 시작
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  // 드래그 오버
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  // 드래그 종료
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

  // 드래그 이탈
  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    if (!content.trim()) {
      alert('내용을 입력해주세요.')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/boards/${slug}/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          isSecret,
          attachments: attachments.filter(a => a.isNew).map(a => ({
            filename: a.filename,
            storedName: a.storedName,
            filePath: a.filePath,
            thumbnailPath: a.thumbnailPath,
            fileSize: a.fileSize,
            mimeType: a.mimeType
          })),
          deletedAttachmentIds,
          attachmentOrder: attachments.filter(a => !a.isNew && a.id).map(a => a.id)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          alert('로그인이 필요합니다.')
          router.push('/login')
          return
        }
        if (response.status === 403) {
          alert(data.error || '수정 권한이 없습니다.')
          return
        }
        alert(data.error || '수정에 실패했습니다.')
        return
      }

      // 수정 완료 후 게시글로 이동
      router.push(`/boards/${slug}/${postId}`)
    } catch (error) {
      console.error('글 수정 에러:', error)
      alert('수정 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </UserLayout>
    )
  }

  if (error || !board || !post) {
    return (
      <UserLayout>
        <div className="flex items-center justify-center py-20">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">{error || '게시글을 찾을 수 없습니다.'}</p>
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </UserLayout>
    )
  }

  return (
    <UserLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 페이지 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/boards/${slug}/${postId}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">글 수정</h1>
            <p className="text-sm text-muted-foreground">{board.name}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">
                  제목 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  내용 <span className="text-destructive">*</span>
                </Label>
                <TiptapEditor
                  content={content}
                  onChange={setContent}
                  placeholder="내용을 입력하세요..."
                />
              </div>

              {/* 파일 첨부 */}
              {board.useFile && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    파일 첨부
                    <span className="text-xs text-muted-foreground">(최대 5개, 각 10MB 이하, 드래그로 순서 변경)</span>
                  </Label>

                  {/* 파일 선택 버튼 */}
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
                      파일 선택
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {attachments.length}/5개
                    </span>
                  </div>

                  {/* 첨부된 파일 목록 */}
                  {attachments.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {attachments.map((file, index) => (
                        <div
                          key={file.id || `new-${index}`}
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
                              <p className="text-sm font-medium truncate">
                                {file.filename}
                                {file.isNew && (
                                  <span className="ml-2 text-xs text-primary">(새 파일)</span>
                                )}
                              </p>
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
                    비밀글
                  </Label>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  취소
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  수정
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  )
}
