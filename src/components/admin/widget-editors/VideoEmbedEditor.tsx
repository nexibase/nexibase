'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { WidgetEditorProps } from './index'

export default function VideoEmbedEditor({ settings, onChange }: WidgetEditorProps) {
  const update = (key: string, value: unknown) => onChange({ ...settings, [key]: value })

  return (
    <div className="space-y-3">
      <div>
        <Label>Video URL</Label>
        <Input
          value={(settings.url as string) ?? ''}
          onChange={e => update('url', e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <p className="mt-1 text-xs text-muted-foreground">Supports YouTube and Vimeo URLs</p>
      </div>
      <div>
        <Label>Aspect Ratio</Label>
        <Select value={(settings.aspectRatio as string) ?? '16:9'} onValueChange={v => update('aspectRatio', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
            <SelectItem value="4:3">4:3 (Standard)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
