'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { WidgetEditorProps } from './index'

export default function ButtonCtaEditor({ settings, onChange }: WidgetEditorProps) {
  const update = (key: string, value: unknown) => onChange({ ...settings, [key]: value })

  return (
    <div className="space-y-3">
      <div>
        <Label>Button text</Label>
        <Input value={(settings.text as string) ?? ''} onChange={e => update('text', e.target.value)} placeholder="Click here" />
      </div>
      <div>
        <Label>Link URL</Label>
        <Input value={(settings.href as string) ?? ''} onChange={e => update('href', e.target.value)} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Variant</Label>
          <Select value={(settings.variant as string) ?? 'default'} onValueChange={v => update('variant', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="outline">Outline</SelectItem>
              <SelectItem value="destructive">Destructive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Size</Label>
          <Select value={(settings.size as string) ?? 'default'} onValueChange={v => update('size', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small</SelectItem>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="lg">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Align</Label>
          <Select value={(settings.align as string) ?? 'center'} onValueChange={v => update('align', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
