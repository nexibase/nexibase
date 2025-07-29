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
