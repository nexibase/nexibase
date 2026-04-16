'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import type { WidgetEditorProps } from './index'

export default function RichTextEditor({ settings, onChange }: WidgetEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      Underline,
      Placeholder.configure({ placeholder: 'Start writing...' }),
    ],
    content: (settings.html as string) ?? '',
    onUpdate: ({ editor: e }) => {
      onChange({ ...settings, html: e.getHTML() })
    },
  })

  if (!editor) return null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 border-b pb-2">
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('bold') ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('italic') ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('underline') ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('heading', { level: 3 }) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('bulletList') ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>List</button>
        <button type="button" className="px-2 py-1 text-xs rounded bg-muted" onClick={() => {
          const url = window.prompt('Link URL')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}>Link</button>
        <button type="button" className="px-2 py-1 text-xs rounded bg-muted" onClick={async () => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) return
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch('/api/tiptap-image-upload', { method: 'POST', body: formData })
            if (res.ok) {
              const data = await res.json()
              editor.chain().focus().setImage({ src: data.url }).run()
            }
          }
          input.click()
        }}>Img</button>
      </div>
      <EditorContent editor={editor} className="prose prose-sm max-w-none min-h-[120px] border rounded p-2" />
    </div>
  )
}
