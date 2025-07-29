import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Users, MessageSquare, TrendingUp } from "lucide-react"

export function DashboardContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">대시보드</h2>
        <p className="text-muted-foreground">관리자 패널에 오신 것을 환영합니다.</p>
      </div>

      {/* 통계 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 회원수</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              +20.1% 지난달 대비
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 게시글</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5,678</div>
            <p className="text-xs text-muted-foreground">
              +12.5% 지난주 대비
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 사용자</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">892</div>
            <p className="text-xs text-muted-foreground">
              +8.2% 어제 대비
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">시스템 상태</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">정상</div>
            <p className="text-xs text-muted-foreground">
              모든 서비스 운영 중
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 최근 활동 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>최근 가입 회원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">사용자 {i}</p>
                    <p className="text-xs text-muted-foreground">
                      {i}시간 전 가입
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 게시글</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">게시글 제목 {i}</p>
                    <p className="text-xs text-muted-foreground">
                      작성자{i} • {i}시간 전
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

```tsx:src/components/admin/UsersContent.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Edit, Trash2, Plus } from "lucide-react"

export function UsersContent() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">회원관리</h2>
          <p className="text-muted-foreground">전체 회원을 관리합니다.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          새 회원 추가
        </Button>
      </div>

      {/* 검색 및 필터 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="회원 검색..." className="pl-10" />
            </div>
            <Button variant="outline">필터</Button>
          </div>
        </CardContent>
      </Card>

      {/* 회원 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>회원 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">이름</th>
                  <th className="text-left p-2">이메일</th>
                  <th className="text-left p-2">가입일</th>
                  <th className="text-left p-2">상태</th>
                  <th className="text-left p-2">작업</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-2">{i}</td>
                    <td className="p-2">사용자 {i}</td>
                    <td className="p-2">user{i}@example.com</td>
                    <td className="p-2">2024-01-{String(i).padStart(2, '0')}</td>
                    <td className="p-2">
                      <Badge variant={i % 2 === 0 ? "default" : "secondary"}>
                        {i % 2 === 0 ? "활성" : "비활성"}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

```tsx:src/components/admin/BoardsContent.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Edit, Trash2, Plus, MessageSquare } from "lucide-react"

export function BoardsContent() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">게시판관리</h2>
          <p className="text-muted-foreground">게시판과 게시글을 관리합니다.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          새 게시판 생성
        </Button>
      </div>

      {/* 검색 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="게시판 또는 게시글 검색..." className="pl-10" />
            </div>
            <Button variant="outline">필터</Button>
          </div>
        </CardContent>
      </Card>

      {/* 게시판 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  게시판 {i}
                </CardTitle>
                <Badge variant="outline">공개</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                게시판 {i}에 대한 설명입니다.
              </p>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>게시글: {i * 10}</span>
                <span>회원: {i * 5}</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="mr-1 h-3 w-3" />
                  수정
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Trash2 className="mr-1 h-3 w-3" />
                  삭제
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

```tsx:src/components/admin/SettingsContent.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function SettingsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">환경설정</h2>
        <p className="text-muted-foreground">시스템 설정을 관리합니다.</p>
      </div>

      {/* 기본 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>기본 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="site-name">사이트 이름</Label>
              <Input id="site-name" defaultValue="관리자 패널" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-url">사이트 URL</Label>
              <Input id="site-url" defaultValue="https://example.com" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">사이트 설명</Label>
            <Input id="description" defaultValue="관리자 패널입니다." />
          </div>
        </CardContent>
      </Card>

      {/* 보안 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>보안 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>2단계 인증</Label>
              <p className="text-sm text-muted-foreground">
                관리자 계정에 2단계 인증을 활성화합니다.
              </p>
            </div>
            <Switch />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>세션 타임아웃</Label>
              <p className="text-sm text-muted-foreground">
                자동 로그아웃 시간을 설정합니다.
              </p>
            </div>
            <Input type="number" defaultValue="30" className="w-20" />
          </div>
        </CardContent>
      </Card>

      {/* 이메일 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>이메일 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP 호스트</Label>
              <Input id="smtp-host" defaultValue="smtp.gmail.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP 포트</Label>
              <Input id="smtp-port" defaultValue="587" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email-user">이메일 사용자</Label>
              <Input id="email-user" defaultValue="admin@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-password">이메일 비밀번호</Label>
              <Input id="email-password" type="password" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <Button>설정 저장</Button>
      </div>
    </div>
  )
}
```

```tsx:src/components/ui/switch.tsx
"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

```tsx:src/components/ui/label.tsx
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

이제 메인 관리자 대시보드 페이지를 생성하겠습니다:

```tsx:src/app/admin/page.tsx
"use client"

import { useState } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { DashboardContent } from "@/components/admin/DashboardContent"
import { UsersContent } from "@/components/admin/UsersContent"
import { BoardsContent } from "@/components/admin/BoardsContent"
import { SettingsContent } from "@/components/admin/SettingsContent"

export default function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState("dashboard")

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <DashboardContent />
      case "users":
        return <UsersContent />
      case "boards":
        return <BoardsContent />
      case "settings":
        return <SettingsContent />
      default:
        return <DashboardContent />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
        <main className="flex-1 lg:ml-0 p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
```

마지막으로 필요한 의존성을 추가해야 합니다. `package.json`에 다음 패키지들을 추가해주세요:

```json:package.json
{
  "dependencies": {
    "@prisma/client": "^6.12.0",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.1.0",
    // ... existing dependencies ...
  }
}
```

이제 관리자 대시보드가 완성되었습니다! 주요 기능들:

1. **반응형 사이드바**: 화면이 작을 때는 햄버거 메뉴로 변환
2. **메뉴 구성**:
   - 대시보드: 통계 및 최근 활동
   - 회원관리: 회원 목록 및 관리
   - 게시판관리: 게시판 및 게시글 관리
   - 환경설정: 시스템 설정
3. **모던한 UI**: Tailwind CSS와 shadcn/ui 컴포넌트 사용
4. **반응형 디자인**: 모바일, 태블릿, 데스크톱 모두 지원

`/admin` 경로로 접속하면 관리자 대시보드를 확인할 수 있습니다. 필요한 경우 추가 메뉴나 기능을 구현할 수 있습니다. 