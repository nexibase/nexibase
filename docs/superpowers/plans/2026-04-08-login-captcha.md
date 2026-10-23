# 로그인 시도 기록 + Cloudflare Turnstile CAPTCHA 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 시도를 DB에 기록하고, 3회 초과 실패 시 Cloudflare Turnstile CAPTCHA를 표시하여 봇 공격을 차단한다.

**Architecture:** LoginAttempt 모델을 DB에 추가하고, 커스텀 로그인 API(`/api/auth/login`)에서 기존 NextAuth CredentialsProvider 로직을 직접 처리한다. 클라이언트에서는 이메일 blur 시 실패 횟수를 조회하고, 3회 초과 시 `@marsidev/react-turnstile` 위젯을 표시한다.

**Tech Stack:** Next.js 14 (App Router), Prisma (MySQL), NextAuth, @marsidev/react-turnstile, Cloudflare Turnstile API

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `prisma/schema.base.prisma` | LoginAttempt 모델 추가 |
| Modify | `prisma/schema.prisma` | scan-plugins 후 자동 생성 (확인용) |
| Create | `src/app/api/auth/login/route.ts` | 커스텀 로그인 API (인증 + CAPTCHA 검증 + 기록) |
| Create | `src/app/api/auth/login-attempts/route.ts` | 실패 횟수 조회 API |
| Modify | `src/components/pages/auth/LoginPage.tsx` | Turnstile 위젯 통합, 로그인 흐름 변경 |
| Create | `src/app/api/me/login-history/route.ts` | 본인 로그인 기록 조회 API |
| Modify | `src/app/mypage/page.tsx` | 로그인 기록 섹션 추가 |
| Create | `src/app/admin/login-logs/page.tsx` | 관리자 로그인 기록 페이지 |
| Create | `src/app/api/admin/login-logs/route.ts` | 관리자 로그인 기록 API |
| Modify | `src/components/admin/Sidebar.tsx` | 로그인기록 메뉴 추가 |
| Modify | `.env` | Turnstile 환경 변수 추가 |
| Modify | `.env.example` | Turnstile 환경 변수 예시 추가 |

---

### Task 1: 패키지 설치 및 환경 변수

**Files:**
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: @marsidev/react-turnstile 패키지 설치**

```bash
cd /path/to/nexibase && npm install @marsidev/react-turnstile
```

- [ ] **Step 2: .env에 Turnstile 환경 변수 추가**

`.env` 파일 끝에 추가:
```
# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

- [ ] **Step 3: .env.example에도 동일하게 추가**

`.env.example` 파일 끝에 추가:
```
# Cloudflare Turnstile (로그인 CAPTCHA)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: @marsidev/react-turnstile 패키지 설치 및 환경 변수 추가"
```

---

### Task 2: LoginAttempt 모델 추가 및 마이그레이션

**Files:**
- Modify: `prisma/schema.base.prisma`

- [ ] **Step 1: schema.base.prisma에 LoginAttempt 모델 추가**

`prisma/schema.base.prisma` 파일 끝에 추가:

```prisma
model LoginAttempt {
  id        Int      @id @default(autoincrement())
  email     String   @db.VarChar(255)
  ip        String   @db.VarChar(50)
  success   Boolean
  reason    String?  @db.VarChar(100)
  createdAt DateTime @default(now())

  @@index([email, createdAt])
  @@index([ip, createdAt])
  @@map("login_attempts")
}
```

- [ ] **Step 2: scan-plugins 실행하여 schema.prisma 재생성**

```bash
cd /path/to/nexibase && node scripts/scan-plugins.js
```

Expected: `prisma/schema.prisma`에 LoginAttempt 모델이 포함됨

- [ ] **Step 3: Prisma 마이그레이션 실행**

```bash
cd /path/to/nexibase && npx prisma migrate dev --name add-login-attempts
```

Expected: `login_attempts` 테이블 생성 완료

- [ ] **Step 4: Prisma Client 생성 확인**

```bash
cd /path/to/nexibase && npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: LoginAttempt 모델 추가 및 마이그레이션"
```

---

### Task 3: 실패 횟수 조회 API

**Files:**
- Create: `src/app/api/auth/login-attempts/route.ts`

- [ ] **Step 1: 실패 횟수 조회 API 생성**

`src/app/api/auth/login-attempts/route.ts` 파일 생성:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")

  if (!email) {
    return NextResponse.json({ failCount: 0 })
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  // 최근 1시간 내 마지막 성공 로그인 시점 조회
  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: {
      email,
      success: true,
      createdAt: { gte: oneHourAgo },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  // 마지막 성공 이후 (또는 1시간 내) 실패 횟수
  const failCount = await prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: {
        gte: lastSuccess?.createdAt ?? oneHourAgo,
      },
    },
  })

  return NextResponse.json({ failCount })
}
```

- [ ] **Step 2: 서버 시작 상태에서 API 동작 확인**

```bash
curl -s "http://localhost:3000/api/auth/login-attempts?email=test@test.com" | jq .
```

Expected: `{ "failCount": 0 }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/login-attempts/
git commit -m "feat: 로그인 실패 횟수 조회 API 추가"
```

---

### Task 4: 커스텀 로그인 API

**Files:**
- Create: `src/app/api/auth/login/route.ts`

- [ ] **Step 1: 커스텀 로그인 API 생성**

`src/app/api/auth/login/route.ts` 파일 생성:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { encode } from "next-auth/jwt"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"

  try {
    const { email, password, turnstileToken } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "이메일과 비밀번호를 입력해주세요." },
        { status: 400 }
      )
    }

    // 실패 횟수 조회
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const lastSuccess = await prisma.loginAttempt.findFirst({
      where: { email, success: true, createdAt: { gte: oneHourAgo } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })

    const failCount = await prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: { gte: lastSuccess?.createdAt ?? oneHourAgo },
      },
    })

    // 3회 초과 실패 시 CAPTCHA 필수
    if (failCount > 3) {
      if (!turnstileToken) {
        return NextResponse.json({
          success: false,
          captchaRequired: true,
          message: "보안 인증이 필요합니다.",
        })
      }

      // Turnstile 토큰 검증
      const secretKey = process.env.TURNSTILE_SECRET_KEY
      if (secretKey) {
        const verifyRes = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              secret: secretKey,
              response: turnstileToken,
              remoteip: ip,
            }),
          }
        )
        const verifyData = await verifyRes.json()

        if (!verifyData.success) {
          return NextResponse.json(
            { success: false, message: "보안 인증에 실패했습니다. 다시 시도해주세요." },
            { status: 400 }
          )
        }
      }
    }

    // 유저 조회
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || !user.password) {
      await prisma.loginAttempt.create({
        data: { email, ip, success: false, reason: "존재하지 않는 이메일" },
      })
      return NextResponse.json(
        { success: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      )
    }

    // 삭제/차단/비활성 계정 체크
    if (user.deletedAt || user.status === "banned" || user.status === "inactive") {
      await prisma.loginAttempt.create({
        data: { email, ip, success: false, reason: `계정 상태: ${user.deletedAt ? "삭제" : user.status}` },
      })
      return NextResponse.json(
        { success: false, message: "로그인에 문제가 있습니다. 관리자에게 문의해 주세요." },
        { status: 403 }
      )
    }

    if (user.status === "withdrawn") {
      await prisma.loginAttempt.create({
        data: { email, ip, success: false, reason: "탈퇴 계정" },
      })
      return NextResponse.json(
        { success: false, message: "탈퇴한 계정입니다." },
        { status: 403 }
      )
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      await prisma.loginAttempt.create({
        data: { email, ip, success: false, reason: "비밀번호 불일치" },
      })

      // 현재 실패 횟수 +1 후 captchaRequired 여부 판단
      const newFailCount = failCount + 1
      return NextResponse.json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
        captchaRequired: newFailCount > 3,
      }, { status: 401 })
    }

    // 로그인 성공
    await prisma.loginAttempt.create({
      data: { email, ip, success: true },
    })

    // 마지막 로그인 시간 + IP 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    })

    // NextAuth JWT 토큰 생성
    const token = await encode({
      token: {
        id: String(user.id),
        email: user.email,
        name: user.nickname,
        picture: user.image,
        sub: String(user.id),
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: authOptions.session?.maxAge ?? 24 * 60 * 60,
    })

    // 세션 쿠키 설정
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        image: user.image,
        role: user.role,
      },
    })

    const isProduction = process.env.NODE_ENV === "production"
    response.cookies.set("next-auth.session-token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isProduction,
      maxAge: authOptions.session?.maxAge ?? 24 * 60 * 60,
    })

    return response
  } catch (error) {
    console.error("로그인 처리 에러:", error)
    return NextResponse.json(
      { success: false, message: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/login/
git commit -m "feat: 커스텀 로그인 API (CAPTCHA 검증 + 로그인 기록)"
```

---

### Task 5: LoginPage Turnstile 통합

**Files:**
- Modify: `src/components/pages/auth/LoginPage.tsx`

- [ ] **Step 1: LoginPage를 커스텀 로그인 API + Turnstile 위젯으로 변경**

`src/components/pages/auth/LoginPage.tsx`를 아래와 같이 수정:

**import 영역에 추가:**
```typescript
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef } from "react";
```

기존 import를 수정:
```typescript
import { useState, useEffect, useRef } from "react";
```

`signIn` import는 소셜 로그인에서만 사용하므로 유지.

**state 영역에 추가** (기존 state 선언 아래):
```typescript
const [captchaRequired, setCaptchaRequired] = useState(false);
const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
const turnstileRef = useRef<TurnstileInstance>(null);
```

**이메일 blur 핸들러 추가** (handleSubmit 위에):
```typescript
const checkCaptchaRequired = async (emailToCheck: string) => {
  if (!emailToCheck) return;
  try {
    const res = await fetch(`/api/auth/login-attempts?email=${encodeURIComponent(emailToCheck)}`);
    const data = await res.json();
    setCaptchaRequired(data.failCount > 3);
  } catch {
    // 조회 실패 시 CAPTCHA 없이 진행
  }
};
```

**handleSubmit 전체를 아래로 교체:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setErrorMessage(null);

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        turnstileToken: turnstileToken || undefined,
      }),
    });

    const data = await res.json();

    if (data.success) {
      // 브라우저 세션 마커 설정
      markBrowserSession();

      // 브라우저 비밀번호 관리자에 자격 증명 저장 요청
      if (window.PasswordCredential && navigator.credentials) {
        try {
          const cred = new window.PasswordCredential({
            id: email,
            password: password,
          });
          await navigator.credentials.store(cred);
        } catch {
          // 자격 증명 저장 실패해도 로그인은 계속 진행
        }
      }

      const callbackUrl = searchParams.get("callbackUrl") || "/";
      router.push(callbackUrl);
      router.refresh();
    } else {
      // CAPTCHA 필요 여부 업데이트
      if (data.captchaRequired) {
        setCaptchaRequired(true);
        setTurnstileToken(null);
        turnstileRef.current?.reset();
      }
      setErrorMessage(data.message || "로그인에 실패했습니다.");
    }
  } catch (error) {
    console.error("로그인 에러:", error);
    setErrorMessage("네트워크 오류가 발생했습니다.");
  } finally {
    setIsLoading(false);
  }
};
```

**이메일 Input에 onBlur 추가:**

기존:
```tsx
<Input
  id="email"
  name="email"
  type="email"
  placeholder="이메일을 입력하세요"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  className="pl-10"
  required
  autoComplete="username email"
/>
```

변경:
```tsx
<Input
  id="email"
  name="email"
  type="email"
  placeholder="이메일을 입력하세요"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  onBlur={(e) => checkCaptchaRequired(e.target.value)}
  className="pl-10"
  required
  autoComplete="username email"
/>
```

**로그인 버튼 바로 위에 Turnstile 위젯 추가:**

`<Button type="submit" ...>` 바로 위에:
```tsx
{captchaRequired && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
  <div className="flex justify-center">
    <Turnstile
      ref={turnstileRef}
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      onSuccess={(token) => setTurnstileToken(token)}
      onExpire={() => setTurnstileToken(null)}
      options={{ theme: "auto" }}
    />
  </div>
)}
```

**로그인 버튼의 disabled 조건 수정:**

기존:
```tsx
disabled={isLoading}
```

변경:
```tsx
disabled={isLoading || (captchaRequired && !turnstileToken)}
```

- [ ] **Step 2: 브라우저에서 로그인 테스트**

1. `http://localhost:3000/login`에서 잘못된 비밀번호로 3회 시도 → 에러 메시지만 표시
2. 4회째 시도 → Turnstile 위젯 표시 (환경 변수 미설정 시 위젯 안 나옴 — 정상)
3. 올바른 비밀번호로 로그인 → 성공, 기존과 동일하게 페이지 이동

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/auth/LoginPage.tsx
git commit -m "feat: 로그인 페이지 Turnstile CAPTCHA 통합"
```

---

### Task 6: 본인 로그인 기록 API + 마이페이지 표시

**Files:**
- Create: `src/app/api/me/login-history/route.ts`
- Modify: `src/app/mypage/page.tsx`

- [ ] **Step 1: 본인 로그인 기록 API 생성**

`src/app/api/me/login-history/route.ts` 파일 생성:

```typescript
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
  }

  const logs = await prisma.loginAttempt.findMany({
    where: { email: session.email },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      ip: true,
      success: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ logs })
}
```

- [ ] **Step 2: 마이페이지에 로그인 기록 섹션 추가**

`src/app/mypage/page.tsx`에서:

**import 영역에 `Monitor` 아이콘 추가:**
```typescript
import {
  LogOut, MessageSquare, FileText, Eye, ThumbsUp, Clock, User, Calendar, Mail, Phone, Shield, Monitor,
} from "lucide-react"
```

**interface 추가** (MyPost interface 아래):
```typescript
interface LoginLog {
  id: number
  ip: string
  success: boolean
  createdAt: string
}
```

**state 추가** (기존 state 선언 아래):
```typescript
const [loginLogs, setLoginLogs] = useState<LoginLog[]>([])
```

**useEffect 내 fetchUser 함수 안에서 로그인 기록도 함께 조회** (기존 fetch 호출 아래에 추가):
```typescript
// 로그인 기록 조회
fetch("/api/me/login-history")
  .then(res => res.json())
  .then(data => { if (data.logs) setLoginLogs(data.logs) })
  .catch(console.error)
```

**"내 정보" Card 아래에 로그인 기록 Card 추가:**
```tsx
{/* 로그인 기록 */}
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-base flex items-center gap-2">
      <Monitor className="h-4 w-4" />
      로그인 기록
    </CardTitle>
  </CardHeader>
  <CardContent>
    {loginLogs.length === 0 ? (
      <p className="text-sm text-muted-foreground py-4 text-center">로그인 기록이 없습니다.</p>
    ) : (
      <div className="space-y-2">
        {loginLogs.map(log => (
          <div key={log.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-muted-foreground">{log.ip}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(log.createdAt).toLocaleString('ko-KR')}
            </span>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 3: 브라우저에서 마이페이지 확인**

`http://localhost:3000/mypage` — 로그인 기록 섹션에 최근 기록이 표시되는지 확인

- [ ] **Step 4: Commit**

```bash
git add src/app/api/me/login-history/ src/app/mypage/page.tsx
git commit -m "feat: 마이페이지 로그인 기록 표시"
```

---

### Task 7: 관리자 로그인 기록 API

**Files:**
- Create: `src/app/api/admin/login-logs/route.ts`

- [ ] **Step 1: 관리자 로그인 기록 API 생성**

`src/app/api/admin/login-logs/route.ts` 파일 생성:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const email = searchParams.get("email") || ""
  const ip = searchParams.get("ip") || ""
  const success = searchParams.get("success") // "true" | "false" | null
  const from = searchParams.get("from") // ISO date string
  const to = searchParams.get("to") // ISO date string

  const where: Record<string, unknown> = {}

  if (email) {
    where.email = { contains: email }
  }
  if (ip) {
    where.ip = { contains: ip }
  }
  if (success === "true" || success === "false") {
    where.success = success === "true"
  }
  if (from || to) {
    where.createdAt = {}
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from)
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to)
  }

  const [logs, total] = await Promise.all([
    prisma.loginAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.loginAttempt.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/login-logs/
git commit -m "feat: 관리자 로그인 기록 조회 API"
```

---

### Task 8: 관리자 로그인 기록 페이지 + 사이드바 메뉴

**Files:**
- Create: `src/app/admin/login-logs/page.tsx`
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: 사이드바에 로그인기록 메뉴 추가**

`src/components/admin/Sidebar.tsx`에서 `coreMenuItems` 배열을 찾아, `users` 항목 바로 아래에 추가:

기존:
```typescript
const coreMenuItems = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard, path: "/admin" },
  { id: "users", label: "사용자관리", icon: Users, path: "/admin/users" },
  { id: "settings", label: "환경설정", icon: Settings, path: "/admin/settings" },
```

변경:
```typescript
const coreMenuItems = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard, path: "/admin" },
  { id: "users", label: "사용자관리", icon: Users, path: "/admin/users" },
  { id: "login-logs", label: "로그인기록", icon: ClipboardList, path: "/admin/login-logs" },
  { id: "settings", label: "환경설정", icon: Settings, path: "/admin/settings" },
```

(`ClipboardList`는 이미 import되어 있음)

- [ ] **Step 2: 관리자 로그인 기록 페이지 생성**

`src/app/admin/login-logs/page.tsx` 파일 생성:

```tsx
"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  XCircle,
} from "lucide-react"

interface LoginLog {
  id: number
  email: string
  ip: string
  success: boolean
  reason: string | null
  createdAt: string
}

function LoginLogsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialPage = parseInt(searchParams.get("page") || "1")
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchEmail, setSearchEmail] = useState("")
  const [searchIp, setSearchIp] = useState("")
  const [filterSuccess, setFilterSuccess] = useState<string>("")

  const updateURL = useCallback((page: number) => {
    const params = new URLSearchParams()
    if (page > 1) params.set("page", String(page))
    const query = params.toString()
    router.replace(`/admin/login-logs${query ? `?${query}` : ""}`)
  }, [router])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      })
      if (searchEmail) params.set("email", searchEmail)
      if (searchIp) params.set("ip", searchIp)
      if (filterSuccess) params.set("success", filterSuccess)

      const response = await fetch(`/api/admin/login-logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.logs)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error("로그인 기록 조회 실패:", error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchEmail, searchIp, filterSuccess])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar activeMenu="login-logs" />

        <main className="flex-1 p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              로그인 기록
            </h1>
            <p className="text-muted-foreground mt-1">
              전체 로그인 시도 기록을 확인합니다.
            </p>
          </div>

          {/* Table Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex flex-1 gap-2 max-w-2xl">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="이메일 검색..."
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
                      className="pl-9"
                    />
                  </div>
                  <Input
                    placeholder="IP 검색..."
                    value={searchIp}
                    onChange={(e) => setSearchIp(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
                    className="w-40"
                  />
                  <select
                    value={filterSuccess}
                    onChange={(e) => { setFilterSuccess(e.target.value); setCurrentPage(1) }}
                    className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">전체</option>
                    <option value="true">성공</option>
                    <option value="false">실패</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-y bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">상태</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">이메일</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">IP</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">사유</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="h-32 text-center">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="h-32 text-center text-muted-foreground">
                          로그인 기록이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="border-b transition-colors hover:bg-muted/50">
                          <td className="p-4 align-middle">
                            {log.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </td>
                          <td className="p-4 align-middle text-sm">{log.email}</td>
                          <td className="p-4 align-middle text-sm text-muted-foreground">{log.ip}</td>
                          <td className="p-4 align-middle text-sm text-muted-foreground">{log.reason || "-"}</td>
                          <td className="p-4 align-middle text-sm text-muted-foreground">{formatDate(log.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    총 {total}건
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { const p = Math.max(1, currentPage - 1); setCurrentPage(p); updateURL(p) }}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page: number
                      if (totalPages <= 5) {
                        page = i + 1
                      } else if (currentPage <= 3) {
                        page = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i
                      } else {
                        page = currentPage - 2 + i
                      }
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setCurrentPage(page); updateURL(page) }}
                        >
                          {page}
                        </Button>
                      )
                    })}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { const p = Math.min(totalPages, currentPage + 1); setCurrentPage(p); updateURL(p) }}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

export default function LoginLogsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginLogsContent />
    </Suspense>
  )
}
```

- [ ] **Step 3: 브라우저에서 확인**

`http://localhost:3000/admin/login-logs` — 사이드바에 "로그인기록" 메뉴가 표시되고, 페이지에서 로그인 기록이 조회되는지 확인

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/login-logs/ src/components/admin/Sidebar.tsx
git commit -m "feat: 관리자 로그인 기록 페이지 및 사이드바 메뉴 추가"
```

---

### Task 9: 최종 확인 및 버전 커밋

- [ ] **Step 1: 전체 흐름 테스트**

1. 로그인 페이지에서 잘못된 비밀번호로 4회 시도 → Turnstile 위젯 표시
2. 올바른 비밀번호로 로그인 → 성공
3. 마이페이지 → 로그인 기록에 성공/실패 기록 표시
4. 관리자 페이지 → 로그인기록에서 전체 기록 조회, 필터 동작 확인

- [ ] **Step 2: 빌드 확인**

```bash
cd /path/to/nexibase && npm run build
```

Expected: 빌드 성공, 에러 없음

- [ ] **Step 3: 최종 Commit**

```bash
git add -A
git commit -m "chore: 로그인 CAPTCHA + 로그인 기록 기능 최종 정리"
```
