# Plugin Infrastructure Implementation Plan (1단계)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플러그인 시스템의 핵심 인프라를 구축한다 — 스캔 스크립트, 매니페스트, rewrites, 미들웨어, 관리자 페이지. 이 단계가 완료되면 플러그인 폴더에 코드를 넣으면 자동으로 인식되고, 관리자가 활성화/비활성화할 수 있다.

**Architecture:** `scripts/scan-plugins.js`가 빌드 시 `src/plugins/*/`를 스캔하여 매니페스트, Prisma 스키마 병합, Next.js rewrites를 자동 생성. 미들웨어가 비활성 플러그인 라우트를 차단. 관리자 페이지에서 활성화/비활성화 토글.

**Tech Stack:** Node.js fs (스캔), Next.js middleware, Next.js rewrites, Prisma schema merge, existing Setting model, ShadCN UI

**범위:** 이 계획은 인프라만 다룸. 기존 코드 마이그레이션(2단계)과 메뉴/위젯 연동(3단계)은 별도 계획.

---

### Task 1: 테스트용 플러그인 폴더 생성

**Files:**
- Create: `src/plugins/sample/plugin.ts`

- [ ] **Step 1: 디렉토리와 plugin.ts 생성**

```bash
mkdir -p src/plugins/sample
```

```typescript
// src/plugins/sample/plugin.ts
export default {
  name: '샘플 플러그인',
  description: '플러그인 시스템 테스트용',
  version: '0.1.0',
  author: 'nexibase',
  authorDomain: 'https://nexibase.com',
  repository: '',
  slug: 'sample',
  defaultEnabled: true,
}
```

- [ ] **Step 2: 테스트용 라우트 생성**

```bash
mkdir -p src/plugins/sample/routes
```

```tsx
// src/plugins/sample/routes/page.tsx
export default function SamplePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-bold">샘플 플러그인 페이지</h1>
    </div>
  )
}
```

- [ ] **Step 3: 테스트용 API 생성**

```bash
mkdir -p src/plugins/sample/api
```

```typescript
// src/plugins/sample/api/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: '샘플 플러그인 API 작동 중' })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/plugins/sample/
git commit -m "feat: add sample plugin for infrastructure testing"
```

---

### Task 2: scan-plugins.js 스캔 스크립트

**Files:**
- Create: `scripts/scan-plugins.js`

- [ ] **Step 1: 스캔 스크립트 작성**

```javascript
// scripts/scan-plugins.js
const fs = require('fs')
const path = require('path')

const PLUGINS_DIR = path.join(__dirname, '..', 'src', 'plugins')
const OUTPUT_FILE = path.join(PLUGINS_DIR, '_generated.ts')
const REWRITES_FILE = path.join(PLUGINS_DIR, '_rewrites.ts')
const SCHEMA_BASE = path.join(__dirname, '..', 'prisma', 'schema.base.prisma')
const SCHEMA_OUTPUT = path.join(__dirname, '..', 'prisma', 'schema.prisma')

function scanPlugins() {
  // Ensure plugins dir exists
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true })
  }

  // Read subdirectories, skip _ prefixed
  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
  const folders = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('_'))
    .map(e => e.name)

  // Read each plugin's metadata
  const plugins = []
  const slugs = new Map() // slug -> folder name (for duplicate check)

  for (const folder of folders) {
    const pluginFile = path.join(PLUGINS_DIR, folder, 'plugin.ts')
    if (!fs.existsSync(pluginFile)) {
      console.warn(`[scan-plugins] Warning: ${folder}/ has no plugin.ts, skipping`)
      continue
    }

    // Parse plugin.ts to extract metadata (simple regex-based extraction)
    const content = fs.readFileSync(pluginFile, 'utf-8')
    const getName = (key) => {
      const match = content.match(new RegExp(`${key}:\\s*['"\`]([^'"\`]+)['"\`]`))
      return match ? match[1] : ''
    }
    const getBool = (key) => {
      const match = content.match(new RegExp(`${key}:\\s*(true|false)`))
      return match ? match[1] === 'true' : false
    }

    const name = getName('name') || folder
    const slug = getName('slug') || folder
    const version = getName('version') || '0.0.0'
    const author = getName('author') || ''
    const authorDomain = getName('authorDomain') || ''
    const repository = getName('repository') || ''
    const description = getName('description') || ''
    const defaultEnabled = getBool('defaultEnabled')

    // Slug duplicate check
    if (slugs.has(slug)) {
      console.error(`ERROR: slug '${slug}' conflict!`)
      console.error(`  - src/plugins/${slugs.get(slug)}/plugin.ts`)
      console.error(`  - src/plugins/${folder}/plugin.ts`)
      console.error(`Change one of the slugs to resolve.`)
      process.exit(1)
    }
    slugs.set(slug, folder)

    // Check which convention folders exist
    const hasRoutes = fs.existsSync(path.join(PLUGINS_DIR, folder, 'routes'))
    const hasApi = fs.existsSync(path.join(PLUGINS_DIR, folder, 'api'))
    const hasAdmin = fs.existsSync(path.join(PLUGINS_DIR, folder, 'admin'))
    const hasWidgets = fs.existsSync(path.join(PLUGINS_DIR, folder, 'widgets'))
    const hasMenus = fs.existsSync(path.join(PLUGINS_DIR, folder, 'menus'))
    const hasSchema = fs.existsSync(path.join(PLUGINS_DIR, folder, 'schema.prisma'))

    plugins.push({
      folder, name, slug, version, author, authorDomain, repository,
      description, defaultEnabled, hasRoutes, hasApi, hasAdmin,
      hasWidgets, hasMenus, hasSchema,
    })
  }

  console.log(`[scan-plugins] Found ${plugins.length} plugin(s): ${plugins.map(p => p.folder).join(', ')}`)

  // 1. Generate manifest
  generateManifest(plugins)

  // 2. Generate rewrites
  generateRewrites(plugins)

  // 3. Merge Prisma schemas
  mergeSchemas(plugins)
}

function generateManifest(plugins) {
  const entries = plugins.map(p => {
    return `  '${p.folder}': {
    name: '${p.name}',
    slug: '${p.slug}',
    version: '${p.version}',
    author: '${p.author}',
    authorDomain: '${p.authorDomain}',
    repository: '${p.repository}',
    description: '${p.description}',
    defaultEnabled: ${p.defaultEnabled},
    hasRoutes: ${p.hasRoutes},
    hasApi: ${p.hasApi},
    hasAdmin: ${p.hasAdmin},
    hasWidgets: ${p.hasWidgets},
    hasMenus: ${p.hasMenus},
    hasSchema: ${p.hasSchema},
  }`
  })

  const output = `// AUTO-GENERATED by scripts/scan-plugins.js — do not edit manually

export interface PluginMeta {
  name: string
  slug: string
  version: string
  author: string
  authorDomain: string
  repository: string
  description: string
  defaultEnabled: boolean
  hasRoutes: boolean
  hasApi: boolean
  hasAdmin: boolean
  hasWidgets: boolean
  hasMenus: boolean
  hasSchema: boolean
}

export const pluginManifest: Record<string, PluginMeta> = {
${entries.join(',\n')}
}

export type PluginFolder = keyof typeof pluginManifest
`

  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8')
  console.log(`[scan-plugins] Generated ${OUTPUT_FILE}`)
}

function generateRewrites(plugins) {
  const rewrites = []

  for (const p of plugins) {
    if (p.hasRoutes) {
      rewrites.push(`  { source: '/${p.slug}/:path*', destination: '/plugins/${p.folder}/routes/:path*' }`)
      rewrites.push(`  { source: '/${p.slug}', destination: '/plugins/${p.folder}/routes' }`)
    }
    if (p.hasApi) {
      rewrites.push(`  { source: '/api/${p.slug}/:path*', destination: '/plugins/${p.folder}/api/:path*' }`)
      rewrites.push(`  { source: '/api/${p.slug}', destination: '/plugins/${p.folder}/api' }`)
    }
    if (p.hasAdmin) {
      // Admin pages
      const adminPagePath = path.join(PLUGINS_DIR, p.folder, 'admin', 'page.tsx')
      if (fs.existsSync(adminPagePath)) {
        rewrites.push(`  { source: '/admin/${p.slug}/:path*', destination: '/plugins/${p.folder}/admin/:path*' }`)
        rewrites.push(`  { source: '/admin/${p.slug}', destination: '/plugins/${p.folder}/admin' }`)
      }
      // Admin API
      const adminApiPath = path.join(PLUGINS_DIR, p.folder, 'admin', 'api')
      if (fs.existsSync(adminApiPath)) {
        rewrites.push(`  { source: '/api/admin/${p.slug}/:path*', destination: '/plugins/${p.folder}/admin/api/:path*' }`)
        rewrites.push(`  { source: '/api/admin/${p.slug}', destination: '/plugins/${p.folder}/admin/api' }`)
      }
    }
  }

  const output = `// AUTO-GENERATED by scripts/scan-plugins.js — do not edit manually
import type { Rewrite } from 'next/dist/lib/load-custom-routes'

export const pluginRewrites: Rewrite[] = [
${rewrites.join(',\n')}
]
`

  fs.writeFileSync(REWRITES_FILE, output, 'utf-8')
  console.log(`[scan-plugins] Generated ${REWRITES_FILE}`)
}

function mergeSchemas(plugins) {
  // Read base schema
  let baseSchema = ''
  if (fs.existsSync(SCHEMA_BASE)) {
    baseSchema = fs.readFileSync(SCHEMA_BASE, 'utf-8')
  } else {
    // If no base schema, use current schema.prisma as base (first run)
    const currentSchema = path.join(__dirname, '..', 'prisma', 'schema.prisma')
    if (fs.existsSync(currentSchema)) {
      baseSchema = fs.readFileSync(currentSchema, 'utf-8')
      // Save as base for future runs
      fs.writeFileSync(SCHEMA_BASE, baseSchema, 'utf-8')
      console.log(`[scan-plugins] Created ${SCHEMA_BASE} from existing schema.prisma`)
    }
  }

  // Collect plugin schemas
  const pluginSchemas = []
  for (const p of plugins) {
    if (p.hasSchema) {
      const schemaPath = path.join(PLUGINS_DIR, p.folder, 'schema.prisma')
      const content = fs.readFileSync(schemaPath, 'utf-8')
      pluginSchemas.push(`\n// ======= Plugin: ${p.folder} =======\n${content}`)
    }
  }

  // Merge
  const merged = `// AUTO-GENERATED by scripts/scan-plugins.js — do not edit manually
// Edit prisma/schema.base.prisma for core models
// Edit src/plugins/*/schema.prisma for plugin models

${baseSchema}
${pluginSchemas.join('\n')}
`

  fs.writeFileSync(SCHEMA_OUTPUT, merged, 'utf-8')
  console.log(`[scan-plugins] Merged ${pluginSchemas.length} plugin schema(s) into ${SCHEMA_OUTPUT}`)
}

scanPlugins()
```

- [ ] **Step 2: 실행 테스트**

Run: `node scripts/scan-plugins.js`
Expected:
```
[scan-plugins] Found 1 plugin(s): sample
[scan-plugins] Generated src/plugins/_generated.ts
[scan-plugins] Generated src/plugins/_rewrites.ts
[scan-plugins] Created prisma/schema.base.prisma from existing schema.prisma
[scan-plugins] Merged 0 plugin schema(s) into prisma/schema.prisma
```

- [ ] **Step 3: 생성된 파일 확인**

`src/plugins/_generated.ts`와 `src/plugins/_rewrites.ts`가 올바르게 생성되었는지 확인.

- [ ] **Step 4: Commit**

```bash
git add scripts/scan-plugins.js src/plugins/_generated.ts src/plugins/_rewrites.ts prisma/schema.base.prisma
git commit -m "feat: add plugin scan script with manifest, rewrites, schema merge"
```

---

### Task 3: next.config.ts에 rewrites 연동

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: next.config.ts 수정**

```typescript
// next.config.ts
import type { NextConfig } from "next";
import { pluginRewrites } from "./src/plugins/_rewrites";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async rewrites() {
    return pluginRewrites
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'k.kakaocdn.net',
      },
      {
        protocol: 'http',
        hostname: 'k.kakaocdn.net',
      },
      {
        protocol: 'https',
        hostname: 'phinf.pstatic.net',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: 서버 재시작 후 샘플 플러그인 라우트 테스트**

서버 재시작 후:
- `http://localhost:3200/sample` → "샘플 플러그인 페이지" 표시
- `http://localhost:3200/api/sample` → `{"message":"샘플 플러그인 API 작동 중"}` 반환

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: integrate plugin rewrites into next.config.ts"
```

---

### Task 4: package.json 스크립트 업데이트

**Files:**
- Modify: `package.json`

- [ ] **Step 1: dev/build 스크립트에 scan-plugins 추가**

`package.json`의 `scripts` 섹션 수정:

```json
"dev": "node scripts/scan-plugins.js && next dev --turbopack",
"build": "node scripts/scan-plugins.js && next build",
```

기존에 `scan-layouts.js`가 있었다면 함께:
```json
"dev": "node scripts/scan-plugins.js && node scripts/scan-layouts.js && next dev --turbopack",
"build": "node scripts/scan-plugins.js && node scripts/scan-layouts.js && next build",
```

다른 스크립트는 변경하지 않음.

- [ ] **Step 2: 실행 테스트**

Run: `npm run dev`
Expected: `[scan-plugins] Found 1 plugin(s): sample` 출력 후 Next.js 정상 시작

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add plugin scan to dev and build scripts"
```

---

### Task 5: 플러그인 유틸리티 함수

**Files:**
- Create: `src/lib/plugins.ts`

- [ ] **Step 1: 플러그인 상태 조회 유틸리티 작성**

```typescript
// src/lib/plugins.ts
import { pluginManifest } from '@/plugins/_generated'
import type { PluginMeta } from '@/plugins/_generated'
import { prisma } from '@/lib/prisma'

/**
 * 플러그인의 활성 상태를 DB에서 조회.
 * DB에 값이 없으면 plugin.ts의 defaultEnabled 사용.
 */
export async function isPluginEnabled(folderName: string): Promise<boolean> {
  const plugin = pluginManifest[folderName]
  if (!plugin) return false

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: `plugin_${folderName}_enabled` }
    })

    if (setting) {
      return setting.value === 'true'
    }

    return plugin.defaultEnabled
  } catch {
    return plugin.defaultEnabled
  }
}

/**
 * 플러그인의 현재 slug를 DB에서 조회.
 * DB에 값이 없으면 plugin.ts의 slug 사용.
 */
export async function getPluginSlug(folderName: string): Promise<string> {
  const plugin = pluginManifest[folderName]
  if (!plugin) return folderName

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: `plugin_${folderName}_slug` }
    })

    if (setting && setting.value) {
      return setting.value
    }

    return plugin.slug
  } catch {
    return plugin.slug
  }
}

/**
 * 모든 플러그인 목록을 활성 상태와 함께 반환.
 */
export async function getAllPlugins(): Promise<(PluginMeta & { folder: string, enabled: boolean, currentSlug: string })[]> {
  const results = []

  for (const [folder, meta] of Object.entries(pluginManifest)) {
    const enabled = await isPluginEnabled(folder)
    const currentSlug = await getPluginSlug(folder)
    results.push({ ...meta, folder, enabled, currentSlug })
  }

  return results
}

/**
 * slug로 플러그인 폴더명을 찾는다.
 */
export function getPluginFolderBySlug(slug: string): string | null {
  for (const [folder, meta] of Object.entries(pluginManifest)) {
    if (meta.slug === slug) return folder
  }
  return null
}

/**
 * 비활성 플러그인의 slug 목록을 반환 (미들웨어에서 사용).
 */
export async function getDisabledSlugs(): Promise<string[]> {
  const slugs: string[] = []

  for (const [folder, meta] of Object.entries(pluginManifest)) {
    const enabled = await isPluginEnabled(folder)
    if (!enabled) {
      const slug = await getPluginSlug(folder)
      slugs.push(slug)
    }
  }

  return slugs
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/plugins.ts
git commit -m "feat: add plugin utility functions (enabled check, slug lookup)"
```

---

### Task 6: 미들웨어 — 비활성 플러그인 라우트 차단

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: 미들웨어 작성**

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { pluginManifest } from '@/plugins/_generated'

// 빌드 타임에 알려진 모든 플러그인 slug 목록
const allPluginSlugs = Object.values(pluginManifest).map(p => p.slug)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 플러그인 slug에 해당하는 요청인지 확인
  for (const slug of allPluginSlugs) {
    const isPluginRoute =
      pathname === `/${slug}` ||
      pathname.startsWith(`/${slug}/`) ||
      pathname === `/api/${slug}` ||
      pathname.startsWith(`/api/${slug}/`) ||
      pathname === `/admin/${slug}` ||
      pathname.startsWith(`/admin/${slug}/`) ||
      pathname === `/api/admin/${slug}` ||
      pathname.startsWith(`/api/admin/${slug}/`)

    if (isPluginRoute) {
      // 폴더명 찾기
      const folder = Object.entries(pluginManifest).find(([, meta]) => meta.slug === slug)?.[0]
      if (!folder) continue

      // DB에서 활성 상태 확인 (Setting 테이블 직접 조회)
      try {
        const baseUrl = request.nextUrl.origin
        const res = await fetch(`${baseUrl}/api/settings/plugin-status?folder=${folder}`, {
          headers: { 'x-middleware-check': 'true' },
        })

        if (res.ok) {
          const data = await res.json()
          if (data.enabled === false) {
            // API 요청이면 JSON 404
            if (pathname.startsWith('/api/')) {
              return NextResponse.json(
                { error: '이 기능은 비활성화되었습니다.' },
                { status: 404 }
              )
            }
            // 페이지 요청이면 404 페이지로
            return NextResponse.rewrite(new URL('/not-found', request.url))
          }
        }
      } catch {
        // 체크 실패 시 통과 (서버 시작 중일 수 있음)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // 정적 파일과 내부 경로 제외
    '/((?!_next/static|_next/image|favicon.ico|uploads/).*)',
  ],
}
```

- [ ] **Step 2: 플러그인 상태 확인용 내부 API 생성**

```typescript
// src/app/api/settings/plugin-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'

export async function GET(request: NextRequest) {
  // 미들웨어에서만 호출 가능
  const middlewareCheck = request.headers.get('x-middleware-check')
  if (middlewareCheck !== 'true') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const folder = request.nextUrl.searchParams.get('folder')
  if (!folder || !pluginManifest[folder]) {
    return NextResponse.json({ enabled: true })
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: `plugin_${folder}_enabled` }
    })

    if (setting) {
      return NextResponse.json({ enabled: setting.value === 'true' })
    }

    // DB에 없으면 defaultEnabled 사용
    return NextResponse.json({ enabled: pluginManifest[folder].defaultEnabled })
  } catch {
    return NextResponse.json({ enabled: true })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts src/app/api/settings/plugin-status/route.ts
git commit -m "feat: add middleware to block disabled plugin routes"
```

---

### Task 7: 관리자 플러그인 관리 API

**Files:**
- Create: `src/app/api/admin/plugins/route.ts`
- Create: `src/app/api/admin/plugins/[folder]/route.ts`

- [ ] **Step 1: 플러그인 목록 API**

```typescript
// src/app/api/admin/plugins/route.ts
import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { getAllPlugins } from '@/lib/plugins'

export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const plugins = await getAllPlugins()

    return NextResponse.json({ plugins })
  } catch (error) {
    console.error('플러그인 목록 조회 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 개별 플러그인 활성화/비활성화 + slug 변경 API**

```typescript
// src/app/api/admin/plugins/[folder]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ folder: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { folder } = await params

    if (!pluginManifest[folder]) {
      return NextResponse.json({ error: '존재하지 않는 플러그인입니다.' }, { status: 404 })
    }

    const body = await request.json()
    const { enabled, slug } = body

    // 활성화/비활성화
    if (enabled !== undefined) {
      await prisma.setting.upsert({
        where: { key: `plugin_${folder}_enabled` },
        update: { value: String(enabled) },
        create: { key: `plugin_${folder}_enabled`, value: String(enabled) },
      })
    }

    // slug 변경
    if (slug !== undefined) {
      // 중복 체크
      for (const [otherFolder, meta] of Object.entries(pluginManifest)) {
        if (otherFolder !== folder && meta.slug === slug) {
          return NextResponse.json(
            { error: `slug '${slug}'는 이미 '${meta.name}' 플러그인에서 사용중입니다.` },
            { status: 400 }
          )
        }
      }

      // 다른 플러그인의 DB slug와도 중복 체크
      const existingSlugs = await prisma.setting.findMany({
        where: {
          key: { startsWith: 'plugin_', endsWith: '_slug' },
          NOT: { key: `plugin_${folder}_slug` },
        }
      })
      for (const s of existingSlugs) {
        if (s.value === slug) {
          return NextResponse.json(
            { error: `slug '${slug}'는 이미 다른 플러그인에서 사용중입니다.` },
            { status: 400 }
          )
        }
      }

      await prisma.setting.upsert({
        where: { key: `plugin_${folder}_slug` },
        update: { value: slug },
        create: { key: `plugin_${folder}_slug`, value: slug },
      })
    }

    return NextResponse.json({ success: true, message: '플러그인 설정이 저장되었습니다.' })
  } catch (error) {
    console.error('플러그인 설정 저장 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/plugins/
git commit -m "feat: add admin plugin management API (list, enable/disable, slug change)"
```

---

### Task 8: 관리자 플러그인 관리 페이지

**Files:**
- Create: `src/app/admin/plugins/page.tsx`
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: 플러그인 관리 페이지**

```tsx
// src/app/admin/plugins/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Puzzle, ExternalLink, Save, AlertTriangle } from "lucide-react"

interface PluginInfo {
  folder: string
  name: string
  slug: string
  currentSlug: string
  version: string
  author: string
  authorDomain: string
  repository: string
  description: string
  defaultEnabled: boolean
  enabled: boolean
  hasRoutes: boolean
  hasApi: boolean
  hasAdmin: boolean
  hasWidgets: boolean
  hasMenus: boolean
}

export default function PluginsAdminPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [editingSlugs, setEditingSlugs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const fetchPlugins = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/plugins')
      if (res.ok) {
        const data = await res.json()
        setPlugins(data.plugins || [])
      }
    } catch (error) {
      console.error('플러그인 조회 에러:', error)
    }
  }, [])

  useEffect(() => {
    fetchPlugins()
  }, [fetchPlugins])

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleToggle = async (folder: string, enabled: boolean) => {
    setSaving(folder)
    try {
      const res = await fetch(`/api/admin/plugins/${folder}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (res.ok) {
        showMessage(`${enabled ? '활성화' : '비활성화'} 되었습니다.`)
        await fetchPlugins()
      } else {
        const data = await res.json()
        showMessage(data.error || '저장 실패')
      }
    } catch {
      showMessage('서버 오류')
    } finally {
      setSaving(null)
    }
  }

  const handleSlugSave = async (folder: string) => {
    const newSlug = editingSlugs[folder]
    if (!newSlug) return

    setSaving(folder)
    try {
      const res = await fetch(`/api/admin/plugins/${folder}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: newSlug }),
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('slug가 변경되었습니다. 서버를 재시작해야 적용됩니다.')
        setEditingSlugs(prev => { const n = { ...prev }; delete n[folder]; return n })
        await fetchPlugins()
      } else {
        showMessage(data.error || '저장 실패')
      }
    } catch {
      showMessage('서버 오류')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Puzzle className="h-6 w-6" />
                플러그인 관리
              </h1>
              <p className="text-muted-foreground mt-1">
                설치된 플러그인을 활성화/비활성화하고 URL을 변경합니다
              </p>
            </div>
          </div>

          {message && (
            <div className="mb-4 px-4 py-2 bg-primary/10 text-primary rounded-md text-sm">
              {message}
            </div>
          )}

          <div className="space-y-4">
            {plugins.map((plugin) => (
              <Card key={plugin.folder}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {plugin.name}
                        <Badge variant="outline" className="text-xs">v{plugin.version}</Badge>
                        {plugin.enabled ? (
                          <Badge className="text-xs bg-green-500">활성</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">비활성</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">{plugin.description}</CardDescription>
                    </div>
                    <Switch
                      checked={plugin.enabled}
                      onCheckedChange={(checked) => handleToggle(plugin.folder, checked)}
                      disabled={saving === plugin.folder}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">작성자:</span>{' '}
                      <span>{plugin.author}</span>
                      {plugin.authorDomain && (
                        <a href={plugin.authorDomain} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {plugin.repository && (
                      <div>
                        <span className="text-muted-foreground">저장소:</span>{' '}
                        <a href={plugin.repository} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          GitHub <ExternalLink className="h-3 w-3 inline" />
                        </a>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">기능:</span>{' '}
                      {plugin.hasRoutes && <Badge variant="outline" className="text-xs mr-1">페이지</Badge>}
                      {plugin.hasApi && <Badge variant="outline" className="text-xs mr-1">API</Badge>}
                      {plugin.hasAdmin && <Badge variant="outline" className="text-xs mr-1">관리자</Badge>}
                      {plugin.hasWidgets && <Badge variant="outline" className="text-xs mr-1">위젯</Badge>}
                      {plugin.hasMenus && <Badge variant="outline" className="text-xs mr-1">메뉴</Badge>}
                    </div>
                    <div>
                      <span className="text-muted-foreground">URL 경로:</span>{' '}
                      <code className="text-xs bg-muted px-1 rounded">/{plugin.currentSlug}</code>
                    </div>
                  </div>

                  {/* Slug 변경 */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">URL 경로 변경:</span>
                      <Input
                        className="w-48 h-8 text-sm"
                        value={editingSlugs[plugin.folder] ?? plugin.currentSlug}
                        onChange={(e) => setEditingSlugs(prev => ({ ...prev, [plugin.folder]: e.target.value }))}
                        placeholder={plugin.slug}
                      />
                      {editingSlugs[plugin.folder] && editingSlugs[plugin.folder] !== plugin.currentSlug && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSlugSave(plugin.folder)}
                          disabled={saving === plugin.folder}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          저장
                        </Button>
                      )}
                    </div>
                    {editingSlugs[plugin.folder] && editingSlugs[plugin.folder] !== plugin.currentSlug && (
                      <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        slug 변경 후 서버 재시작이 필요합니다
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {plugins.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                설치된 플러그인이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Sidebar에 플러그인 관리 메뉴 추가**

`src/components/admin/Sidebar.tsx`의 `menuItems` 배열에 추가:

```typescript
{ id: "plugins", label: "플러그인관리", icon: Puzzle, path: "/admin/plugins" },
```

`Puzzle`을 import 목록에 추가:

```typescript
import {
  // ... existing imports ...
  Puzzle,
} from "lucide-react"
```

- [ ] **Step 3: 브라우저에서 확인**

`http://localhost:3200/admin/plugins` 접속. 샘플 플러그인이 표시되고, 활성/비활성 토글이 작동하는지 확인.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/plugins/ src/components/admin/Sidebar.tsx
git commit -m "feat: add admin plugin management page with enable/disable toggle"
```

---

### Task 9: 비활성 플러그인 테스트 및 정리

- [ ] **Step 1: 비활성 테스트**

1. `/admin/plugins`에서 샘플 플러그인 비활성화
2. `/sample` 접근 → 404 확인
3. `/api/sample` 접근 → `{"error":"이 기능은 비활성화되었습니다."}` 확인
4. 다시 활성화 → 정상 접근 확인

- [ ] **Step 2: .gitignore에 자동 생성 파일 정책 결정**

`src/plugins/_generated.ts`와 `src/plugins/_rewrites.ts`는 빌드 시 생성되므로 git에 포함할지 결정. 권장: **포함** (CI에서 스캔 없이도 빌드 가능하도록).

`prisma/schema.prisma`는 자동 생성이므로 `.gitignore`에 추가하고, `prisma/schema.base.prisma`만 추적:

```
# .gitignore에 추가
# prisma/schema.prisma — auto-generated by scan-plugins.js
```

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: plugin infrastructure complete — scan, rewrites, middleware, admin UI"
```
