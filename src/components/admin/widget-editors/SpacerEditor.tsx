'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WidgetEditorProps } from './index'

export default function SpacerEditor({ settings, onChange }: WidgetEditorProps) {
  return (
    <div>
      <Label>Height (px)</Label>
      <Input
        type="number"
        min={0}
        max={500}
        value={(settings.height as number) ?? 40}
        onChange={e => onChange({ ...settings, height: parseInt(e.target.value) || 40 })}
      />
    </div>
  )
}
