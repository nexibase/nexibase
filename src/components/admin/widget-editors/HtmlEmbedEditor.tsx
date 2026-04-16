'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { WidgetEditorProps } from './index'

export default function HtmlEmbedEditor({ settings, onChange }: WidgetEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const code = (settings.code as string) ?? ''

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <Label>HTML Code</Label>
          <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
        </div>
        {showPreview ? (
          <div className="mt-1 border rounded p-3 min-h-[120px]" dangerouslySetInnerHTML={{ __html: code }} />
        ) : (
          <textarea
            className="mt-1 w-full min-h-[120px] border rounded p-2 font-mono text-sm bg-muted/30"
            value={code}
            onChange={e => onChange({ ...settings, code: e.target.value })}
            placeholder="<div>Your HTML here...</div>"
          />
        )}
      </div>
    </div>
  )
}
