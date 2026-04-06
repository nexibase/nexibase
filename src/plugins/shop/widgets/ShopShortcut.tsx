"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ShoppingBag, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function ShopShortcut() {
  return (
    <Link href="/shop">
      <Card className="h-full bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20 hover:border-green-500/50 hover:shadow-md transition-all duration-300 cursor-pointer group">
        <CardContent className="p-4 h-full flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingBag className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">쇼핑몰</h3>
              <p className="text-xs text-muted-foreground">신선한 상품 구경하기</p>
            </div>
          </div>
          <div className="flex items-center text-xs text-green-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span>바로가기</span>
            <ArrowRight className="h-3 w-3 ml-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
