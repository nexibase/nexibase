"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header, Footer } from "@/themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  ShoppingCart,
  ChevronLeft,
  Package,
  Minus,
  Plus,
  Check,
  AlertCircle,
} from "lucide-react"

interface ProductOption {
  id: number
  option1: string | null
  option2: string | null
  option3: string | null
  price: number
  stock: number
  sku: string | null
}

interface Product {
  id: number
  name: string
  slug: string
  description: string | null
  content: string | null
  price: number
  originPrice: number | null
  images: string[]
  category: { id: number; name: string; slug: string } | null
  isSoldOut: boolean
  viewCount: number
  soldCount: number
  hasOptions: boolean
  options: ProductOption[]
  optionValues: {
    option1: string[]
    option2: string[]
    option3: string[]
  }
  optionName1: string | null
  optionName2: string | null
  optionName3: string | null
}

interface CartItem {
  productId: number
  productName: string
  productSlug: string
  productImage: string | null
  optionId: number | null
  optionText: string
  price: number
  quantity: number
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 옵션 선택 상태
  const [selectedOption1, setSelectedOption1] = useState<string>("")
  const [selectedOption2, setSelectedOption2] = useState<string>("")
  const [selectedOption3, setSelectedOption3] = useState<string>("")
  const [quantity, setQuantity] = useState(1)

  // 이미지 갤러리
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // 장바구니 추가 상태
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartMessage, setCartMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchProduct()
  }, [slug])

  const fetchProduct = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/shop/products/${slug}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError("상품을 찾을 수 없습니다.")
        } else {
          setError("상품을 불러오는데 실패했습니다.")
        }
        return
      }
      const data = await res.json()
      setProduct(data.product)
    } catch (err) {
      setError("상품을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  // 2단계 옵션 목록 (1단계 선택에 따라 필터링)
  const availableOption2Values = useMemo(() => {
    if (!product || !selectedOption1) return []
    const values = new Set<string>()
    product.options.forEach(opt => {
      if (opt.option1 === selectedOption1 && opt.option2) {
        values.add(opt.option2)
      }
    })
    return Array.from(values)
  }, [product, selectedOption1])

  // 3단계 옵션 목록 (1,2단계 선택에 따라 필터링)
  const availableOption3Values = useMemo(() => {
    if (!product || !selectedOption1 || !selectedOption2) return []
    const values = new Set<string>()
    product.options.forEach(opt => {
      if (opt.option1 === selectedOption1 && opt.option2 === selectedOption2 && opt.option3) {
        values.add(opt.option3)
      }
    })
    return Array.from(values)
  }, [product, selectedOption1, selectedOption2])

  // 선택된 옵션 찾기
  const selectedOption = useMemo(() => {
    if (!product) return null

    // 옵션이 없는 경우
    if (!product.hasOptions || product.options.length === 0) {
      return null
    }

    // 옵션이 있는 경우 - 모든 필요한 옵션이 선택되었는지 확인
    const hasOption1 = product.optionValues.option1.length > 0
    const hasOption2 = product.optionValues.option2.length > 0
    const hasOption3 = product.optionValues.option3.length > 0

    if (hasOption1 && !selectedOption1) return null
    if (hasOption2 && !selectedOption2) return null
    if (hasOption3 && !selectedOption3) return null

    return product.options.find(opt =>
      opt.option1 === (selectedOption1 || null) &&
      opt.option2 === (selectedOption2 || null) &&
      opt.option3 === (selectedOption3 || null)
    )
  }, [product, selectedOption1, selectedOption2, selectedOption3])

  // 현재 가격
  const currentPrice = useMemo(() => {
    if (selectedOption) return selectedOption.price
    if (product) return product.price
    return 0
  }, [product, selectedOption])

  // 재고
  const currentStock = useMemo(() => {
    if (selectedOption) return selectedOption.stock
    return null
  }, [selectedOption])

  // 품절 여부
  const isOutOfStock = useMemo(() => {
    if (!product) return true
    if (product.isSoldOut) return true
    if (selectedOption && selectedOption.stock <= 0) return true
    return false
  }, [product, selectedOption])

  // 옵션 선택 완료 여부
  const isOptionSelected = useMemo(() => {
    if (!product) return false
    if (!product.hasOptions || product.options.length === 0) return true

    const hasOption1 = product.optionValues.option1.length > 0
    const hasOption2 = product.optionValues.option2.length > 0
    const hasOption3 = product.optionValues.option3.length > 0

    if (hasOption1 && !selectedOption1) return false
    if (hasOption2 && !selectedOption2) return false
    if (hasOption3 && !selectedOption3) return false

    return true
  }, [product, selectedOption1, selectedOption2, selectedOption3])

  // 옵션 1 변경 시 하위 옵션 초기화
  const handleOption1Change = (value: string) => {
    setSelectedOption1(value)
    setSelectedOption2("")
    setSelectedOption3("")
  }

  // 옵션 2 변경 시 하위 옵션 초기화
  const handleOption2Change = (value: string) => {
    setSelectedOption2(value)
    setSelectedOption3("")
  }

  // 수량 변경
  const handleQuantityChange = (delta: number) => {
    const newQty = quantity + delta
    if (newQty < 1) return
    if (currentStock !== null && newQty > currentStock) return
    setQuantity(newQty)
  }

  // 옵션 텍스트 생성
  const getOptionText = () => {
    const parts = []
    if (selectedOption1) parts.push(selectedOption1)
    if (selectedOption2) parts.push(selectedOption2)
    if (selectedOption3) parts.push(selectedOption3)
    return parts.join(" / ")
  }

  // 장바구니에 추가
  const addToCart = () => {
    if (!product) return
    if (!isOptionSelected) {
      setCartMessage("옵션을 선택해주세요.")
      setTimeout(() => setCartMessage(null), 2000)
      return
    }
    if (isOutOfStock) {
      setCartMessage("품절된 상품입니다.")
      setTimeout(() => setCartMessage(null), 2000)
      return
    }

    setAddingToCart(true)

    // 장바구니 아이템 생성
    const cartItem: CartItem = {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.images[0] || null,
      optionId: selectedOption?.id || null,
      optionText: getOptionText(),
      price: currentPrice,
      quantity: quantity,
    }

    // localStorage에서 기존 장바구니 불러오기
    const existingCart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]")

    // 같은 상품+옵션이 있으면 수량 추가, 없으면 새로 추가
    const existingIndex = existingCart.findIndex(
      item => item.productId === cartItem.productId && item.optionId === cartItem.optionId
    )

    if (existingIndex >= 0) {
      existingCart[existingIndex].quantity += cartItem.quantity
    } else {
      existingCart.push(cartItem)
    }

    // localStorage에 저장
    localStorage.setItem("cart", JSON.stringify(existingCart))

    // 장바구니 이벤트 발생 (헤더 업데이트용)
    window.dispatchEvent(new Event("cartUpdated"))

    setCartMessage("장바구니에 추가되었습니다.")
    setTimeout(() => {
      setCartMessage(null)
      setAddingToCart(false)
    }, 1500)
  }

  // 바로 구매
  const buyNow = () => {
    if (!product) return
    if (!isOptionSelected) {
      setCartMessage("옵션을 선택해주세요.")
      setTimeout(() => setCartMessage(null), 2000)
      return
    }
    if (isOutOfStock) {
      setCartMessage("품절된 상품입니다.")
      setTimeout(() => setCartMessage(null), 2000)
      return
    }

    // 장바구니에 추가 후 주문 페이지로 이동
    addToCart()
    setTimeout(() => {
      router.push("/shop/cart")
    }, 500)
  }

  const formatPrice = (price: number) => price.toLocaleString() + "원"

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">{error || "상품을 찾을 수 없습니다."}</p>
          <Button variant="outline" onClick={() => router.push("/shop")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            쇼핑몰로 돌아가기
          </Button>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* 뒤로가기 */}
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              뒤로가기
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 이미지 갤러리 */}
            <div>
              <div className="relative aspect-square bg-muted rounded-lg overflow-hidden mb-4">
                {product.images.length > 0 ? (
                  <img
                    src={product.images[selectedImageIndex]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-20 w-20 text-muted-foreground" />
                  </div>
                )}
                {product.isSoldOut && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">품절</span>
                  </div>
                )}
                {product.originPrice && product.originPrice > product.price && (
                  <Badge className="absolute top-4 left-4 bg-red-500 text-lg px-3 py-1">
                    {Math.round((1 - product.price / product.originPrice) * 100)}% OFF
                  </Badge>
                )}
              </div>

              {/* 썸네일 */}
              {product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 ${
                        idx === selectedImageIndex ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 상품 정보 */}
            <div>
              {/* 카테고리 */}
              {product.category && (
                <Link href={`/shop?category=${product.category.slug}`}>
                  <Badge variant="outline" className="mb-2">
                    {product.category.name}
                  </Badge>
                </Link>
              )}

              {/* 상품명 */}
              <h1 className="text-2xl font-bold mb-2">{product.name}</h1>

              {/* 설명 */}
              {product.description && (
                <p className="text-muted-foreground mb-4">{product.description}</p>
              )}

              {/* 가격 */}
              <div className="flex items-end gap-3 mb-6">
                <span className="text-3xl font-bold text-primary">
                  {formatPrice(currentPrice)}
                </span>
                {product.originPrice && product.originPrice > currentPrice && (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.originPrice)}
                  </span>
                )}
              </div>

              {/* 판매/조회 정보 */}
              <div className="flex gap-4 text-sm text-muted-foreground mb-6">
                <span>판매 {product.soldCount}개</span>
                <span>조회 {product.viewCount}</span>
              </div>

              {/* 옵션 선택 */}
              {product.hasOptions && product.options.length > 0 && (
                <Card className="mb-6">
                  <CardContent className="p-4 space-y-4">
                    {/* 1단계 옵션 */}
                    {product.optionValues.option1.length > 0 && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          {product.optionName1 || "옵션1"} 선택
                        </label>
                        <Select value={selectedOption1} onValueChange={handleOption1Change}>
                          <SelectTrigger>
                            <SelectValue placeholder={`${product.optionName1 || "옵션1"} 선택`} />
                          </SelectTrigger>
                          <SelectContent>
                            {product.optionValues.option1.map(val => (
                              <SelectItem key={val} value={val}>
                                {val}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* 2단계 옵션 */}
                    {product.optionValues.option2.length > 0 && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          {product.optionName2 || "옵션2"} 선택
                        </label>
                        <Select
                          value={selectedOption2}
                          onValueChange={handleOption2Change}
                          disabled={!selectedOption1}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={selectedOption1 ? `${product.optionName2 || "옵션2"} 선택` : `${product.optionName1 || "옵션1"}을 먼저 선택해주세요`} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableOption2Values.map(val => (
                              <SelectItem key={val} value={val}>
                                {val}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* 3단계 옵션 */}
                    {product.optionValues.option3.length > 0 && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          {product.optionName3 || "옵션3"} 선택
                        </label>
                        <Select
                          value={selectedOption3}
                          onValueChange={setSelectedOption3}
                          disabled={!selectedOption2}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={selectedOption2 ? `${product.optionName3 || "옵션3"} 선택` : `${product.optionName2 || "옵션2"}를 먼저 선택해주세요`} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableOption3Values.map(val => (
                              <SelectItem key={val} value={val}>
                                {val}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* 선택된 옵션 정보 */}
                    {selectedOption && (
                      <div className="pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            {getOptionText()}
                          </span>
                          <div className="text-right">
                            <p className="font-bold">{formatPrice(selectedOption.price)}</p>
                            <p className={`text-sm ${selectedOption.stock <= 0 ? "text-red-500" : "text-muted-foreground"}`}>
                              {selectedOption.stock <= 0 ? "품절" : `재고 ${selectedOption.stock}개`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 수량 선택 */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-sm font-medium">수량</span>
                <div className="flex items-center border rounded-md">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleQuantityChange(1)}
                    disabled={currentStock !== null && quantity >= currentStock}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {currentStock !== null && currentStock > 0 && (
                  <span className="text-sm text-muted-foreground">
                    (재고: {currentStock}개)
                  </span>
                )}
              </div>

              {/* 총 금액 */}
              <div className="flex justify-between items-center p-4 bg-muted rounded-lg mb-6">
                <span className="font-medium">총 금액</span>
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(currentPrice * quantity)}
                </span>
              </div>

              {/* 메시지 */}
              {cartMessage && (
                <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
                  cartMessage.includes("추가") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}>
                  {cartMessage.includes("추가") ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {cartMessage}
                </div>
              )}

              {/* 버튼 */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={addToCart}
                  disabled={addingToCart || isOutOfStock || !isOptionSelected}
                >
                  {addingToCart ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4 mr-2" />
                  )}
                  장바구니
                </Button>
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={buyNow}
                  disabled={isOutOfStock || !isOptionSelected}
                >
                  바로 구매
                </Button>
              </div>
            </div>
          </div>

          {/* 상세 설명 */}
          {product.content && (
            <div className="mt-12">
              <h2 className="text-xl font-bold mb-4 pb-2 border-b">상품 상세정보</h2>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: product.content }}
              />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
