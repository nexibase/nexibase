"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
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
  Code2,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
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
  placeholder,
  className
}: TiptapEditorProps) {
  const t = useTranslations('editor')
  const effectivePlaceholder = placeholder ?? t('placeholder')
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
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg cursor-pointer'
        },
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: effectivePlaceholder
      })
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap prose dark:prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[240px] px-4 py-3'
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    }
  })

  // Sync the editor when content is changed from outside
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  const setLink = useCallback(() => {
    if (!editor) return

    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt(t('linkPlaceholder'), previousUrl)

    if (url === null) return

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const addImageByUrl = useCallback(() => {
    if (!editor) return

    const url = window.prompt(t('imageUrlPlaceholder'))

    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // HTML source view mode
  const [sourceMode, setSourceMode] = useState(false)
  const [sourceContent, setSourceContent] = useState('')

  const toggleSourceMode = useCallback(() => {
    if (sourceMode) {
      // Source → editor: apply the edited HTML
      if (editor) {
        editor.commands.setContent(sourceContent)
        onChange(sourceContent)
      }
    } else {
      // Editor → source: capture the current HTML
      if (editor) {
        setSourceContent(editor.getHTML())
      }
    }
    setSourceMode(!sourceMode)
  }, [sourceMode, sourceContent, editor, onChange])

  const handleSourceChange = useCallback((value: string) => {
    setSourceContent(value)
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor) return
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert(t('imageOnly'))
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert(t('fileTooLarge'))
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
        alert(data.error || t('uploadFailed'))
      }
    } catch (error) {
      console.error('image upload failed:', error)
      alert(t('uploadFailed'))
    } finally {
      setUploading(false)
      // Reset the input
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
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-1.5 sm:p-2 flex overflow-x-auto gap-1 scrollbar-none">
        {/* Text styles */}
        <div className="flex gap-0.5 border-r pr-2 mr-2 shrink-0">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title={t('bold')}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title={t('italic')}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title={t('underline')}
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title={t('strike')}
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            title={t('code')}
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Headings */}
        <div className="flex gap-0.5 border-r pr-2 mr-2 shrink-0">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title={t('heading1')}
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title={t('heading2')}
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title={t('heading3')}
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Lists */}
        <div className="flex gap-0.5 border-r pr-2 mr-2 shrink-0">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title={t('bulletList')}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title={t('orderedList')}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title={t('blockquote')}
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Insert */}
        <div className="flex gap-0.5 border-r pr-2 mr-2 shrink-0">
          <ToolbarButton
            onClick={setLink}
            isActive={editor.isActive('link')}
            title={t('link')}
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={triggerFileUpload}
            disabled={uploading}
            title={t('imageUpload')}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </ToolbarButton>
          <ToolbarButton
            onClick={addImageByUrl}
            title={t('imageUrl')}
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title={t('horizontalRule')}
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Undo / redo */}
        <div className="flex gap-0.5 border-r pr-2 mr-2 shrink-0">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo() || sourceMode}
            title={t('undo')}
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo() || sourceMode}
            title={t('redo')}
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* HTML source view */}
        <div className="flex gap-0.5 shrink-0">
          <ToolbarButton
            onClick={toggleSourceMode}
            isActive={sourceMode}
            title={t('sourceMode')}
          >
            <Code2 className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor area */}
      {sourceMode ? (
        <Textarea
          value={sourceContent}
          onChange={(e) => handleSourceChange(e.target.value)}
          className="min-h-[300px] font-mono text-sm border-0 rounded-none focus-visible:ring-0 resize-none"
          placeholder={t('placeholder')}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
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
