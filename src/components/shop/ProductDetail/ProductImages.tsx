"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ProductImagesProps {
  images: string[]
  productName: string
  isSoldOut: boolean
  price: number
  originPrice: number | null
}

// 원본 URL에서 썸네일 URL 생성 (xxx.webp -> xxx-thumb.webp)
export const getThumbnailUrl = (url: string) => {
  return url.replace(/(\.(webp|gif))$/i, '-thumb.webp')
}

const VISIBLE_THUMBS = 5 // 한 번에 보이는 썸네일 개수

export function ProductImages({
  images,
  productName,
  isSoldOut,
  price,
  originPrice,
}: ProductImagesProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [thumbStartIndex, setThumbStartIndex] = useState(0)
  const [isZooming, setIsZooming] = useState(false)
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 })

  const discountPercent = originPrice && originPrice > price
    ? Math.round((1 - price / originPrice) * 100)
    : null

  return (
    <div className="flex gap-3">
      {/* 썸네일 세로 배열 (최대 5개 표시 + 화살표) */}
      {images.length > 1 && (
        <div className="flex flex-col items-center gap-1 w-16 flex-shrink-0">
          {/* 위 화살표 */}
          {images.length > VISIBLE_THUMBS && (
            <button
              onClick={() => setThumbStartIndex(Math.max(0, thumbStartIndex - 1))}
              disabled={thumbStartIndex === 0}
              className={`w-14 h-6 flex items-center justify-center rounded border transition-all ${
                thumbStartIndex === 0
                  ? "border-muted text-muted-foreground/30 cursor-not-allowed"
                  : "border-muted hover:border-primary hover:text-primary"
              }`}
            >
              <ChevronLeft className="h-4 w-4 rotate-90" />
            </button>
          )}

          {/* 썸네일 목록 */}
          <div className="flex flex-col gap-2">
            {images
              .slice(thumbStartIndex, thumbStartIndex + VISIBLE_THUMBS)
              .map((img, idx) => {
                const actualIdx = thumbStartIndex + idx
                return (
                  <button
                    key={actualIdx}
                    onMouseEnter={() => setSelectedImageIndex(actualIdx)}
                    onClick={() => setSelectedImageIndex(actualIdx)}
                    className={`w-14 h-14 rounded border-2 overflow-hidden transition-all ${
                      actualIdx === selectedImageIndex
                        ? "border-primary ring-1 ring-primary"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <img src={getThumbnailUrl(img)} alt="" className="w-full h-full object-cover" />
                  </button>
                )
              })}
          </div>

          {/* 아래 화살표 */}
          {images.length > VISIBLE_THUMBS && (
            <button
              onClick={() => setThumbStartIndex(Math.min(images.length - VISIBLE_THUMBS, thumbStartIndex + 1))}
              disabled={thumbStartIndex >= images.length - VISIBLE_THUMBS}
              className={`w-14 h-6 flex items-center justify-center rounded border transition-all ${
                thumbStartIndex >= images.length - VISIBLE_THUMBS
                  ? "border-muted text-muted-foreground/30 cursor-not-allowed"
                  : "border-muted hover:border-primary hover:text-primary"
              }`}
            >
              <ChevronRight className="h-4 w-4 rotate-90" />
            </button>
          )}
        </div>
      )}

      {/* 메인 이미지 */}
      <div className="flex-1 relative">
        <div
          className="relative aspect-square bg-muted rounded-lg overflow-hidden cursor-crosshair"
          onMouseEnter={() => images.length > 0 && setIsZooming(true)}
          onMouseLeave={() => setIsZooming(false)}
          onMouseMove={(e) => {
            if (images.length === 0) return
            const rect = e.currentTarget.getBoundingClientRect()
            const x = ((e.clientX - rect.left) / rect.width) * 100
            const y = ((e.clientY - rect.top) / rect.height) * 100
            setZoomPosition({ x, y })
          }}
        >
          {images.length > 0 ? (
            <img
              src={images[selectedImageIndex]}
              alt={productName}
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-20 w-20 text-muted-foreground" />
            </div>
          )}
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-bold text-2xl">품절</span>
            </div>
          )}
          {discountPercent && (
            <Badge className="absolute top-3 left-3 bg-red-500 text-sm px-2 py-0.5">
              {discountPercent}% OFF
            </Badge>
          )}

          {/* 줌 영역 표시 (마우스 위치) */}
          {isZooming && images.length > 0 && (
            <div
              className="absolute w-24 h-24 border-2 border-primary/50 bg-primary/10 pointer-events-none hidden lg:block"
              style={{
                left: `${Math.min(Math.max(zoomPosition.x - 12, 0), 76)}%`,
                top: `${Math.min(Math.max(zoomPosition.y - 12, 0), 76)}%`,
              }}
            />
          )}
        </div>

        {/* 줌 미리보기 (데스크톱만) */}
        {isZooming && images.length > 0 && (
          <div
            className="absolute left-full top-0 ml-4 w-[400px] h-[400px] border rounded-lg bg-white shadow-xl overflow-hidden z-50 hidden lg:block"
          >
            <div
              className="w-[1200px] h-[1200px]"
              style={{
                backgroundImage: `url(${images[selectedImageIndex]})`,
                backgroundSize: '1200px 1200px',
                backgroundPosition: `${-zoomPosition.x * 12 + 200}px ${-zoomPosition.y * 12 + 200}px`,
                backgroundRepeat: 'no-repeat',
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
