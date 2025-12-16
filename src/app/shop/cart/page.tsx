"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Header, Footer } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  Package,
  ChevronRight,
  AlertCircle,
} from "lucide-react"

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

export default function CartPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCart()
  }, [])

  const loadCart = () => {
    const cart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]")
    setCartItems(cart)
    // 기본적으로 모든 아이템 선택
    const allKeys = new Set(cart.map(item => getItemKey(item)))
    setSelectedItems(allKeys)
    setLoading(false)
  }

  const getItemKey = (item: CartItem) => {
    return `${item.productId}-${item.optionId || "none"}`
  }

  const saveCart = (items: CartItem[]) => {
    localStorage.setItem("cart", JSON.stringify(items))
    window.dispatchEvent(new Event("cartUpdated"))
  }

  const updateQuantity = (index: number, delta: number) => {
    const newItems = [...cartItems]
    const newQty = newItems[index].quantity + delta
    if (newQty < 1) return
    newItems[index].quantity = newQty
    setCartItems(newItems)
    saveCart(newItems)
  }

  const removeItem = (index: number) => {
    const item = cartItems[index]
    const key = getItemKey(item)
    const newItems = cartItems.filter((_, i) => i !== index)
    setCartItems(newItems)
    saveCart(newItems)
    // 선택에서도 제거
    const newSelected = new Set(selectedItems)
    newSelected.delete(key)
    setSelectedItems(newSelected)
  }

  const removeSelectedItems = () => {
    const newItems = cartItems.filter(item => !selectedItems.has(getItemKey(item)))
    setCartItems(newItems)
    saveCart(newItems)
    setSelectedItems(new Set())
  }

  const toggleItem = (item: CartItem) => {
    const key = getItemKey(item)
    const newSelected = new Set(selectedItems)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedItems(newSelected)
  }

  const toggleAll = () => {
    if (selectedItems.size === cartItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(cartItems.map(item => getItemKey(item))))
    }
  }

  const getSelectedItems = () => {
    return cartItems.filter(item => selectedItems.has(getItemKey(item)))
  }

  const getTotalPrice = () => {
    return getSelectedItems().reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  const getTotalQuantity = () => {
    return getSelectedItems().reduce((sum, item) => sum + item.quantity, 0)
  }

  const handleOrder = () => {
    if (selectedItems.size === 0) {
      alert("주문할 상품을 선택해주세요.")
      return
    }
    // 선택된 상품만 주문 정보로 저장
    const orderItems = getSelectedItems()
    localStorage.setItem("orderItems", JSON.stringify(orderItems))
    router.push("/shop/order")
  }

  const formatPrice = (price: number) => price.toLocaleString() + "원"

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-pulse">로딩 중...</div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* 헤더 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              장바구니
            </h1>
          </div>

          {cartItems.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">장바구니가 비어있습니다.</p>
                <Button onClick={() => router.push("/shop")}>
                  쇼핑 계속하기
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 장바구니 목록 */}
              <div className="lg:col-span-2 space-y-4">
                {/* 전체 선택 */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedItems.size === cartItems.length}
                      onCheckedChange={toggleAll}
                    />
                    <label htmlFor="select-all" className="text-sm cursor-pointer">
                      전체 선택 ({selectedItems.size}/{cartItems.length})
                    </label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeSelectedItems}
                    disabled={selectedItems.size === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    선택 삭제
                  </Button>
                </div>

                {/* 상품 목록 */}
                {cartItems.map((item, index) => {
                  const key = getItemKey(item)
                  const isSelected = selectedItems.has(key)

                  return (
                    <Card key={key} className={!isSelected ? "opacity-60" : ""}>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {/* 체크박스 */}
                          <div className="flex items-start pt-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleItem(item)}
                            />
                          </div>

                          {/* 이미지 */}
                          <Link href={`/shop/${item.productSlug}`} className="flex-shrink-0">
                            <div className="w-20 h-20 bg-muted rounded-md overflow-hidden">
                              {item.productImage ? (
                                <img
                                  src={item.productImage}
                                  alt={item.productName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          </Link>

                          {/* 상품 정보 */}
                          <div className="flex-1 min-w-0">
                            <Link href={`/shop/${item.productSlug}`}>
                              <h3 className="font-medium hover:text-primary transition-colors line-clamp-1">
                                {item.productName}
                              </h3>
                            </Link>
                            {item.optionText && (
                              <p className="text-sm text-muted-foreground mt-1">
                                옵션: {item.optionText}
                              </p>
                            )}
                            <p className="font-bold mt-2">{formatPrice(item.price)}</p>

                            {/* 수량 조절 */}
                            <div className="flex items-center gap-2 mt-3">
                              <div className="flex items-center border rounded-md">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateQuantity(index, -1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-10 text-center text-sm">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateQuantity(index, 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* 소계 */}
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">소계</p>
                            <p className="font-bold">
                              {formatPrice(item.price * item.quantity)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* 주문 요약 */}
              <div className="lg:col-span-1">
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="text-lg">주문 요약</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>선택 상품</span>
                      <span>{selectedItems.size}개 ({getTotalQuantity()}개)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>상품 금액</span>
                      <span>{formatPrice(getTotalPrice())}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>배송비</span>
                      <span>주문 시 계산</span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">예상 결제금액</span>
                        <span className="text-xl font-bold text-primary">
                          {formatPrice(getTotalPrice())}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        배송비 별도
                      </p>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleOrder}
                      disabled={selectedItems.size === 0}
                    >
                      주문하기
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push("/shop")}
                    >
                      쇼핑 계속하기
                    </Button>
                  </CardContent>
                </Card>

                {/* 안내 */}
                <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p>장바구니는 브라우저에 저장됩니다.</p>
                      <p className="mt-1">
                        브라우저 데이터를 삭제하면 장바구니가 초기화될 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
