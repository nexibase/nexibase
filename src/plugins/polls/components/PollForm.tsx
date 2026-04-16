"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Trash2 } from "lucide-react"

interface PollOption {
  label: string
  emoji: string
}

interface PollFormData {
  question: string
  description: string
  category: string
  status: string
  closesAt: string
  isMultiple: boolean
  options: PollOption[]
}

interface PollFormProps {
  initial?: Partial<PollFormData & { options: Array<{ label: string; emoji?: string }> }>
  onSubmit: (data: PollFormData) => Promise<void>
  onCancel: () => void
  saving: boolean
}

export default function PollForm({ initial, onSubmit, onCancel, saving }: PollFormProps) {
  const [form, setForm] = useState<PollFormData>({
    question: "",
    description: "",
    category: "",
    status: "active",
    closesAt: "",
    isMultiple: false,
    options: [
      { label: "", emoji: "" },
      { label: "", emoji: "" },
    ],
  })

  useEffect(() => {
    if (initial) {
      setForm({
        question: initial.question || "",
        description: initial.description || "",
        category: initial.category || "",
        status: initial.status || "active",
        closesAt: initial.closesAt ? initial.closesAt.slice(0, 16) : "",
        isMultiple: initial.isMultiple || false,
        options:
          initial.options && initial.options.length >= 2
            ? initial.options.map((o) => ({ label: o.label || "", emoji: o.emoji || "" }))
            : [
                { label: "", emoji: "" },
                { label: "", emoji: "" },
              ],
      })
    }
  }, [initial])

  const updateOption = (index: number, field: keyof PollOption, value: string) => {
    const updated = [...form.options]
    updated[index] = { ...updated[index], [field]: value }
    setForm({ ...form, options: updated })
  }

  const addOption = () => {
    setForm({ ...form, options: [...form.options, { label: "", emoji: "" }] })
  }

  const removeOption = (index: number) => {
    if (form.options.length <= 2) return
    setForm({ ...form, options: form.options.filter((_, i) => i !== index) })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="question">
          Question <span className="text-red-500">*</span>
        </Label>
        <Input
          id="question"
          placeholder="What do you want to ask?"
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={2}
          placeholder="Optional description..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">None</option>
            <option value="tech">Tech</option>
            <option value="lifestyle">Lifestyle</option>
            <option value="opinion">Opinion</option>
            <option value="fun">Fun</option>
            <option value="community">Community</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="closesAt">Closes at</Label>
          <Input
            id="closesAt"
            type="datetime-local"
            value={form.closesAt}
            onChange={(e) => setForm({ ...form, closesAt: e.target.value })}
          />
        </div>

        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isMultiple}
              onChange={(e) => setForm({ ...form, isMultiple: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Allow multiple selections</span>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <Label>
          Options <span className="text-red-500">*</span>
        </Label>
        {form.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="Emoji"
              value={opt.emoji}
              onChange={(e) => updateOption(i, "emoji", e.target.value)}
              className="w-16 text-center"
            />
            <Input
              placeholder={`Option ${i + 1}`}
              value={opt.label}
              onChange={(e) => updateOption(i, "label", e.target.value)}
              className="flex-1"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeOption(i)}
              disabled={form.options.length <= 2}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addOption}>
          <Plus className="h-4 w-4 mr-1" />
          Add option
        </Button>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initial ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  )
}
