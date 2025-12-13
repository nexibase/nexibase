"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { ImageResize } from 'tiptap-extension-resize-image'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  Heading1,
  Heading2,
  Heading3,
  Upload,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TiptapEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
}

export function TiptapEditor({
  content,
  onChange,
  placeholder = '내용을 입력하세요...',
  className
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline'
        }
      }),
      ImageResize.configure({
        HTMLAttributes: {
          class: 'rounded-lg'
        }
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[300px] px-4 py-3'
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    }
  })

  // content가 외부에서 변경되면 에디터 업데이트
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  const setLink = useCallback(() => {
    if (!editor) return

    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL을 입력하세요:', previousUrl)

    if (url === null) return

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const addImageByUrl = useCallback(() => {
    if (!editor) return

    const url = window.prompt('이미지 URL을 입력하세요:')

    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  // 파일 업로드 관련
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor) return
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.')
      return
    }

    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/tiptap-image-upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok && data.url) {
        editor.chain().focus().setImage({ src: data.url }).run()
      } else {
        alert(data.error || '이미지 업로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 업로드 에러:', error)
      alert('이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      // input 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [editor])

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  if (!editor) {
    return null
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden bg-background', className)}>
      {/* 툴바 */}
      <div className="border-b bg-muted/30 p-2 flex flex-wrap gap-1">
        {/* 텍스트 스타일 */}
        <div className="flex gap-0.5 border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="굵게"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="기울임"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="밑줄"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="취소선"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            title="인라인 코드"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* 헤딩 */}
        <div className="flex gap-0.5 border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title="제목 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="제목 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="제목 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* 리스트 */}
        <div className="flex gap-0.5 border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="글머리 기호"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="번호 목록"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="인용"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* 삽입 */}
        <div className="flex gap-0.5 border-r pr-2 mr-2">
          <ToolbarButton
            onClick={setLink}
            isActive={editor.isActive('link')}
            title="링크"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={triggerFileUpload}
            disabled={uploading}
            title="이미지 업로드"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </ToolbarButton>
          <ToolbarButton
            onClick={addImageByUrl}
            title="이미지 URL"
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="구분선"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* 실행 취소/다시 실행 */}
        <div className="flex gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="실행 취소"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="다시 실행"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* 에디터 영역 */}
      <EditorContent editor={editor} />
    </div>
  )
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title?: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-8 w-8 p-0',
        isActive && 'bg-muted'
      )}
    >
      {children}
    </Button>
  )
}
