# i18n Phase 3 — DB 콘텐츠 자동 번역 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DB에 저장된 관리자 콘텐츠(Board/Menu/Content/Policy/HomeWidget/Setting)를 Google Translate API로 저장 시점에 자동 번역해 다국어 방문자에게 노출하고, 관리자는 영문만 입력하면 되는 구조를 만든다.

**Architecture:** 원본은 영문으로 기본 컬럼에 저장. 관리자 저장 시 서버가 Google Cloud Translation v3 API를 호출해 `routing.ts`에 등록된 모든 부언어(`ko` 등)로 번역 후 각 엔티티의 `XTranslation` 테이블에 `source='auto'`로 캐시. 관리자가 탭 UI에서 특정 언어를 수정하면 `source='manual'`로 승격되고, 이후 원본 영문 재수정 시 `auto`만 재번역·`manual`은 보존. 읽기 경로에서는 `resolveTranslation(entity, locale, field)` helper가 locale 일치 row → 영문 fallback 순으로 문자열을 반환.

**Tech Stack:** Next.js 16 App Router · Prisma (MySQL) · next-intl v4 · `@google-cloud/translate` v8 (v3 API)

---

## Scope

**대상 엔티티 (6개):**
1. `Board` (name, description)
2. `Menu` (label)
3. `Content` (title, content) — contents 플러그인
4. `Policy` (title, content) — policies 플러그인
5. `HomeWidget` (title)
6. `Setting` (text-valued keys: site_name 등)

**범위 외:** Post, Comment, Product, Review, Order (사용자 생성), shop 이메일 템플릿 (코드 문자열, Phase 2와 동일 유형).

**지원 언어:** 초기엔 `en`(기본) + `ko`(부언어). 3번째 언어 추가 시 `src/i18n/routing.ts`에 locale 코드 한 줄 추가 + Google API 지원 여부만 확인하면 동작해야 함.

---

## File Structure

**Create:**
- `src/lib/translation/google-client.ts` — Google Translate v3 client (싱글톤, 초기화 실패 graceful)
- `src/lib/translation/translate.ts` — `translateText(text, targetLocale)` / `translateMany(texts, targetLocale)`
- `src/lib/translation/resolver.ts` — `resolveTranslation(entity, locale, field)` / `resolveMany(entities, locale, fields[])`
- `src/lib/translation/auto-translate.ts` — `autoTranslateEntity(entityType, entityId, fields, sourceText)` — 저장 직후 호출되는 공통 헬퍼
- `src/lib/translation/settings.ts` — Setting 전용 helper: `getLocalizedSetting(key, locale)`, `translateSettingOnSave(key, value)`
- `src/components/admin/LocaleTabs.tsx` — 공통 탭 UI (EN/KO 탭, 각 탭마다 필드 그룹 children 렌더)
- `src/components/admin/LocaleField.tsx` — 탭 내부에서 사용하는 텍스트/에디터 필드 래퍼 (source 뱃지, "재번역" 버튼 포함)
- `scripts/backfill-translations.ts` — 초기 데이터 마이그레이션 스크립트 (기존 한국어 DB 값 → 영문 base + KO translation)
- `src/app/api/admin/translations/retranslate/route.ts` — 특정 엔티티 재번역 트리거 API

**Modify (schema):**
- `prisma/schema.base.prisma` — `Menu`, `HomeWidget`, `Setting`에 각각 Translation 테이블 추가
- `src/plugins/boards/schema.prisma` — `Board`에 `BoardTranslation` 추가
- `src/plugins/contents/schema.prisma` — `Content`에 `ContentTranslation` 추가
- `src/plugins/policies/schema.prisma` — `Policy`에 `PolicyTranslation` 추가

**Modify (API routes — 저장 시 auto-translate 호출):**
- `src/app/api/admin/menus/route.ts` (POST/PUT)
- `src/app/api/admin/home-widgets/route.ts` (POST/PUT)
- `src/app/api/admin/settings/route.ts` (PUT)
- `src/plugins/boards/api/route.ts` + `[slug]/route.ts` (관리자 경로)
- `src/plugins/contents/admin/api/route.ts` (추정)
- `src/plugins/policies/admin/api/route.ts` (추정)

**Modify (읽기 API — locale 파라미터 받아 번역 적용):**
- `src/app/api/menus/route.ts`
- `src/app/api/settings/route.ts`
- `src/app/api/home-widgets/route.ts`
- `src/plugins/boards/api/route.ts` (사용자 경로)
- `src/plugins/contents/api/[slug]/route.ts`
- `src/plugins/policies/api/[slug]/route.ts`

**Modify (admin UI — LocaleTabs 적용):**
- `src/app/[locale]/admin/menus/page.tsx`
- `src/app/[locale]/admin/home-widgets/page.tsx`
- `src/app/[locale]/admin/settings/page.tsx`
- `src/plugins/boards/admin/[id]/page.tsx`
- `src/plugins/contents/admin/page.tsx`
- `src/plugins/policies/admin/page.tsx`

**Modify (frontend — locale 전파):**
- `src/lib/SiteContext.tsx` — fetch URL에 `?locale=${locale}` 추가
- `src/layouts/default/HomePage.tsx` — 동일
- `src/plugins/boards/components/BoardListPage.tsx` · `BoardsPage.tsx`
- `src/plugins/boards/widgets/*.tsx` — `/api/boards?locale=${locale}` 호출

**ENV:**
- `.env.example` — `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (service account JSON path) 추가

---

## Key Design Decisions

1. **저장 시점 번역 (Not lazy cache):** 관리자 저장 트랜잭션 내에서 번역 실행. 방문자는 절대 번역 API 지연을 겪지 않는다. 번역 API 장애 시 저장은 성공하고 "일부 언어 번역 실패" 경고만 반환 — 해당 엔티티는 영문으로 fallback된다.
2. **source = 'auto' | 'manual':** 재수정 시 `auto`만 무효화. `manual`은 운영자 손길이 닿은 번역이라 보존.
3. **Setting 전용 패턴:** Setting은 key-value라 별도 `SettingTranslation { key, locale, value, source }` 테이블을 둔다. 번역 대상 key는 상수 리스트(`TRANSLATABLE_SETTING_KEYS`)로 관리 — 모든 key를 번역하지 않는다 (e.g. `signup_enabled`는 불필요).
4. **HTML 번역:** Content/Policy는 Tiptap HTML. Google Translate v3의 `mimeType: 'text/html'`로 태그 보존하며 번역.
5. **Helper 일관성:** 모든 엔티티는 동일한 `resolveTranslation` 시그니처를 사용. Prisma `include: { translations: { where: { locale } } }` 패턴 유지.
6. **locale 쿼리 규약:** 모든 공개 API는 `?locale=en|ko` 쿼리를 받는다. 미지정 시 `routing.defaultLocale`(en) 사용.

---

## Testing Strategy

Nexibase에는 단위 테스트 인프라가 없다 (package.json에 test 스크립트 없음). 이 플랜은 **수동 검증 + `npx next build`로 타입 검증**을 기본으로 한다. 각 Task 끝에 "Manual verification" 블록이 있고, 구체적 확인 단계를 제공한다. 테스트 프레임워크는 플랜 범위 외.

---

## Task 1: Google Translate 클라이언트 의존성 추가

**Files:**
- Modify: `package.json`
- Create: `src/lib/translation/google-client.ts`
- Modify: `.env.example`

- [ ] **Step 1: 패키지 설치**

Run:
```bash
cd /home/kagla/nexibase && npm install @google-cloud/translate@^8
```

Expected: `@google-cloud/translate` 가 dependencies에 추가됨.

- [ ] **Step 2: `.env.example`에 환경변수 예시 추가**

Append to `.env.example`:
```
# Google Cloud Translation API (Phase 3)
GOOGLE_CLOUD_PROJECT_ID="your-gcp-project-id"
GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
```

- [ ] **Step 3: Google client 싱글톤 작성**

Create `src/lib/translation/google-client.ts`:
```typescript
import { v3 } from '@google-cloud/translate'

let client: v3.TranslationServiceClient | null = null
let parent: string | null = null

export function getGoogleTranslateClient() {
  if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
    return null
  }
  if (!client) {
    try {
      client = new v3.TranslationServiceClient()
      parent = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/global`
    } catch (err) {
      console.error('[translation] Google client init failed:', err)
      return null
    }
  }
  return { client, parent: parent! }
}

export function isTranslationEnabled(): boolean {
  return !!process.env.GOOGLE_CLOUD_PROJECT_ID
}
```

- [ ] **Step 4: Build 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -20`
Expected: 오류 없음. `@google-cloud/translate` import 성공.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/translation/google-client.ts
git commit -m "feat(i18n-phase3): Google Translate v3 client setup"
```

---

## Task 2: 번역 실행 헬퍼 (`translateText` / `translateMany`)

**Files:**
- Create: `src/lib/translation/translate.ts`

- [ ] **Step 1: translate.ts 작성**

Create `src/lib/translation/translate.ts`:
```typescript
import { getGoogleTranslateClient, isTranslationEnabled } from './google-client'
import { routing } from '@/i18n/routing'

export interface TranslateOptions {
  sourceLocale?: string   // default: routing.defaultLocale ('en')
  mimeType?: 'text/plain' | 'text/html'  // default: 'text/plain'
}

/**
 * 단일 문자열을 target locale로 번역.
 * 실패 시 null 반환 (호출 측이 fallback 결정).
 */
export async function translateText(
  text: string,
  targetLocale: string,
  options: TranslateOptions = {}
): Promise<string | null> {
  if (!isTranslationEnabled()) return null
  if (!text || !text.trim()) return text

  const source = options.sourceLocale ?? routing.defaultLocale
  if (source === targetLocale) return text

  const gc = getGoogleTranslateClient()
  if (!gc) return null

  try {
    const [response] = await gc.client.translateText({
      parent: gc.parent,
      contents: [text],
      mimeType: options.mimeType ?? 'text/plain',
      sourceLanguageCode: source,
      targetLanguageCode: targetLocale,
    })
    return response.translations?.[0]?.translatedText ?? null
  } catch (err) {
    console.error(`[translation] translateText(${targetLocale}) failed:`, err)
    return null
  }
}

/**
 * 여러 문자열을 한 번의 API 호출로 번역. 순서 보존.
 * 실패 시 null 배열 반환 ([null, null, ...]).
 */
export async function translateMany(
  texts: string[],
  targetLocale: string,
  options: TranslateOptions = {}
): Promise<(string | null)[]> {
  if (!isTranslationEnabled() || texts.length === 0) {
    return texts.map(() => null)
  }
  const source = options.sourceLocale ?? routing.defaultLocale
  if (source === targetLocale) return texts.map(t => t)

  const gc = getGoogleTranslateClient()
  if (!gc) return texts.map(() => null)

  try {
    const [response] = await gc.client.translateText({
      parent: gc.parent,
      contents: texts,
      mimeType: options.mimeType ?? 'text/plain',
      sourceLanguageCode: source,
      targetLanguageCode: targetLocale,
    })
    return (response.translations ?? []).map(t => t.translatedText ?? null)
  } catch (err) {
    console.error(`[translation] translateMany(${targetLocale}) failed:`, err)
    return texts.map(() => null)
  }
}

/**
 * routing.locales에서 defaultLocale을 제외한 부언어 목록.
 */
export function getSubLocales(): string[] {
  return routing.locales.filter(l => l !== routing.defaultLocale)
}
```

- [ ] **Step 2: Build 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -10`
Expected: 타입 오류 없음.

- [ ] **Step 3: Commit**

```bash
git add src/lib/translation/translate.ts
git commit -m "feat(i18n-phase3): translateText/translateMany helper"
```

---

## Task 3: Prisma 스키마 — 번역 테이블 추가

**Files:**
- Modify: `prisma/schema.base.prisma`
- Modify: `src/plugins/boards/schema.prisma`
- Modify: `src/plugins/contents/schema.prisma`
- Modify: `src/plugins/policies/schema.prisma`

- [ ] **Step 1: `schema.base.prisma` — Menu/HomeWidget/Setting Translation 추가**

Append to `prisma/schema.base.prisma` (models 섹션 뒤에 순서대로):

```prisma
model MenuTranslation {
  id        Int      @id @default(autoincrement())
  menuId    Int
  locale    String   @db.VarChar(10)
  label     String   @db.VarChar(100)
  source    String   @default("auto") @db.VarChar(10)
  updatedAt DateTime @updatedAt
  menu      Menu     @relation(fields: [menuId], references: [id], onDelete: Cascade)

  @@unique([menuId, locale])
  @@index([menuId])
  @@map("menu_translations")
}

model HomeWidgetTranslation {
  id         Int        @id @default(autoincrement())
  widgetId   Int
  locale     String     @db.VarChar(10)
  title      String     @db.VarChar(100)
  source     String     @default("auto") @db.VarChar(10)
  updatedAt  DateTime   @updatedAt
  widget     HomeWidget @relation(fields: [widgetId], references: [id], onDelete: Cascade)

  @@unique([widgetId, locale])
  @@index([widgetId])
  @@map("home_widget_translations")
}

model SettingTranslation {
  id        Int      @id @default(autoincrement())
  key       String   @db.VarChar(100)
  locale    String   @db.VarChar(10)
  value     String   @db.Text
  source    String   @default("auto") @db.VarChar(10)
  updatedAt DateTime @updatedAt
  setting   Setting  @relation(fields: [key], references: [key], onDelete: Cascade)

  @@unique([key, locale])
  @@index([key])
  @@map("setting_translations")
}
```

그리고 기존 `Menu`/`HomeWidget`/`Setting` 모델에 relation 추가:

```prisma
model Menu {
  // ... 기존 필드 ...
  translations MenuTranslation[]
  // ... 기존 @@index ...
}

model HomeWidget {
  // ... 기존 필드 ...
  translations HomeWidgetTranslation[]
  // ... 기존 @@index ...
}

model Setting {
  // ... 기존 필드 ...
  translations SettingTranslation[]
  // ... 기존 @@map ...
}
```

- [ ] **Step 2: `boards/schema.prisma` — BoardTranslation 추가**

Append to `src/plugins/boards/schema.prisma`:
```prisma
model BoardTranslation {
  id          Int      @id @default(autoincrement())
  boardId     Int
  locale      String   @db.VarChar(10)
  name        String   @db.VarChar(100)
  description String?  @db.VarChar(500)
  source      String   @default("auto") @db.VarChar(10)
  updatedAt   DateTime @updatedAt
  board       Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@unique([boardId, locale])
  @@index([boardId])
  @@map("board_translations")
}
```

And add to `Board` model:
```prisma
model Board {
  // ... 기존 필드 ...
  translations BoardTranslation[]
  // ... 기존 @@index ...
}
```

- [ ] **Step 3: `contents/schema.prisma` — ContentTranslation 추가**

Replace entire `src/plugins/contents/schema.prisma` with:
```prisma
model Content {
  id           Int                  @id @default(autoincrement())
  slug         String               @unique @db.VarChar(100)
  title        String               @db.VarChar(200)
  content      String               @db.LongText
  isPublic     Boolean              @default(true)
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt
  translations ContentTranslation[]

  @@index([slug])
  @@index([isPublic])
  @@map("contents")
}

model ContentTranslation {
  id        Int      @id @default(autoincrement())
  contentId Int
  locale    String   @db.VarChar(10)
  title     String   @db.VarChar(200)
  content   String   @db.LongText
  source    String   @default("auto") @db.VarChar(10)
  updatedAt DateTime @updatedAt
  parent    Content  @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([contentId, locale])
  @@index([contentId])
  @@map("content_translations")
}
```

- [ ] **Step 4: `policies/schema.prisma` — PolicyTranslation 추가**

Replace entire `src/plugins/policies/schema.prisma` with:
```prisma
model Policy {
  id           Int                 @id @default(autoincrement())
  slug         String              @db.VarChar(100)
  version      String              @db.VarChar(20)
  title        String              @db.VarChar(200)
  content      String              @db.LongText
  isActive     Boolean             @default(false)
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
  translations PolicyTranslation[]

  @@unique([slug, version])
  @@index([slug, isActive])
  @@map("policies")
}

model PolicyTranslation {
  id        Int      @id @default(autoincrement())
  policyId  Int
  locale    String   @db.VarChar(10)
  title     String   @db.VarChar(200)
  content   String   @db.LongText
  source    String   @default("auto") @db.VarChar(10)
  updatedAt DateTime @updatedAt
  policy    Policy   @relation(fields: [policyId], references: [id], onDelete: Cascade)

  @@unique([policyId, locale])
  @@index([policyId])
  @@map("policy_translations")
}
```

- [ ] **Step 5: 통합 스키마 생성 (scan-plugins)**

Run: `cd /home/kagla/nexibase && node scripts/scan-plugins.js`
Expected: `prisma/schema.prisma`가 재생성되고 6개 새 모델이 포함됨.

Verify: `grep -c "Translation" prisma/schema.prisma`
Expected: 6 이상

- [ ] **Step 6: 마이그레이션 생성·적용**

Run:
```bash
cd /home/kagla/nexibase && npx prisma migrate dev --name add_content_translations
```
Expected: 새 마이그레이션 폴더 생성, 6개 테이블 생성 성공.

- [ ] **Step 7: Prisma Client 재생성 확인**

Run: `npx prisma generate`
Expected: 성공. `node_modules/.prisma/client`에 새 타입 반영.

- [ ] **Step 8: Build 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 타입 오류 없음.

- [ ] **Step 9: Commit**

```bash
git add prisma/ src/plugins/boards/schema.prisma src/plugins/contents/schema.prisma src/plugins/policies/schema.prisma
git commit -m "feat(i18n-phase3): add translation tables for Board/Menu/Content/Policy/HomeWidget/Setting"
```

---

## Task 4: 번역 해석 헬퍼 (`resolveTranslation`)

**Files:**
- Create: `src/lib/translation/resolver.ts`

- [ ] **Step 1: resolver.ts 작성**

Create `src/lib/translation/resolver.ts`:
```typescript
import { routing } from '@/i18n/routing'

interface TranslationRow {
  locale: string
  [field: string]: unknown
}

interface EntityWithTranslations {
  translations?: TranslationRow[]
}

/**
 * 엔티티의 특정 필드를 locale에 맞게 해석.
 * 1. locale === defaultLocale이면 원본 필드 즉시 반환
 * 2. translations 배열에서 locale 일치 row를 찾아 해당 필드 반환
 * 3. 없으면 원본 필드로 fallback
 */
export function resolveTranslation<
  T extends EntityWithTranslations & Record<string, unknown>
>(
  entity: T,
  locale: string,
  field: keyof T & string
): string | null {
  const baseValue = entity[field]
  const baseStr = typeof baseValue === 'string' ? baseValue : baseValue == null ? null : String(baseValue)

  if (locale === routing.defaultLocale) return baseStr

  const t = entity.translations?.find(row => row.locale === locale)
  if (t && typeof t[field] === 'string' && t[field]) {
    return t[field] as string
  }
  return baseStr
}

/**
 * 엔티티 객체를 locale에 맞게 평탄화 — translations 배열을 제거하고
 * 지정된 필드들을 번역된 값으로 덮어쓴 새 객체 반환.
 */
export function flattenTranslation<
  T extends EntityWithTranslations & Record<string, unknown>
>(
  entity: T,
  locale: string,
  fields: (keyof T & string)[]
): Omit<T, 'translations'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { translations, ...rest } = entity
  const result: Record<string, unknown> = { ...rest }
  for (const f of fields) {
    result[f] = resolveTranslation(entity, locale, f)
  }
  return result as Omit<T, 'translations'>
}

/**
 * 엔티티 배열을 평탄화.
 */
export function flattenTranslations<
  T extends EntityWithTranslations & Record<string, unknown>
>(
  entities: T[],
  locale: string,
  fields: (keyof T & string)[]
): Omit<T, 'translations'>[] {
  return entities.map(e => flattenTranslation(e, locale, fields))
}

/**
 * Next.js API route에서 locale 쿼리 파라미터 파싱.
 */
export function getLocaleFromRequest(req: Request): string {
  const url = new URL(req.url)
  const locale = url.searchParams.get('locale')
  if (locale && routing.locales.includes(locale as typeof routing.locales[number])) {
    return locale
  }
  return routing.defaultLocale
}
```

- [ ] **Step 2: Build 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 타입 오류 없음.

- [ ] **Step 3: Commit**

```bash
git add src/lib/translation/resolver.ts
git commit -m "feat(i18n-phase3): resolveTranslation/flattenTranslation helper"
```

---

## Task 5: 저장 시점 자동 번역 헬퍼 (`autoTranslateEntity`)

**Files:**
- Create: `src/lib/translation/auto-translate.ts`

- [ ] **Step 1: auto-translate.ts 작성**

Create `src/lib/translation/auto-translate.ts`:
```typescript
import { prisma } from '@/lib/prisma'
import { translateMany, getSubLocales } from './translate'

/**
 * 지원되는 엔티티 타입과 각 엔티티의 Prisma delegate·unique 키 매핑.
 * 새 엔티티 추가 시 이 객체에 항목 한 줄만 넣으면 auto-translate 지원 확장됨.
 */
interface EntitySpec {
  // Prisma translation model delegate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delegate: any
  // Foreign key field name (e.g. 'boardId', 'menuId')
  fkField: string
  // Fields to translate (order matters — will be passed in same order to translateMany)
  fields: readonly string[]
  // For HTML-bearing fields
  htmlFields?: readonly string[]
}

export const TRANSLATION_ENTITY_SPECS = {
  board: {
    delegate: () => prisma.boardTranslation,
    fkField: 'boardId',
    fields: ['name', 'description'],
  },
  menu: {
    delegate: () => prisma.menuTranslation,
    fkField: 'menuId',
    fields: ['label'],
  },
  homeWidget: {
    delegate: () => prisma.homeWidgetTranslation,
    fkField: 'widgetId',
    fields: ['title'],
  },
  content: {
    delegate: () => prisma.contentTranslation,
    fkField: 'contentId',
    fields: ['title', 'content'],
    htmlFields: ['content'],
  },
  policy: {
    delegate: () => prisma.policyTranslation,
    fkField: 'policyId',
    fields: ['title', 'content'],
    htmlFields: ['content'],
  },
} as const

export type TranslatableEntityType = keyof typeof TRANSLATION_ENTITY_SPECS

export interface AutoTranslateResult {
  locale: string
  success: boolean
  error?: string
}

/**
 * 엔티티가 저장/수정된 직후 호출.
 * - 모든 부언어(en 제외)에 대해 번역 실행
 * - source='auto' 레코드만 upsert (source='manual' 은 보존)
 * - 필드 중 null/빈 문자열은 번역 건너뜀
 *
 * @param entityType 'board' | 'menu' | ...
 * @param entityId 해당 엔티티의 primary id
 * @param values { fieldName: englishText } 매핑
 * @returns 각 locale별 성공/실패 결과
 */
export async function autoTranslateEntity(
  entityType: TranslatableEntityType,
  entityId: number,
  values: Record<string, string | null>
): Promise<AutoTranslateResult[]> {
  const spec = TRANSLATION_ENTITY_SPECS[entityType]
  const delegate = spec.delegate()
  const subLocales = getSubLocales()
  const results: AutoTranslateResult[] = []

  const fields = spec.fields.filter(f => values[f] != null && values[f] !== '')
  if (fields.length === 0) return results

  for (const locale of subLocales) {
    try {
      // 필드별 개별 호출 (html/plain mimeType 구분이 필요하므로)
      const translated: Record<string, string | null> = {}
      for (const field of fields) {
        const isHtml = spec.htmlFields?.includes(field) ?? false
        const [result] = await translateMany(
          [values[field] as string],
          locale,
          { mimeType: isHtml ? 'text/html' : 'text/plain' }
        )
        translated[field] = result
      }

      // 모두 null이면 API 실패
      if (Object.values(translated).every(v => v === null)) {
        results.push({ locale, success: false, error: 'translation API returned null for all fields' })
        continue
      }

      // 기존 row 확인 (manual이면 skip)
      const existing = await delegate.findUnique({
        where: { [`${spec.fkField}_locale`]: { [spec.fkField]: entityId, locale } }
      })
      if (existing?.source === 'manual') {
        results.push({ locale, success: true })
        continue
      }

      const data: Record<string, unknown> = {
        [spec.fkField]: entityId,
        locale,
        source: 'auto',
      }
      for (const field of fields) {
        // 번역 실패한 필드는 영문 원본으로 fallback
        data[field] = translated[field] ?? values[field]
      }

      await delegate.upsert({
        where: { [`${spec.fkField}_locale`]: { [spec.fkField]: entityId, locale } },
        create: data,
        update: data,
      })
      results.push({ locale, success: true })
    } catch (err) {
      console.error(`[auto-translate] ${entityType}#${entityId} ${locale} failed:`, err)
      results.push({ locale, success: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return results
}

/**
 * 원본 영문 필드 수정 시 호출. source='auto' 레코드를 삭제해 재번역을 유도.
 * source='manual' 레코드는 보존.
 */
export async function invalidateAutoTranslations(
  entityType: TranslatableEntityType,
  entityId: number
): Promise<void> {
  const spec = TRANSLATION_ENTITY_SPECS[entityType]
  const delegate = spec.delegate()
  await delegate.deleteMany({
    where: { [spec.fkField]: entityId, source: 'auto' },
  })
}
```

- [ ] **Step 2: Build 검증**

Run: `npx next build 2>&1 | tail -20`
Expected: 타입 오류 없음.

- [ ] **Step 3: Commit**

```bash
git add src/lib/translation/auto-translate.ts
git commit -m "feat(i18n-phase3): autoTranslateEntity / invalidateAutoTranslations"
```

---

## Task 6: Setting 전용 헬퍼 (`getLocalizedSetting` / `translateSettingOnSave`)

**Files:**
- Create: `src/lib/translation/settings.ts`

- [ ] **Step 1: settings.ts 작성**

Create `src/lib/translation/settings.ts`:
```typescript
import { prisma } from '@/lib/prisma'
import { translateMany, getSubLocales } from './translate'
import { routing } from '@/i18n/routing'

/**
 * 번역 대상 setting key 화이트리스트.
 * 불린/ID 값(signup_enabled 등)은 번역 대상이 아니므로 여기 명시된 key만 번역된다.
 */
export const TRANSLATABLE_SETTING_KEYS: readonly string[] = [
  'site_name',
  'site_description',
  'footer_text',
]

export function isTranslatableSettingKey(key: string): boolean {
  return TRANSLATABLE_SETTING_KEYS.includes(key)
}

/**
 * 특정 setting key를 locale에 맞게 읽는다.
 * 1. locale === defaultLocale → 원본 Setting.value
 * 2. SettingTranslation에서 (key, locale) 조회 → 없으면 원본 fallback
 */
export async function getLocalizedSetting(
  key: string,
  locale: string
): Promise<string | null> {
  const base = await prisma.setting.findUnique({ where: { key } })
  if (!base) return null
  if (locale === routing.defaultLocale) return base.value
  if (!isTranslatableSettingKey(key)) return base.value

  const t = await prisma.settingTranslation.findUnique({
    where: { key_locale: { key, locale } },
  })
  return t?.value ?? base.value
}

/**
 * 여러 setting을 한 번에 읽어 { key: value } 객체로 반환.
 * 번역 대상 키는 locale에 맞게 해석, 나머지는 원본 그대로.
 */
export async function getLocalizedSettings(
  locale: string
): Promise<Record<string, string>> {
  const [baseSettings, translations] = await Promise.all([
    prisma.setting.findMany(),
    locale !== routing.defaultLocale
      ? prisma.settingTranslation.findMany({ where: { locale } })
      : Promise.resolve([]),
  ])

  const translationMap = new Map(translations.map(t => [t.key, t.value]))
  const result: Record<string, string> = {}
  for (const s of baseSettings) {
    if (locale !== routing.defaultLocale && isTranslatableSettingKey(s.key)) {
      result[s.key] = translationMap.get(s.key) ?? s.value
    } else {
      result[s.key] = s.value
    }
  }
  return result
}

/**
 * 관리자가 setting을 저장한 직후 호출.
 * 번역 대상 key인 경우에만 모든 부언어에 대해 자동 번역해서 SettingTranslation upsert.
 */
export async function translateSettingOnSave(
  key: string,
  englishValue: string
): Promise<void> {
  if (!isTranslatableSettingKey(key)) return
  if (!englishValue || !englishValue.trim()) return

  const subLocales = getSubLocales()

  for (const locale of subLocales) {
    try {
      // manual 레코드는 보존
      const existing = await prisma.settingTranslation.findUnique({
        where: { key_locale: { key, locale } },
      })
      if (existing?.source === 'manual') continue

      const [translated] = await translateMany([englishValue], locale)
      if (translated == null) continue  // API 실패 → 다음 locale

      await prisma.settingTranslation.upsert({
        where: { key_locale: { key, locale } },
        create: { key, locale, value: translated, source: 'auto' },
        update: { value: translated, source: 'auto' },
      })
    } catch (err) {
      console.error(`[translateSettingOnSave] ${key}/${locale} failed:`, err)
    }
  }
}

/**
 * 원본 setting 값 변경 시 source='auto' 레코드 삭제 (재번역 유도).
 */
export async function invalidateSettingTranslations(key: string): Promise<void> {
  await prisma.settingTranslation.deleteMany({
    where: { key, source: 'auto' },
  })
}
```

- [ ] **Step 2: Build 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 타입 오류 없음.

- [ ] **Step 3: Commit**

```bash
git add src/lib/translation/settings.ts
git commit -m "feat(i18n-phase3): Setting 전용 localized getter 및 저장 훅"
```

---

## Task 7: Admin 공통 LocaleTabs 컴포넌트

**Files:**
- Create: `src/components/admin/LocaleTabs.tsx`
- Create: `src/components/admin/LocaleField.tsx`

- [ ] **Step 1: LocaleTabs.tsx 작성**

Create `src/components/admin/LocaleTabs.tsx`:
```typescript
"use client"

import { useState, ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { routing } from '@/i18n/routing'
import { Badge } from '@/components/ui/badge'

interface LocaleTabsProps {
  /**
   * 각 locale별 컨텐츠 렌더러. 첫 번째 탭은 defaultLocale.
   */
  renderTab: (locale: string, isDefault: boolean) => ReactNode
  /**
   * 각 locale의 번역 상태 — 'auto' | 'manual' | 'missing'
   */
  getStatus?: (locale: string) => 'auto' | 'manual' | 'missing' | undefined
}

export function LocaleTabs({ renderTab, getStatus }: LocaleTabsProps) {
  const [active, setActive] = useState<string>(routing.defaultLocale)

  const localeLabel: Record<string, string> = {
    en: 'EN',
    ko: 'KO',
  }

  return (
    <Tabs value={active} onValueChange={setActive} className="w-full">
      <TabsList className="w-full justify-start">
        {routing.locales.map(locale => {
          const status = getStatus?.(locale)
          return (
            <TabsTrigger key={locale} value={locale} className="flex items-center gap-2">
              {localeLabel[locale] ?? locale.toUpperCase()}
              {status === 'auto' && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">auto</Badge>
              )}
              {status === 'manual' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary text-primary">manual</Badge>
              )}
              {status === 'missing' && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">—</Badge>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
      {routing.locales.map(locale => (
        <TabsContent key={locale} value={locale} className="mt-4 space-y-4">
          {renderTab(locale, locale === routing.defaultLocale)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
```

- [ ] **Step 2: LocaleField 사용 예시를 JSDoc으로 추가**

Create `src/components/admin/LocaleField.tsx`:
```typescript
"use client"

import { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface LocaleFieldProps {
  label: string
  helperText?: string
  /**
   * 부언어 탭에서만 표시되는 힌트 (e.g. "비워두면 영문 원본으로 노출됩니다")
   */
  subLocaleHint?: string
  isDefaultLocale: boolean
  children: ReactNode
}

/**
 * LocaleTabs 내부에서 각 필드를 감싸는 래퍼.
 * 부언어 탭에서 "자동 번역됨 / 수정하면 수동 번역으로 승격됨" 안내를 표시.
 */
export function LocaleField({ label, helperText, subLocaleHint, isDefaultLocale, children }: LocaleFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      {!isDefaultLocale && subLocaleHint && (
        <p className="text-xs text-muted-foreground italic">{subLocaleHint}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Build 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 오류 없음.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/LocaleTabs.tsx src/components/admin/LocaleField.tsx
git commit -m "feat(i18n-phase3): LocaleTabs/LocaleField admin 공통 컴포넌트"
```

---

## Task 8: Board API 통합 (읽기 locale 분기 + 저장 auto-translate)

**Files:**
- Modify: `src/plugins/boards/api/route.ts`
- Modify: `src/plugins/boards/api/[slug]/route.ts` (존재 시)

- [ ] **Step 1: Board 읽기 API에 locale 처리 추가**

Read `src/plugins/boards/api/route.ts` first, then modify the GET handler to:
1. Import `getLocaleFromRequest` and `flattenTranslations` from `@/lib/translation/resolver`
2. Parse locale from request
3. Include translations in Prisma query scoped to that locale
4. Flatten response

예시 패턴:
```typescript
import { getLocaleFromRequest, flattenTranslations } from '@/lib/translation/resolver'

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req)
  // ... 기존 where 조건 ...
  const boards = await prisma.board.findMany({
    where: { /* ... */ },
    include: {
      translations: { where: { locale } },
    },
    orderBy: { /* ... */ },
  })
  const localized = flattenTranslations(boards, locale, ['name', 'description'])
  return NextResponse.json({ boards: localized })
}
```

- [ ] **Step 2: Board 관리자 저장 API에 auto-translate 훅 추가**

Find the admin POST/PATCH handler (check `src/plugins/boards/admin/api/` or similar). After successful `prisma.board.create` / `prisma.board.update`:

```typescript
import { autoTranslateEntity, invalidateAutoTranslations } from '@/lib/translation/auto-translate'

// Create case:
const created = await prisma.board.create({ data })
await autoTranslateEntity('board', created.id, {
  name: created.name,
  description: created.description,
})

// Update case (name/description 변경 시):
const nameChanged = existing.name !== data.name
const descChanged = existing.description !== data.description
const updated = await prisma.board.update({ where: { id }, data })
if (nameChanged || descChanged) {
  await invalidateAutoTranslations('board', id)
  await autoTranslateEntity('board', id, {
    name: updated.name,
    description: updated.description,
  })
}
```

- [ ] **Step 3: Board 관리자 API — 수동 번역 저장 지원**

관리자 UI가 KO 탭에서 직접 번역을 수정하면 `source='manual'`로 저장하는 엔드포인트가 필요. 기존 update 페이로드에 optional `translations: Record<locale, { name, description }>` 필드를 받는다:

```typescript
if (body.translations) {
  for (const [locale, fields] of Object.entries(body.translations)) {
    await prisma.boardTranslation.upsert({
      where: { boardId_locale: { boardId: id, locale } },
      create: { boardId: id, locale, ...fields, source: 'manual' },
      update: { ...fields, source: 'manual' },
    })
  }
}
```

- [ ] **Step 4: Build 검증 + 수동 확인**

Run: `npx next build 2>&1 | tail -20`
Expected: 오류 없음.

Manual verification:
1. `npx next dev` 기동 후 `/en/admin/boards`에서 게시판 생성
2. API 로그에서 `[auto-translate]` 메시지 관찰 (성공 or 실패)
3. DB 직접 조회: `SELECT * FROM board_translations WHERE boardId = <new id>`
4. `/ko/boards/<slug>` 접속 → 한국어 이름/설명 노출 확인
5. Google API 키 미설정 시에도 저장은 성공하고 fallback으로 영문 노출 확인

- [ ] **Step 5: Commit**

```bash
git add src/plugins/boards/api/ src/plugins/boards/admin/api/
git commit -m "feat(i18n-phase3): Board API auto-translate + locale resolve"
```

---

## Task 9: Board Admin UI (LocaleTabs 적용)

**Files:**
- Modify: `src/plugins/boards/admin/[id]/page.tsx`
- Modify: `src/plugins/boards/admin/page.tsx` (목록 페이지, 필요 시)

- [ ] **Step 1: Board edit 페이지에 LocaleTabs 통합**

기존 폼 구조를 LocaleTabs로 감싼다. EN 탭은 원본 필드(`name`, `description`)에 binding, KO 탭은 별도 state `koTranslation: { name, description }`에 binding.

```typescript
import { LocaleTabs } from '@/components/admin/LocaleTabs'
import { LocaleField } from '@/components/admin/LocaleField'
import { routing } from '@/i18n/routing'

// State:
const [form, setForm] = useState({ name: '', description: '' })
const [translations, setTranslations] = useState<Record<string, { name: string; description: string; source: 'auto' | 'manual' | 'missing' }>>({})

// 로드 시 API 응답에서 translations 파싱 후 state 초기화
// (board fetch에 include: { translations: true } 필요)

// 렌더:
<LocaleTabs
  getStatus={(locale) => locale === routing.defaultLocale ? undefined : translations[locale]?.source ?? 'missing'}
  renderTab={(locale, isDefault) => {
    if (isDefault) {
      return (
        <>
          <LocaleField label="게시판 이름" isDefaultLocale>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </LocaleField>
          <LocaleField label="설명" isDefaultLocale>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </LocaleField>
        </>
      )
    }
    const tr = translations[locale] ?? { name: '', description: '', source: 'missing' as const }
    return (
      <>
        <LocaleField
          label="게시판 이름"
          isDefaultLocale={false}
          subLocaleHint="비워두면 영문 원본이 노출됩니다. 수정하면 수동 번역으로 전환됩니다."
        >
          <Input
            value={tr.name}
            onChange={e => setTranslations({
              ...translations,
              [locale]: { ...tr, name: e.target.value, source: 'manual' }
            })}
          />
        </LocaleField>
        <LocaleField label="설명" isDefaultLocale={false}>
          <Textarea
            value={tr.description}
            onChange={e => setTranslations({
              ...translations,
              [locale]: { ...tr, description: e.target.value, source: 'manual' }
            })}
          />
        </LocaleField>
      </>
    )
  }}
/>
```

저장 시 payload:
```typescript
const payload = {
  ...form,
  translations: Object.fromEntries(
    Object.entries(translations)
      .filter(([, v]) => v.source === 'manual')
      .map(([loc, v]) => [loc, { name: v.name, description: v.description }])
  ),
}
```

- [ ] **Step 2: Build 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 오류 없음.

Manual verification:
1. `/en/admin/boards/<id>` 접속 → EN/KO 탭 표시 확인
2. EN 탭에서 이름 변경 → 저장 → DB 확인 (`board.name` 업데이트, `board_translations` auto 갱신)
3. KO 탭에서 직접 수정 → 저장 → DB에 `source='manual'` 확인
4. EN 탭 재수정 → 저장 → KO `source='manual'` 레코드 보존 확인

- [ ] **Step 3: Commit**

```bash
git add src/plugins/boards/admin/
git commit -m "feat(i18n-phase3): Board admin UI에 LocaleTabs 적용"
```

---

## Task 10: Menu API + Admin UI 통합

**Files:**
- Modify: `src/app/api/menus/route.ts`
- Modify: `src/app/api/admin/menus/route.ts`
- Modify: `src/app/[locale]/admin/menus/page.tsx`

**Pattern:** Task 8·9와 동일. 필드는 `label` 하나뿐이라 단순함.

- [ ] **Step 1: `src/app/api/menus/route.ts` GET — locale 분기**

```typescript
import { getLocaleFromRequest, flattenTranslations } from '@/lib/translation/resolver'

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req)
  const position = new URL(req.url).searchParams.get('position')
  const menus = await prisma.menu.findMany({
    where: { position: position ?? undefined, isActive: true },
    include: { translations: { where: { locale } } },
    orderBy: { sortOrder: 'asc' },
  })
  const localized = flattenTranslations(menus, locale, ['label'])
  return NextResponse.json({ menus: localized })
}
```

- [ ] **Step 2: 관리자 POST/PATCH에 auto-translate + manual translations 적용**

Same pattern as Task 8 Step 2 & 3, using entity type `'menu'`:
```typescript
await autoTranslateEntity('menu', created.id, { label: created.label })
```

그리고 body.translations 처리:
```typescript
if (body.translations) {
  for (const [locale, fields] of Object.entries(body.translations)) {
    await prisma.menuTranslation.upsert({
      where: { menuId_locale: { menuId: id, locale } },
      create: { menuId: id, locale, ...fields, source: 'manual' },
      update: { ...fields, source: 'manual' },
    })
  }
}
```

- [ ] **Step 3: Menu 관리자 폼에 LocaleTabs 적용**

Task 9 Step 1과 동일 패턴. 필드는 `label` 한 개.

```typescript
<LocaleTabs
  getStatus={(locale) => locale === routing.defaultLocale ? undefined : translations[locale]?.source ?? 'missing'}
  renderTab={(locale, isDefault) => {
    if (isDefault) {
      return (
        <LocaleField label="메뉴 라벨" isDefaultLocale>
          <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
        </LocaleField>
      )
    }
    const tr = translations[locale] ?? { label: '', source: 'missing' as const }
    return (
      <LocaleField
        label="메뉴 라벨"
        isDefaultLocale={false}
        subLocaleHint="비워두면 영문 원본이 노출됩니다."
      >
        <Input
          value={tr.label}
          onChange={e => setTranslations({
            ...translations,
            [locale]: { ...tr, label: e.target.value, source: 'manual' }
          })}
        />
      </LocaleField>
    )
  }}
/>
```

- [ ] **Step 4: Build + 수동 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 오류 없음.

Manual: 메뉴 생성·수정 → DB에 `menu_translations` 레코드 확인 → `/ko` 헤더에서 번역된 라벨 노출 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/menus/ src/app/api/admin/menus/ src/app/\[locale\]/admin/menus/
git commit -m "feat(i18n-phase3): Menu API + admin UI 번역 통합"
```

---

## Task 11: HomeWidget API + Admin UI 통합

**Files:**
- Modify: `src/app/api/home-widgets/route.ts`
- Modify: `src/app/api/admin/home-widgets/route.ts`
- Modify: `src/app/[locale]/admin/home-widgets/page.tsx`

**Pattern:** Task 10과 동일. 필드는 `title` 하나.

- [ ] **Step 1: 읽기 API locale 분기**

Same pattern as Task 10 Step 1, delegate `prisma.homeWidget`, fields `['title']`.

- [ ] **Step 2: 저장 API auto-translate + manual translations**

Entity type `'homeWidget'`, fkField `widgetId`. `prisma.homeWidgetTranslation.upsert` where clause: `{ widgetId_locale: { widgetId: id, locale } }`.

- [ ] **Step 3: 관리자 UI LocaleTabs**

Task 10 Step 3과 동일 구조, 필드는 `title`.

- [ ] **Step 4: Build + 수동 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 오류 없음.

Manual: 위젯 제목 수정 → `/ko` 홈 사이드바에서 번역 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/home-widgets/ src/app/api/admin/home-widgets/ src/app/\[locale\]/admin/home-widgets/
git commit -m "feat(i18n-phase3): HomeWidget API + admin UI 번역 통합"
```

---

## Task 12: Content 플러그인 통합 (HTML 본문 번역)

**Files:**
- Modify: `src/plugins/contents/api/[slug]/route.ts`
- Modify: `src/plugins/contents/admin/api/*` (POST/PUT 핸들러)
- Modify: `src/plugins/contents/admin/page.tsx`

**주의점:** `content`는 Tiptap HTML이므로 `mimeType: 'text/html'`로 번역. `auto-translate.ts`의 `htmlFields: ['content']` 설정이 이미 이를 처리.

- [ ] **Step 1: 읽기 API locale 분기**

```typescript
import { getLocaleFromRequest, flattenTranslation } from '@/lib/translation/resolver'

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const locale = getLocaleFromRequest(req)

  const content = await prisma.content.findUnique({
    where: { slug, isPublic: true },
    include: { translations: { where: { locale } } },
  })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ content: flattenTranslation(content, locale, ['title', 'content']) })
}
```

- [ ] **Step 2: 저장 API auto-translate**

Entity type `'content'`. `title`과 `content` 모두 번역 대상, `content`는 HTML.

```typescript
await autoTranslateEntity('content', created.id, {
  title: created.title,
  content: created.content,
})
```

- [ ] **Step 3: Content 관리자 폼 LocaleTabs 적용**

```typescript
<LocaleTabs
  getStatus={(locale) => locale === routing.defaultLocale ? undefined : translations[locale]?.source ?? 'missing'}
  renderTab={(locale, isDefault) => {
    if (isDefault) {
      return (
        <>
          <LocaleField label="제목" isDefaultLocale>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </LocaleField>
          <LocaleField label="본문" isDefaultLocale>
            <TiptapEditor content={form.content} onChange={(v) => setForm({ ...form, content: v })} />
          </LocaleField>
        </>
      )
    }
    const tr = translations[locale] ?? { title: '', content: '', source: 'missing' as const }
    return (
      <>
        <LocaleField label="제목" isDefaultLocale={false} subLocaleHint="비워두면 영문 원본이 노출됩니다.">
          <Input
            value={tr.title}
            onChange={e => setTranslations({
              ...translations,
              [locale]: { ...tr, title: e.target.value, source: 'manual' }
            })}
          />
        </LocaleField>
        <LocaleField label="본문" isDefaultLocale={false}>
          <TiptapEditor
            content={tr.content}
            onChange={(v) => setTranslations({
              ...translations,
              [locale]: { ...tr, content: v, source: 'manual' }
            })}
          />
        </LocaleField>
      </>
    )
  }}
/>
```

- [ ] **Step 4: Build + 수동 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 오류 없음.

Manual: Content 생성 시 긴 HTML 본문 입력 → `/ko/contents/<slug>` 접속 → HTML 태그가 보존되고 텍스트만 번역되었는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/contents/
git commit -m "feat(i18n-phase3): Content 플러그인 번역 (HTML 본문 포함)"
```

---

## Task 13: Policy 플러그인 통합

**Files:**
- Modify: `src/plugins/policies/api/[slug]/route.ts`
- Modify: `src/plugins/policies/admin/api/*`
- Modify: `src/plugins/policies/admin/page.tsx`

**Pattern:** Task 12와 동일. 필드도 `title`, `content`로 동일.

- [ ] **Step 1: 읽기 API locale 분기**

`flattenTranslation(policy, locale, ['title', 'content'])` 사용. 기존 응답의 `versions` 배열은 번역하지 않음 (버전 히스토리는 메타정보).

- [ ] **Step 2: 저장 API auto-translate**

Entity type `'policy'`. 새 버전 생성(`isActive` 승격 포함) 시 `autoTranslateEntity('policy', created.id, { title, content })`.

- [ ] **Step 3: 관리자 폼 LocaleTabs**

Task 12 Step 3과 동일.

- [ ] **Step 4: Build + 수동 검증**

Run: `npx next build 2>&1 | tail -10`

Manual: 약관 새 버전 생성 → `/ko/policies/<slug>` 번역 확인.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/policies/
git commit -m "feat(i18n-phase3): Policy 플러그인 번역"
```

---

## Task 14: SiteSettings 통합

**Files:**
- Modify: `src/app/api/settings/route.ts`
- Modify: `src/app/api/admin/settings/route.ts`
- Modify: `src/app/[locale]/admin/settings/page.tsx`

- [ ] **Step 1: 공개 settings API locale 분기**

Replace GET handler body:
```typescript
import { getLocaleFromRequest } from '@/lib/translation/resolver'
import { getLocalizedSettings } from '@/lib/translation/settings'

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req)
  const settings = await getLocalizedSettings(locale)
  return NextResponse.json({ settings })
}
```

- [ ] **Step 2: 관리자 settings PUT에 번역 훅 추가**

In admin settings route (likely `src/app/api/admin/settings/route.ts`), after `prisma.setting.upsert`:

```typescript
import { translateSettingOnSave, invalidateSettingTranslations, isTranslatableSettingKey } from '@/lib/translation/settings'

// body는 { [key]: value, ..., translations?: { [key]: { [locale]: value } } } 형태로 확장
for (const [key, value] of Object.entries(body.settings ?? {})) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  })
  if (isTranslatableSettingKey(key)) {
    await invalidateSettingTranslations(key)
    await translateSettingOnSave(key, String(value))
  }
}

// 수동 번역 오버라이드
if (body.translations) {
  for (const [key, byLocale] of Object.entries(body.translations as Record<string, Record<string, string>>)) {
    if (!isTranslatableSettingKey(key)) continue
    for (const [locale, value] of Object.entries(byLocale)) {
      if (!value) continue
      await prisma.settingTranslation.upsert({
        where: { key_locale: { key, locale } },
        create: { key, locale, value, source: 'manual' },
        update: { value, source: 'manual' },
      })
    }
  }
}
```

- [ ] **Step 3: 관리자 Settings 페이지 LocaleTabs 적용**

번역 대상 필드(`site_name`, `site_description`, `footer_text`)만 LocaleTabs 안에 배치. 비번역 설정(`signup_enabled` 등)은 기존 UI 그대로 탭 외부에 유지.

```typescript
<LocaleTabs
  renderTab={(locale, isDefault) => {
    if (isDefault) {
      return (
        <>
          <LocaleField label="사이트 이름" isDefaultLocale>
            <Input value={form.site_name} onChange={e => setForm({ ...form, site_name: e.target.value })} />
          </LocaleField>
          <LocaleField label="사이트 설명" isDefaultLocale>
            <Textarea value={form.site_description} onChange={e => setForm({ ...form, site_description: e.target.value })} />
          </LocaleField>
          <LocaleField label="푸터 텍스트" isDefaultLocale>
            <Input value={form.footer_text} onChange={e => setForm({ ...form, footer_text: e.target.value })} />
          </LocaleField>
        </>
      )
    }
    return (
      <>
        <LocaleField label="사이트 이름" isDefaultLocale={false} subLocaleHint="비워두면 영문 원본이 노출됩니다.">
          <Input
            value={translations[locale]?.site_name ?? ''}
            onChange={e => setTranslations({
              ...translations,
              [locale]: { ...translations[locale], site_name: e.target.value }
            })}
          />
        </LocaleField>
        <LocaleField label="사이트 설명" isDefaultLocale={false}>
          <Textarea
            value={translations[locale]?.site_description ?? ''}
            onChange={e => setTranslations({
              ...translations,
              [locale]: { ...translations[locale], site_description: e.target.value }
            })}
          />
        </LocaleField>
        <LocaleField label="푸터 텍스트" isDefaultLocale={false}>
          <Input
            value={translations[locale]?.footer_text ?? ''}
            onChange={e => setTranslations({
              ...translations,
              [locale]: { ...translations[locale], footer_text: e.target.value }
            })}
          />
        </LocaleField>
      </>
    )
  }}
/>

{/* 번역 대상 외 설정은 탭 바깥 */}
<div className="mt-6 border-t pt-6 space-y-4">
  <div className="flex items-center gap-2">
    <Switch checked={form.signup_enabled === 'true'} onCheckedChange={v => setForm({ ...form, signup_enabled: v ? 'true' : 'false' })} />
    <Label>회원가입 허용</Label>
  </div>
</div>
```

- [ ] **Step 4: Build + 수동 검증**

Run: `npx next build 2>&1 | tail -10`
Expected: 오류 없음.

Manual:
1. 관리자 설정에서 site_name 변경 → 저장
2. `/ko` 홈 헤더에서 번역된 site_name 노출 확인
3. KO 탭에서 수동 수정 → 저장 → DB `setting_translations` 에 `source='manual'` 확인
4. 다시 EN 탭에서 site_name 재수정 → KO manual 보존 확인

- [ ] **Step 5: Commit**

```bash
git add src/app/api/settings/ src/app/api/admin/settings/ src/app/\[locale\]/admin/settings/
git commit -m "feat(i18n-phase3): SiteSettings 번역 통합"
```

---

## Task 15: Frontend — locale 전파 (fetch URL에 locale 쿼리)

**Files:**
- Modify: `src/lib/SiteContext.tsx`
- Modify: `src/layouts/default/HomePage.tsx`
- Modify: `src/plugins/boards/components/BoardListPage.tsx`
- Modify: `src/plugins/boards/components/BoardsPage.tsx`
- Modify: `src/plugins/boards/widgets/BoardCards.tsx`
- Modify: `src/plugins/boards/widgets/LatestPosts.tsx`
- Modify: `src/plugins/boards/widgets/PopularBoards.tsx`

**Pattern:** `useLocale()` 를 써서 locale 변수를 얻고, 모든 데이터 API fetch URL에 `?locale=${locale}` 추가.

- [ ] **Step 1: `SiteContext.tsx` locale 전파**

```typescript
"use client"
import { useLocale } from 'next-intl'
// ...

export function SiteProvider({ children }: { children: ReactNode }) {
  const locale = useLocale()
  // ... 기존 state ...

  useEffect(() => {
    const fetchAll = async () => {
      const q = `?locale=${locale}`
      const [userRes, settingsRes, boardsRes, menusRes, widgetsRes] = await Promise.all([
        fetch('/api/me'),
        fetch(`/api/settings${q}`),
        fetch(`/api/boards?limit=10&locale=${locale}`),
        fetch(`/api/menus?position=header&locale=${locale}`),
        fetch(`/api/home-widgets${q}`),
      ])
      // ... 기존 처리 ...
    }
    fetchAll()
  }, [locale])  // ← locale 의존성 추가 (언어 전환 시 재조회)

  // ... 나머지 동일 ...
}
```

- [ ] **Step 2: `HomePage.tsx` locale 전파**

```typescript
"use client"
import { useLocale } from 'next-intl'
// ...

export default function HomePage() {
  const locale = useLocale()
  // ... state ...

  useEffect(() => {
    const fetchWidgets = async () => {
      const res = await fetch(`/api/home-widgets?locale=${locale}`)
      // ... 기존 처리 ...
    }
    fetchWidgets()
  }, [locale])
  // ...
}
```

- [ ] **Step 3: Board 페이지·위젯 locale 전파**

`BoardListPage.tsx`, `BoardsPage.tsx`, 3개 widget 파일 모두:
```typescript
const locale = useLocale()
// ...
useEffect(() => {
  fetch(`/api/boards/<slug>/posts?page=${page}&locale=${locale}`)
  // or fetch(`/api/boards?limit=${limit}&locale=${locale}`)
}, [page, locale])
```

- [ ] **Step 4: Content / Policy 읽기 페이지 locale 전파**

`ContentPage.tsx`, `PolicyPage.tsx`도 `fetch(`/api/contents/${slug}?locale=${locale}`)` 형태로 수정.

- [ ] **Step 5: Build + 수동 검증**

Run: `npx next build 2>&1 | tail -10`

Manual:
1. `/en` 홈 → 영문 콘텐츠 확인
2. `/ko` 로 전환 → 한국어 콘텐츠 확인
3. 헤더 메뉴 라벨이 locale에 따라 변하는지 확인
4. 사이드바 위젯 안에서 게시판 이름이 locale에 따라 변하는지 확인
5. **플래시 현상 사라졌는지 확인** — 더 이상 /en에서 한국어로 덮어쓰이지 않아야 함

- [ ] **Step 6: Commit**

```bash
git add src/lib/SiteContext.tsx src/layouts/default/HomePage.tsx src/plugins/boards/components/ src/plugins/boards/widgets/ src/plugins/contents/components/ src/plugins/policies/components/
git commit -m "feat(i18n-phase3): 프론트엔드 fetch URL에 locale 쿼리 전파"
```

---

## Task 16: 기존 DB 한국어 데이터 영문화 마이그레이션

**Context:** Phase 2까지는 DB의 모든 텍스트 필드(게시판 이름, 메뉴 라벨, 콘텐츠/약관 본문, 사이트명, 위젯 제목)에 한국어가 저장돼 있다. Phase 3 완료 시점에 기본 컬럼은 영문이어야 한다. 이 Task는 기존 한국어를 `XTranslation(locale='ko', source='manual')`로 옮기고, 기본 컬럼을 영문으로 교체하는 1회성 스크립트를 작성·실행한다.

**번역 원칙:** 구글 API에 맡기지 않고 **컨트롤러(나)가 수동으로 영문을 제공**한다. 품질·고유명사 보존이 이유. 스크립트는 "사전(dictionary) + 미사전 항목은 원본 유지 후 경고 출력" 방식.

**Files:**
- Create: `scripts/backfill-translations.ts`
- Create: `scripts/backfill-translations.json` (번역 사전)

- [ ] **Step 1: 현재 DB 값 덤프**

Run:
```bash
cd /home/kagla/nexibase && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const out = {};
  out.boards = await p.board.findMany({ select: { id: true, slug: true, name: true, description: true } });
  out.menus = await p.menu.findMany({ select: { id: true, label: true, url: true } });
  out.widgets = await p.homeWidget.findMany({ select: { id: true, widgetKey: true, title: true } });
  out.contents = await p.content.findMany({ select: { id: true, slug: true, title: true } });
  out.policies = await p.policy.findMany({ select: { id: true, slug: true, version: true, title: true } });
  out.settings = await p.setting.findMany({ where: { key: { in: ['site_name', 'site_description', 'footer_text'] } } });
  console.log(JSON.stringify(out, null, 2));
  await p.\$disconnect();
})();
" > /tmp/nexibase-db-dump.json
cat /tmp/nexibase-db-dump.json | head -100
```

- [ ] **Step 2: 번역 사전 작성**

Controller(이 플랜을 실행하는 사용자 또는 에이전트 컨트롤러)가 위 덤프를 보고 각 한국어 필드에 대응하는 영문을 작성해 JSON으로 저장. **이 단계는 수동 번역 단계이며, Google API는 사용하지 않는다.** 본문 필드(`Content.content`, `Policy.content`)는 길기 때문에 별도 텍스트 파일로 분리.

Create `scripts/backfill-translations.json` with this schema:
```json
{
  "boards": [
    { "id": 1, "nameEn": "Free Board", "descriptionEn": "General discussion", "nameKo": "자유게시판", "descriptionKo": "자유롭게 이야기해보세요" }
  ],
  "menus": [
    { "id": 1, "labelEn": "Home", "labelKo": "홈" }
  ],
  "widgets": [
    { "id": 1, "titleEn": "Popular boards", "titleKo": "인기 게시판" }
  ],
  "contents": [
    { "id": 1, "titleEn": "About us", "titleKo": "회사 소개", "contentEn": "<p>...</p>", "contentKo": "<p>...</p>" }
  ],
  "policies": [
    { "id": 1, "titleEn": "Terms of Service", "titleKo": "이용약관", "contentEn": "<h2>...</h2>", "contentKo": "<h2>...</h2>" }
  ],
  "settings": [
    { "key": "site_name", "valueEn": "NexiBase", "valueKo": "넥시베이스" }
  ]
}
```

**중요:** `Ko` 필드는 현재 DB에 저장된 원본 한국어 값 (덤프에서 그대로 복사). `En` 필드는 새로 작성하는 영문 번역.

- [ ] **Step 3: 백필 스크립트 작성**

Create `scripts/backfill-translations.ts`:
```typescript
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

interface Backfill {
  boards: Array<{ id: number; nameEn: string; descriptionEn: string | null; nameKo: string; descriptionKo: string | null }>
  menus: Array<{ id: number; labelEn: string; labelKo: string }>
  widgets: Array<{ id: number; titleEn: string; titleKo: string }>
  contents: Array<{ id: number; titleEn: string; titleKo: string; contentEn: string; contentKo: string }>
  policies: Array<{ id: number; titleEn: string; titleKo: string; contentEn: string; contentKo: string }>
  settings: Array<{ key: string; valueEn: string; valueKo: string }>
}

async function main() {
  const dictPath = path.join(__dirname, 'backfill-translations.json')
  const dict: Backfill = JSON.parse(fs.readFileSync(dictPath, 'utf8'))

  console.log('--- Boards ---')
  for (const b of dict.boards) {
    await prisma.board.update({
      where: { id: b.id },
      data: { name: b.nameEn, description: b.descriptionEn },
    })
    await prisma.boardTranslation.upsert({
      where: { boardId_locale: { boardId: b.id, locale: 'ko' } },
      create: { boardId: b.id, locale: 'ko', name: b.nameKo, description: b.descriptionKo, source: 'manual' },
      update: { name: b.nameKo, description: b.descriptionKo, source: 'manual' },
    })
    console.log(`  #${b.id} ${b.nameKo} → ${b.nameEn}`)
  }

  console.log('--- Menus ---')
  for (const m of dict.menus) {
    await prisma.menu.update({ where: { id: m.id }, data: { label: m.labelEn } })
    await prisma.menuTranslation.upsert({
      where: { menuId_locale: { menuId: m.id, locale: 'ko' } },
      create: { menuId: m.id, locale: 'ko', label: m.labelKo, source: 'manual' },
      update: { label: m.labelKo, source: 'manual' },
    })
    console.log(`  #${m.id} ${m.labelKo} → ${m.labelEn}`)
  }

  console.log('--- HomeWidgets ---')
  for (const w of dict.widgets) {
    await prisma.homeWidget.update({ where: { id: w.id }, data: { title: w.titleEn } })
    await prisma.homeWidgetTranslation.upsert({
      where: { widgetId_locale: { widgetId: w.id, locale: 'ko' } },
      create: { widgetId: w.id, locale: 'ko', title: w.titleKo, source: 'manual' },
      update: { title: w.titleKo, source: 'manual' },
    })
    console.log(`  #${w.id} ${w.titleKo} → ${w.titleEn}`)
  }

  console.log('--- Contents ---')
  for (const c of dict.contents) {
    await prisma.content.update({
      where: { id: c.id },
      data: { title: c.titleEn, content: c.contentEn },
    })
    await prisma.contentTranslation.upsert({
      where: { contentId_locale: { contentId: c.id, locale: 'ko' } },
      create: { contentId: c.id, locale: 'ko', title: c.titleKo, content: c.contentKo, source: 'manual' },
      update: { title: c.titleKo, content: c.contentKo, source: 'manual' },
    })
    console.log(`  #${c.id} ${c.titleKo} → ${c.titleEn}`)
  }

  console.log('--- Policies ---')
  for (const p of dict.policies) {
    await prisma.policy.update({
      where: { id: p.id },
      data: { title: p.titleEn, content: p.contentEn },
    })
    await prisma.policyTranslation.upsert({
      where: { policyId_locale: { policyId: p.id, locale: 'ko' } },
      create: { policyId: p.id, locale: 'ko', title: p.titleKo, content: p.contentKo, source: 'manual' },
      update: { title: p.titleKo, content: p.contentKo, source: 'manual' },
    })
    console.log(`  #${p.id} ${p.titleKo} → ${p.titleEn}`)
  }

  console.log('--- Settings ---')
  for (const s of dict.settings) {
    await prisma.setting.update({ where: { key: s.key }, data: { value: s.valueEn } })
    await prisma.settingTranslation.upsert({
      where: { key_locale: { key: s.key, locale: 'ko' } },
      create: { key: s.key, locale: 'ko', value: s.valueKo, source: 'manual' },
      update: { value: s.valueKo, source: 'manual' },
    })
    console.log(`  ${s.key}: ${s.valueKo} → ${s.valueEn}`)
  }

  console.log('\n✅ Backfill complete')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 4: 백필 스크립트 dry-run 검증**

Run:
```bash
cd /home/kagla/nexibase && npx tsx scripts/backfill-translations.ts
```

Expected:
- 콘솔에 각 엔티티별 한→영 변환 로그 출력
- 에러 없이 종료
- 예상 개수가 덤프와 일치

Then verify with:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log('boards:', await p.board.findMany({ select: { id: true, name: true } }));
  console.log('translations:', await p.boardTranslation.findMany({ where: { locale: 'ko' } }));
  await p.\$disconnect();
})();
"
```

Expected: `boards.name`은 영문, `boardTranslation(locale=ko).name`은 한국어.

- [ ] **Step 5: 수동 검증 — 사이트 전체 스모크 테스트**

Run: `npx next dev` 후 다음 경로 확인:
1. `/en` — 헤더·푸터·메뉴·위젯 모두 영문
2. `/ko` — 헤더·푸터·메뉴·위젯 모두 한국어
3. `/en/boards/<slug>` / `/ko/boards/<slug>` — 게시판 이름/설명 locale 별 노출
4. `/en/contents/<slug>` / `/ko/contents/<slug>` — 콘텐츠 본문 locale 별 노출
5. `/en/policies/<slug>` / `/ko/policies/<slug>` — 약관 본문 locale 별 노출

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-translations.ts scripts/backfill-translations.json
git commit -m "feat(i18n-phase3): 기존 한국어 데이터 영문화 백필 스크립트 + 실행"
```

---

## Task 17: 최종 검증 + 버전업 (v0.11.0)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 전체 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -40`
Expected: clean build, 0 errors.

- [ ] **Step 2: 수동 스모크 시나리오**

Dev 서버 `npx next dev` 후:

1. **관리자 저장 플로우 (Google API 활성 상태)**:
   - `/en/admin/boards`에서 새 게시판 생성(영문 이름·설명)
   - `board_translations` 테이블에 `source='auto'` 레코드 생성 확인
   - `/ko/boards`에서 자동 번역된 이름 노출 확인
2. **관리자 저장 플로우 (Google API 미설정)**:
   - `.env`에서 `GOOGLE_CLOUD_PROJECT_ID` 제거 후 서버 재시작
   - 새 게시판 생성 → 저장 성공, 번역 테이블엔 레코드 없음
   - `/ko/boards`에서 영문 원본으로 fallback 노출 확인
3. **수동 번역 수정 + 재수정 시 보존**:
   - KO 탭에서 번역 수정 → `source='manual'` 확인
   - EN 탭에서 원본 재수정 → KO manual 보존 확인
4. **언어 전환 시 페이지 재로드 없이 재조회**:
   - `/en` → 언어 스위처로 `/ko` 이동 → SiteContext가 새 locale로 fetch 재실행 확인
5. **플래시 현상 사라졌는지**:
   - `/en` 새로고침 후 관찰 → 한국어가 깜빡이지 않음

- [ ] **Step 3: 한국어 잔존 검색 (Phase 2 잔존 확인)**

Run:
```bash
cd /home/kagla/nexibase && grep -rn '[가-힣]' src/lib/translation/ src/components/admin/LocaleTabs.tsx src/components/admin/LocaleField.tsx 2>&1 | grep -v '//\|/\*' | head -20
```
Expected: 주석을 제외한 UI/에러 문자열은 0건 (있다면 번역 추가).

- [ ] **Step 4: package.json 버전업**

Run:
```bash
cd /home/kagla/nexibase && node -e "const p=require('./package.json'); p.version='0.11.0'; require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2)+'\n')"
```

- [ ] **Step 5: 최종 커밋 + 태그 + 푸시**

```bash
cd /home/kagla/nexibase
git add package.json
git commit -m "chore: v0.11.0 — i18n Phase 3 (DB 콘텐츠 자동 번역)"
git push origin feat/i18n-phase3
gh pr create --title "feat(i18n): Phase 3 — DB 콘텐츠 자동 번역 (v0.11.0)" --body "$(cat <<'EOF'
## Summary
- 관리자 콘텐츠(Board/Menu/Content/Policy/HomeWidget/Setting) 저장 시 Google Translate로 자동 번역
- source='auto'|'manual' 구분 — manual 번역은 원본 수정 시에도 보존
- LocaleTabs 공통 컴포넌트로 모든 관리자 폼에 EN/KO 탭 추가
- 기존 한국어 DB 데이터를 영문으로 백필 (Task 16 사전 기반)

## Test plan
- [x] `npx next build` 통과
- [ ] `/en` · `/ko` 주요 페이지 수동 스모크
- [ ] Google API 미설정 시 fallback 동작 확인
- [ ] 수동 번역 수정 → 원본 재수정 → manual 보존 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: 머지 + 태그**

```bash
gh pr merge --merge --delete-branch
git checkout main && git pull
git tag -a v0.11.0 -m "v0.11.0 — i18n Phase 3 (DB 콘텐츠 자동 번역)"
git push origin v0.11.0
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ 6개 대상 엔티티 모두 task 있음 (Task 8–14)
- ✅ Google Translate API 통합 (Task 1–2)
- ✅ source='auto'|'manual' 구분 및 manual 보존 (Task 5, auto-translate.ts)
- ✅ LocaleTabs 공통 UI (Task 7)
- ✅ 기존 한국어 백필 (Task 16)
- ✅ 프론트 locale 전파 (Task 15)
- ✅ 읽기 API locale 분기 (각 엔티티 task 내)

**Placeholder check:**
- "기존 update 페이로드에 optional translations 필드" — 코드 예시 제공함 ✅
- Task 8 Step 2 "Find the admin POST/PATCH handler (check ...)" — 경로 추정에 의존하므로 서브에이전트가 먼저 탐색해야 함. 실행 시 controller가 파일 찾은 후 전달 권장.

**Type consistency:**
- `autoTranslateEntity(entityType, entityId, values)` 시그니처 Task 5에서 정의, 이후 task에서 동일하게 호출
- `resolveTranslation(entity, locale, field)` Task 4에서 정의, 사용 없이 `flattenTranslation` 우선 사용 (더 편리)
- `TRANSLATION_ENTITY_SPECS`의 fkField 명칭이 unique 제약 이름과 일치 (`boardId_locale`, `menuId_locale`, `widgetId_locale`, `contentId_locale`, `policyId_locale`, `key_locale`)

**알려진 위험:**
1. Google Translate API 할당량·비용 — 관리자 저장 시점만이라 부담은 작지만 대량 콘텐츠 일괄 저장 시 주의
2. HTML 번역 품질 — `mimeType: 'text/html'` 사용하지만 Tiptap의 일부 마크업이 손상될 가능성 있음. Manual 번역으로 수정 가능
3. Task 16은 인간(또는 controller)의 수동 영문 번역이 블로커. Google API로 자동 생성 옵션도 나중에 추가 가능하지만 이번엔 수동

---

**Plan complete.**
