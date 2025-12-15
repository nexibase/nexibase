"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  FileText,
  ScrollText,
  ShoppingBag,
  Package,
  Truck,
  ClipboardList,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

interface SidebarProps {
  activeMenu?: string
  onMenuChange?: (menu: string) => void
}

export function Sidebar({ activeMenu, onMenuChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [shopMenuOpen, setShopMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
    // 쇼핑몰 관련 경로면 쇼핑몰 메뉴 열기
    if (pathname.startsWith('/admin/shop')) {
      setShopMenuOpen(true)
    }
  }, [pathname])

  const menuItems = [
    { id: "dashboard", label: "대시보드", icon: LayoutDashboard, path: "/admin" },
    { id: "users", label: "사용자관리", icon: Users, path: "/admin/users" },
    // { id: "members", label: "회원관리(G5)", icon: Users, path: "/admin/members" }, // API 구현 필요
    { id: "boards", label: "게시판관리", icon: MessageSquare, path: "/admin/boards" },
    { id: "contents", label: "콘텐츠관리", icon: FileText, path: "/admin/contents" },
    { id: "policies", label: "약관관리", icon: ScrollText, path: "/admin/policies" },
    { id: "settings", label: "환경설정", icon: Settings, path: "/admin/settings" },
  ]

  const shopMenuItems = [
    { id: "shop-products", label: "상품관리", icon: Package, path: "/admin/shop/products" },
    { id: "shop-categories", label: "카테고리", icon: ShoppingBag, path: "/admin/shop/categories" },
    { id: "shop-orders", label: "주문관리", icon: ClipboardList, path: "/admin/shop/orders" },
    { id: "shop-delivery", label: "배송비정책", icon: Truck, path: "/admin/shop/delivery" },
    { id: "shop-settings", label: "쇼핑몰설정", icon: Settings, path: "/admin/shop/settings" },
  ]

  // 현재 경로에 따라 활성 메뉴 결정
  const getActiveMenu = () => {
    const shopItem = shopMenuItems.find(item => item.path === pathname)
    if (shopItem) return shopItem.id
    return menuItems.find(item => item.path === pathname)?.id || "dashboard"
  }

  const handleMenuClick = (item: typeof menuItems[0]) => {
    router.push(item.path)
    setIsOpen(false)
    if (onMenuChange) {
      onMenuChange(item.id)
    }
  }

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const getThemeIcon = () => {
    if (!mounted) return <Monitor className="h-4 w-4" />
    if (theme === 'light') return <Sun className="h-4 w-4" />
    if (theme === 'dark') return <Moon className="h-4 w-4" />
    return <Monitor className="h-4 w-4" />
  }

  const getThemeLabel = () => {
    if (!mounted) return '시스템'
    if (theme === 'light') return '라이트'
    if (theme === 'dark') return '다크'
    return '시스템'
  }

  const currentActiveMenu = activeMenu || getActiveMenu()

  return (
    <>
      {/* 모바일 메뉴 버튼 */}
      <Button
        variant="outline"
        size="sm"
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-background border-r border-border
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* 로고 */}
          <div className="p-6 border-b border-border">
            <h1 className="text-xl font-bold text-foreground">관리자 패널</h1>
          </div>

          {/* 메뉴 */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant={currentActiveMenu === item.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => handleMenuClick(item)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              )
            })}

            {/* 쇼핑몰 메뉴 그룹 */}
            <div className="pt-2 border-t border-border mt-2">
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => setShopMenuOpen(!shopMenuOpen)}
              >
                <span className="flex items-center">
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  쇼핑몰
                </span>
                {shopMenuOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              {shopMenuOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {shopMenuItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <Button
                        key={item.id}
                        variant={currentActiveMenu === item.id ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleMenuClick(item)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* 하단 정보 */}
          <div className="p-4 border-t border-border space-y-3">
            {/* 테마 토글 */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={cycleTheme}
            >
              {getThemeIcon()}
              <span className="ml-2">{getThemeLabel()} 모드</span>
            </Button>
            <p className="text-sm text-muted-foreground">관리자 계정</p>
          </div>
        </div>
      </div>
    </>
  )
}
