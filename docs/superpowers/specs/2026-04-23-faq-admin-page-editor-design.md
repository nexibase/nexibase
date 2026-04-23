# FAQ Admin: Page-Based Editor with TiptapEditor

**Date:** 2026-04-23
**Status:** Design approved, ready for implementation plan
**Plugin:** `faq-accordion`

## 1. Problem

현재 `/admin/faq-accordion`의 FAQ 추가·편집은 모달(`FaqDialog`) + `MiniEditor` 조합으로 구현되어 있음.

- `MiniEditor`는 `max-h-[200px]`로 제한 — 긴 답변·이미지·리스트 입력에 부족
- 모달 창 자체가 `max-w-2xl`로 폭 제한, 세로 스크롤이 뷰포트에 갇힘
- 이미지 업로드 미지원 (MiniEditor 제약)

FAQ 답변은 길이·형식 측면에서 게시판 글에 가까움. 전용 페이지 + `TiptapEditor`로 전환해 충분한 작업 공간과 이미지 삽입을 제공한다.

## 2. Goals

- FAQ 추가·편집을 전용 admin 페이지로 이동
- 에디터를 `TiptapEditor`로 전환 (이미지 업로드 포함)
- 기존 모달 방식(`FaqDialog`) 코드 완전 제거
- 편집 페이지에서 FAQ 성과 통계(views, helpful, notHelpful) 읽기 전용 노출
- 저장되지 않은 변경사항 이탈 경고(탭 닫기·취소 버튼 한정)

## 3. Non-Goals

- 카테고리 모달은 유지 (짧은 이름 입력이라 페이지화 불필요)
- 브라우저 뒤로가기(popstate) 가드 — boards도 미구현, 동일 스코프 유지
- 자동저장·드래프트
- 미리보기 탭, 마크다운 import/export
- 삭제 버튼을 편집 페이지에 추가 (실수 방지 위해 목록에서만)

## 4. Routes

| Path | 역할 |
|---|---|
| `/admin/faq-accordion` | 기존 목록 (FAQ · 카테고리 탭) — 수정 |
| `/admin/faq-accordion/new` | FAQ 신규 작성 — 신규 |
| `/admin/faq-accordion/[id]/edit` | FAQ 편집 — 신규 |

- 목록 "FAQ 추가" 버튼 → `Link href="/admin/faq-accordion/new"`
- 목록 연필 아이콘 → `Link href="/admin/faq-accordion/${id}/edit"`
- 저장 성공 → `router.push('/admin/faq-accordion')`
- 취소 → `isDirty`면 `confirm(t('unsavedConfirm'))` 후 목록으로
- `[id]/edit`에서 FAQ fetch 404 → 목록으로 리다이렉트 + 에러 토스트

`plugin.ts` 변경 불필요 — `scripts/scan-plugins.js`의 `generateWrappersRecursive`가 `admin/` 디렉토리를 재귀 탐색하므로 `admin/new/page.tsx`와 `admin/[id]/edit/page.tsx`는 빌드 시 자동 래핑된다.

## 5. Component Structure

```
src/plugins/faq-accordion/admin/
├── page.tsx                       (목록 — 수정)
├── [id]/
│   └── edit/
│       └── page.tsx               (신규)
├── new/
│   └── page.tsx                   (신규)
├── components/
│   ├── FaqForm.tsx                (신규 — new/edit 공용 폼)
│   ├── FaqList.tsx                (수정)
│   ├── CategoryList.tsx           (변경 없음)
│   ├── CategoryDialog.tsx         (변경 없음)
│   └── FaqDialog.tsx              (삭제)
```

### 5.1 `FaqForm.tsx` (신규, client component)

**Props:**
```ts
interface FaqFormProps {
  initial: Faq | null               // null이면 신규 모드
  categories: Category[]
  stats?: { views: number; helpful: number; notHelpful: number }
}
```

**내부 상태:** `question`, `answer`, `categoryId`, `published`, `isDirty`, `saving`

**동작:**
- 마운트 시 `initial` 값으로 state 초기화 (`initial?.question ?? ''` 등)
- 모든 setter 진입 시 `setIsDirty(true)`
- 검증: `question.trim() && stripHtml(answer) && categoryId` — 충족 안 되면 저장 버튼 disabled
- 저장 엔드포인트:
  - 신규: `POST /api/admin/faq-accordion` body `{ type: 'faq', question, answer, categoryId, published }`
  - 편집: `PATCH /api/admin/faq-accordion` body `{ type: 'faq', id, question, answer, categoryId, published }`
- 저장 성공 → `setIsDirty(false)` → `router.push('/admin/faq-accordion')`
- 저장 실패 → 에러 표시 (기존 alert 유지 또는 inline error)
- 취소 버튼 — `isDirty`면 `confirm` 후 `router.push('/admin/faq-accordion')`
- `window.addEventListener('beforeunload')` — `isDirty`일 때 브라우저 기본 경고 유발, unmount 시 cleanup

**레이아웃:** boards의 `BoardWritePage`와 유사한 card 기반 세로 스택.
- 상단: `← 목록` back link
- Question (Input)
- Answer (TiptapEditor) — 높이는 Tiptap 기본값 사용
- Category (Select)
- Published (Switch)
- stats prop이 있으면 우측 사이드 또는 하단에 읽기 전용 통계 블록
- 하단 우측: 취소 / 저장 버튼

### 5.2 `new/page.tsx`

```ts
"use client"
// 카테고리 fetch → <FaqForm initial={null} categories={cats} />
```

카테고리가 비어 있으면 에러 메시지 + 목록으로 돌아가기 (기존 목록의 `canCreate` 체크를 여기서 한 번 더).

### 5.3 `[id]/edit/page.tsx`

```ts
"use client"
// params.id → FAQ + 카테고리 병렬 fetch
// 404: router.replace('/admin/faq-accordion') + toast
// 성공: <FaqForm initial={faq} categories={cats} stats={...} />
```

### 5.4 `FaqList.tsx` (수정)

**제거:**
- `FaqDialog` import·렌더링
- `editing`, `creating` 상태
- 모달 열기 핸들러

**변경:**
- "FAQ 추가" `Button` → `Button asChild` + `Link href="/admin/faq-accordion/new"`
- 연필 `Button` → `Link href="/admin/faq-accordion/${faq.id}/edit"` (아이콘 유지)

삭제 버튼은 목록에서 그대로 유지.

### 5.5 `page.tsx` (목록)

실질 변경 없음. `FaqList` props는 기존과 동일 — 내부 동작만 수정됨.

## 6. API

기존 `/api/admin/faq-accordion` POST/PATCH 엔드포인트 그대로 사용. 엔드포인트 변경·추가 없음.

이미지 업로드는 TiptapEditor가 기본으로 사용하는 `/api/tiptap-image-upload` — boards·policies·contents와 동일하게 동작, 관리자 인증은 라우트 자체에서 처리.

## 7. i18n

`src/plugins/faq-accordion/locales/{ko,en}.json`의 `admin` 네임스페이스에 추가:

| 키 | ko | en |
|---|---|---|
| `back` | 목록으로 | Back to list |
| `unsavedConfirm` | 저장되지 않은 변경사항이 있습니다. 나가시겠습니까? | You have unsaved changes. Leave anyway? |
| `notFound` | FAQ를 찾을 수 없습니다 | FAQ not found |
| `statsTitle` | 통계 | Stats |
| `statsViews` | 조회수 | Views |
| `statsHelpful` | 도움됨 | Helpful |
| `statsNotHelpful` | 도움 안 됨 | Not helpful |

기존 키(`addFaq`, `editFaq`, `question`, `answer`, `category`, `published`, `draft`, `cancel`, `save` 등) 재사용.

## 8. Cleanup & Removal

- `src/plugins/faq-accordion/admin/components/FaqDialog.tsx` — 파일 삭제
- `FaqList.tsx` 내 `FaqDialog` 관련 import·상태·JSX 제거
- MiniEditor import는 faq-accordion 전체에서 제거 (다른 곳 참조 없음을 확인 후)

## 9. Testing / Verification

수동 검증 체크리스트 (구현 후):

- [ ] 목록 "FAQ 추가" 클릭 → `/admin/faq-accordion/new` 이동
- [ ] 신규 작성 → 저장 → 목록에 추가됨, 목록으로 리다이렉트
- [ ] 목록 연필 클릭 → `/admin/faq-accordion/[id]/edit` 이동, 기존 값 표시
- [ ] 편집 저장 → 목록에 반영
- [ ] 존재하지 않는 id로 edit 진입 → 목록으로 리다이렉트
- [ ] TiptapEditor에서 이미지 업로드 → 본문에 삽입 → 저장 → 공개 페이지에서 이미지 표시
- [ ] dirty 상태에서 취소 → confirm 뜸
- [ ] dirty 상태에서 탭 닫기 → 브라우저 경고 뜸
- [ ] 저장 후에는 경고 뜨지 않음 (리다이렉트 전 `isDirty=false`)
- [ ] 편집 페이지에서 통계(views/helpful/notHelpful) 표시
- [ ] 카테고리 탭(모달) 동작 변경 없음

## 10. Open Questions

없음 — 설계 단계의 모든 결정 확정됨.
