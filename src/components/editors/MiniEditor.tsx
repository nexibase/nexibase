"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MiniEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
}

export function MiniEditor({
  content,
  onChange,
  placeholder = '댓글을 입력하세요...',
  className,
}: MiniEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[72px] max-h-[200px] overflow-y-auto px-3 py-2 text-sm',
      },
    },
  })

  useEffect(() => {
    if (editor && content === '') {
      editor.commands.clearContent()
    }
  }, [content, editor])

  if (!editor) return null

  const toggleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('URL을 입력하세요')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const ToolButton = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "p-1 rounded hover:bg-muted transition-colors",
        active && "bg-muted text-primary"
      )}
    >
      {children}
    </button>
  )

  return (
    <div className={cn("border rounded-md bg-background", className)}>
      <div className="flex items-center gap-0.5 px-2 py-1 border-b">
        <ToolButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolButton active={editor.isActive('link')} onClick={toggleLink}>
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
