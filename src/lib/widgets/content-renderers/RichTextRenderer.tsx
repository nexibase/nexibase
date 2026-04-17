'use client'

export default function RichTextRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const html = (settings?.html as string) ?? ''
  if (!html) return null
  return (
    <div
      className="tiptap prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
