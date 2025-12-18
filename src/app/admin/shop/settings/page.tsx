"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  Save,
  Settings,
  Building2,
  Truck,
  FileText,
  AlertCircle,
  Check,
  CreditCard,
  RotateCcw,
  Eye,
  EyeOff,
  Bell,
} from "lucide-react"
import { Sidebar } from "@/components/admin/Sidebar"

interface ShopSettings {
  shop_name: string
  shop_tel: string
  shop_email: string
  bank_info: string
  delivery_notice: string
  refund_policy: string
  return_shipping_fee: string  // 반품 배송비
  exchange_info: string  // 교환 안내
  return_info: string  // 반품 안내
  return_address: string  // 반품 주소
  option1_name: string
  option2_name: string
  option3_name: string
  // PG 설정
  pg_provider: string
  pg_mid: string
  pg_signkey: string
  pg_apikey: string  // 결제 취소용 API Key
  pg_test_mode: string
  // 알림 설정
  order_notification_target: string  // admin, manager, both, none
}

const DEFAULT_SETTINGS: ShopSettings = {
  shop_name: "",
  shop_tel: "",
  shop_email: "",
  bank_info: "",
  delivery_notice: "",
  refund_policy: "",
  return_shipping_fee: "5000",  // 기본 반품 배송비 5,000원
  exchange_info: "",
  return_info: "",
  return_address: "",
  option1_name: "사이즈",
  option2_name: "색상",
  option3_name: "소재",
  // PG 설정
  pg_provider: "inicis",
  pg_mid: "",
  pg_signkey: "",
  pg_apikey: "",
  pg_test_mode: "true",
  // 알림 설정
  order_notification_target: "admin",  // 기본값: 관리자만
}

export default function ShopSettingsPage() {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showSignKey, setShowSignKey] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/shop/settings")
      if (res.ok) {
        const data = await res.json()
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      }
    } catch (err) {
      console.error("설정 로드 에러:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch("/api/admin/shop/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "저장에 실패했습니다.")
        return
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key: keyof ShopSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-muted/30">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            쇼핑몰 설정
          </h1>
          <p className="text-muted-foreground">
            쇼핑몰 기본 정보를 설정합니다.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              저장
            </>
          )}
        </Button>
      </div>

      {/* 메시지 */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-100 text-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-100 text-green-800 rounded-lg">
          <Check className="h-4 w-4" />
          설정이 저장되었습니다.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              기본 정보
            </CardTitle>
            <CardDescription>
              쇼핑몰의 기본 정보를 입력합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="shop_name">쇼핑몰 이름</Label>
              <Input
                id="shop_name"
                value={settings.shop_name}
                onChange={(e) => handleChange("shop_name", e.target.value)}
                placeholder="예: 스타일리스트"
              />
            </div>
            <div>
              <Label htmlFor="shop_tel">연락처</Label>
              <Input
                id="shop_tel"
                value={settings.shop_tel}
                onChange={(e) => handleChange("shop_tel", e.target.value)}
                placeholder="예: 02-1234-5678"
              />
            </div>
            <div>
              <Label htmlFor="shop_email">이메일</Label>
              <Input
                id="shop_email"
                type="email"
                value={settings.shop_email}
                onChange={(e) => handleChange("shop_email", e.target.value)}
                placeholder="예: cs@stylist.co.kr"
              />
            </div>
          </CardContent>
        </Card>

        {/* 결제 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              결제 정보
            </CardTitle>
            <CardDescription>
              무통장입금 계좌 정보를 입력합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="bank_info">입금 계좌 안내</Label>
              <Textarea
                id="bank_info"
                value={settings.bank_info}
                onChange={(e) => handleChange("bank_info", e.target.value)}
                placeholder="예: 국민은행 123-456-789012 (주)스타일리스트"
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                주문 완료 시 고객에게 표시됩니다.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 배송 안내 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              배송 안내
            </CardTitle>
            <CardDescription>
              배송 관련 안내 문구를 입력합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="delivery_notice">배송 안내 문구</Label>
              <Textarea
                id="delivery_notice"
                value={settings.delivery_notice}
                onChange={(e) => handleChange("delivery_notice", e.target.value)}
                placeholder="예: 평일 오후 2시 이전 주문 시 당일 발송&#10;제주/도서산간 지역은 추가 배송비가 발생합니다."
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* 환불 정책 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              환불 정책
            </CardTitle>
            <CardDescription>
              교환/환불 관련 정책을 입력합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="return_shipping_fee">반품 배송비</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="return_shipping_fee"
                  type="number"
                  value={settings.return_shipping_fee}
                  onChange={(e) => handleChange("return_shipping_fee", e.target.value)}
                  placeholder="5000"
                  className="max-w-[150px]"
                />
                <span className="text-sm text-muted-foreground">원</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                배송 후 취소/반품 시 고객에게 차감되는 금액 (배송 전 취소는 전액 환불)
              </p>
            </div>
            <div>
              <Label htmlFor="refund_policy">환불 정책 안내</Label>
              <Textarea
                id="refund_policy"
                value={settings.refund_policy}
                onChange={(e) => handleChange("refund_policy", e.target.value)}
                placeholder="예: 상품 수령 후 7일 이내 환불 가능합니다.&#10;단, 착용 흔적이 있거나 택이 제거된 상품은 환불이 불가합니다."
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* 반품/교환 안내 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              반품/교환 안내
            </CardTitle>
            <CardDescription>
              반품/교환 관련 안내 정보를 입력합니다. 주문서 및 상품 상세 페이지에 표시됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="exchange_info">교환 안내</Label>
                <Textarea
                  id="exchange_info"
                  value={settings.exchange_info}
                  onChange={(e) => handleChange("exchange_info", e.target.value)}
                  placeholder="예: 상품 수령 후 7일 이내 교환 가능&#10;다른 색상/사이즈로 1회 무료 교환&#10;단순 변심 시 왕복 배송비 고객 부담"
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="return_info">반품 안내</Label>
                <Textarea
                  id="return_info"
                  value={settings.return_info}
                  onChange={(e) => handleChange("return_info", e.target.value)}
                  placeholder="예: 상품 수령 후 7일 이내 반품 가능&#10;택 제거/착용 흔적 있는 경우 반품 불가&#10;단순 변심 시 반품 배송비 차감"
                  rows={4}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="return_address">반품/교환 주소</Label>
              <Input
                id="return_address"
                value={settings.return_address}
                onChange={(e) => handleChange("return_address", e.target.value)}
                placeholder="예: 서울시 성동구 성수이로 123, 스타일리스트 물류센터"
              />
              <p className="text-xs text-muted-foreground mt-1">
                고객이 반품/교환 시 발송할 주소입니다.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 옵션명 설정 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              옵션명 설정
            </CardTitle>
            <CardDescription>
              상품 옵션의 표시명을 설정합니다. (관리자 화면에서 사용)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="option1_name">1단계 옵션명</Label>
                <Input
                  id="option1_name"
                  value={settings.option1_name}
                  onChange={(e) => handleChange("option1_name", e.target.value)}
                  placeholder="예: 사이즈"
                />
              </div>
              <div>
                <Label htmlFor="option2_name">2단계 옵션명</Label>
                <Input
                  id="option2_name"
                  value={settings.option2_name}
                  onChange={(e) => handleChange("option2_name", e.target.value)}
                  placeholder="예: 색상"
                />
              </div>
              <div>
                <Label htmlFor="option3_name">3단계 옵션명</Label>
                <Input
                  id="option3_name"
                  value={settings.option3_name}
                  onChange={(e) => handleChange("option3_name", e.target.value)}
                  placeholder="예: 소재"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PG 결제 설정 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              PG 결제 설정 (이니시스)
            </CardTitle>
            <CardDescription>
              카드결제를 위한 이니시스 PG 설정입니다. 테스트 모드에서는 실제 결제가 되지 않습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pg_mid">상점 ID (MID)</Label>
                <Input
                  id="pg_mid"
                  value={settings.pg_mid}
                  onChange={(e) => handleChange("pg_mid", e.target.value)}
                  placeholder="예: INIpayTest"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  이니시스에서 발급받은 상점 아이디
                </p>
              </div>
              <div>
                <Label htmlFor="pg_signkey">SignKey</Label>
                <div className="relative">
                  <Input
                    id="pg_signkey"
                    type={showSignKey ? "text" : "password"}
                    value={settings.pg_signkey}
                    onChange={(e) => handleChange("pg_signkey", e.target.value)}
                    placeholder="SignKey를 입력하세요"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignKey(!showSignKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSignKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  이니시스에서 발급받은 서명키 (결제 승인용)
                </p>
              </div>
              <div>
                <Label htmlFor="pg_apikey">API Key (취소용)</Label>
                <div className="relative">
                  <Input
                    id="pg_apikey"
                    type={showApiKey ? "text" : "password"}
                    value={settings.pg_apikey}
                    onChange={(e) => handleChange("pg_apikey", e.target.value)}
                    placeholder="API Key를 입력하세요"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  이니시스에서 발급받은 INIAPIKey (결제 취소용)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pg_test_mode"
                checked={settings.pg_test_mode === "true"}
                onChange={(e) => handleChange("pg_test_mode", e.target.checked ? "true" : "false")}
                className="rounded"
              />
              <label htmlFor="pg_test_mode" className="text-sm cursor-pointer">
                테스트 모드 (실제 결제 안됨)
              </label>
            </div>
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400 mb-2">테스트 모드 안내</p>
              <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 space-y-1">
                <li>테스트 MID: <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono text-amber-800 dark:text-amber-200">INIpayTest</code></li>
                <li>테스트 API Key: <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono text-amber-800 dark:text-amber-200">ItEQKi3rY7uvDS8l</code></li>
                <li>테스트 SignKey: 이니시스 개발자센터에서 확인</li>
                <li>실제 운영 시 테스트 모드를 해제하세요</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 주문 알림 설정 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              주문 알림 설정
            </CardTitle>
            <CardDescription>
              새 주문이 들어올 때 알림을 받을 관리자를 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="order_notification_target">주문 알림 수신 대상</Label>
              <select
                id="order_notification_target"
                value={settings.order_notification_target}
                onChange={(e) => handleChange("order_notification_target", e.target.value)}
                className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="admin">관리자만</option>
                <option value="manager">부관리자만</option>
                <option value="both">관리자 + 부관리자</option>
                <option value="none">알림 안 받음</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                새 주문 발생 시 선택한 권한을 가진 사용자에게 알림이 발송됩니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      </main>
    </div>
  )
}
