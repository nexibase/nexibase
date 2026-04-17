'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { WidgetEditorProps } from './index'

export default function VideoEmbedEditor({ settings, onChange }: WidgetEditorProps) {
  const update = (key: string, value: unknown) => onChange({ ...settings, [key]: value })

  const autoplay = (settings.autoplay as boolean) ?? false
  const muted = autoplay || ((settings.muted as boolean) ?? false)
  const loop = (settings.loop as boolean) ?? false

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
      <div className="space-y-2 border-t pt-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(e) => update('autoplay', e.target.checked)}
            className="h-4 w-4"
          />
          Autoplay
        </label>
        <label className={`flex items-center gap-2 text-sm ${autoplay ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            checked={muted}
            disabled={autoplay}
            onChange={(e) => update('muted', e.target.checked)}
            className="h-4 w-4"
          />
          Muted
          {autoplay && (
            <span className="text-xs text-muted-foreground">(required for autoplay)</span>
          )}
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => update('loop', e.target.checked)}
            className="h-4 w-4"
          />
          Loop
        </label>
      </div>
    </div>
  )
}
