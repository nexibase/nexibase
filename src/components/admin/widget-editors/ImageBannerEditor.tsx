'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { WidgetEditorProps } from './index'

export default function ImageBannerEditor({ settings, onChange }: WidgetEditorProps) {
  const update = (key: string, value: unknown) => onChange({ ...settings, [key]: value })

  async function handleUpload() {
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
        update('src', data.url)
      }
    }
    input.click()
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Image</Label>
        {settings.src ? (
          <div className="mt-1 space-y-2">
            <img src={settings.src as string} alt="" className="max-h-32 rounded border object-cover" />
            <Button variant="outline" size="sm" onClick={handleUpload}>Change image</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="mt-1" onClick={handleUpload}>Upload image</Button>
        )}
      </div>
      <div>
        <Label>Alt text</Label>
        <Input value={(settings.alt as string) ?? ''} onChange={e => update('alt', e.target.value)} />
      </div>
      <div>
        <Label>Link URL (optional)</Label>
        <Input value={(settings.href as string) ?? ''} onChange={e => update('href', e.target.value)} placeholder="https://..." />
      </div>
      <div>
        <Label>Height (px)</Label>
        <Input type="number" value={(settings.height as number) ?? 300} onChange={e => update('height', parseInt(e.target.value) || 300)} />
      </div>
    </div>
  )
}
