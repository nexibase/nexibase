"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Upload, X } from "lucide-react"
import { UserLayout } from "@/components/layout/UserLayout"

export default function AuctionCreatePage() {
  const router = useRouter()
  const MAX_IMAGES = 5

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  const [form, setForm] = useState({
    title: "",
    description: "",
    images: [] as string[],
    startingPrice: "",
    buyNowPrice: "",
    bidIncrement: "1000",
    startsAt: "",
    endsAt: "",
    requiresShipping: true,
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const remaining = MAX_IMAGES - form.images.length
    const toUpload = files.slice(0, remaining)

    for (const file of toUpload) {
      const formData = new FormData()
      formData.append("file", file)

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()
        if (res.ok) {
          setForm((prev) => ({ ...prev, images: [...prev.images, data.url] }))
          setImagePreviews((prev) => [...prev, data.url])
        } else {
          setError(data.error || `이미지 업로드 실패 (${res.status})`)
        }
      } catch {
        setError("이미지 업로드 중 네트워크 오류가 발생했습니다.")
      }
    }

    // reset input so same file can be re-selected
    e.target.value = ""
  }

  const handleRemoveImage = (index: number) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (res.ok) {
        router.push(`/auction/${data.auction.id}`)
      } else {
        setError(data.error || "경매 등록에 실패했습니다.")
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <UserLayout>
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> 돌아가기
      </button>

      <h1 className="text-2xl font-bold mb-6">경매 등록</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateForm("title", e.target.value)}
            required
            maxLength={255}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            placeholder="경매 상품명을 입력하세요"
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            상세 설명 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
            required
            rows={5}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm resize-y"
            placeholder="상품에 대한 상세 설명을 입력하세요"
          />
        </div>

        {/* 이미지 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            이미지 <span className="text-muted-foreground text-xs">(최대 {MAX_IMAGES}장)</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative">
                <img
                  src={src}
                  alt={`미리보기 ${i + 1}`}
                  className="w-24 h-24 object-cover rounded-md border border-border"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(i)}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {imagePreviews.length < MAX_IMAGES && (
              <label className="flex items-center justify-center w-24 h-24 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary">
                <div className="text-center">
                  <Upload className="w-5 h-5 mx-auto text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    업로드
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* 가격 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              시작가 (원) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.startingPrice}
              onChange={(e) => updateForm("startingPrice", e.target.value)}
              required
              min={1000}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              placeholder="10000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              즉시구매가 (원, 선택)
            </label>
            <input
              type="number"
              value={form.buyNowPrice}
              onChange={(e) => updateForm("buyNowPrice", e.target.value)}
              min={1}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              placeholder="비워두면 즉시구매 불가"
            />
          </div>
        </div>

        {/* 입찰 단위 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            최소 입찰 단위 (원)
          </label>
          <input
            type="number"
            value={form.bidIncrement}
            onChange={(e) => updateForm("bidIncrement", e.target.value)}
            min={100}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
          />
        </div>

        {/* 배송 옵션 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="requiresShipping"
            checked={form.requiresShipping}
            onChange={(e) => setForm((prev) => ({ ...prev, requiresShipping: e.target.checked }))}
            className="w-4 h-4 rounded border-border"
          />
          <label htmlFor="requiresShipping" className="text-sm">
            배송이 필요한 상품 <span className="text-muted-foreground">(체크 해제 시 디지털/무형 상품)</span>
          </label>
        </div>

        {/* 시간 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              시작 시간 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => updateForm("startsAt", e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              종료 시간 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => updateForm("endsAt", e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "등록 중..." : "경매 등록"}
        </button>
      </form>
    </div>
    </UserLayout>
  )
}
