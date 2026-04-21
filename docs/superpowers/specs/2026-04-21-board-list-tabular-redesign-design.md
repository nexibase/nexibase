# 게시판 목록 재설계 — 전통 게시판형 반응형

- **작성일:** 2026-04-21
- **Status:** Approved (brainstorming → writing-plans)
- **대체 관계:** [2026-04-19-board-mobile-redesign-design.md](./2026-04-19-board-mobile-redesign-design.md) 4절("목록 페이지") 의 결과물인 "2줄 카드형" 리스트를 **이 스펙이 대체**한다. 상세 페이지·공통 반응형 전략 등 나머지 절은 유지된다.
- **타겟 파일:**
  - `src/plugins/boards/components/BoardListPage.tsx` (목록)
  - `src/plugins/boards/schema.prisma` (Board 스키마)
  - `src/plugins/boards/api/[slug]/posts/route.ts` (목록 API)
  - `src/plugins/boards/admin/**` (어드민 토글 UI)

---

## 1. 배경과 목표

### 1.1 배경

2026-04-19 리디자인 결과, 목록 페이지가 "제목 한 줄 + 메타 한 줄" 형태의 모던한 블로그 글 목록에 가까워졌다. 이는 데스크톱에서 "게시판"(Clien·디시·루리웹 같은 한국 커뮤니티형) 느낌이 약하다는 피드백이 있었다. 또한 API 계약의 반쪽짜리 구현 탓에 공지글이 일반글과 시각적으로 구분되지 않는 상태다 ([2.2](#22-api-계약의-반쪽짜리-공지-버그) 참조).

### 1.2 목표

- 데스크톱에서는 전통 표 형식(번호·제목·글쓴이·날짜·조회·추천 컬럼)으로 표시하여 게시판다운 정보 밀도를 확보한다.
- 모바일에서는 2줄 압축 행 + 아이콘 메타로 가독성을 유지한다.
- 하나의 JSX 트리 + CSS Grid 반응형으로 구현하여 모바일·데스크톱 로직 중복을 피한다.
- 공지/일반 분리가 시각적으로 드러나도록 API와 렌더링을 수정한다.
- 게시판별 토글 설정으로 게시글 번호 표시 여부를 운영자가 제어한다.

### 1.3 범위 (In / Out)

**In**
- `displayType === "list"` 모드의 렌더링 구조 재작성
- Board 모델에 `showPostNumber Boolean @default(false)` 추가 및 어드민 토글 UI
- 목록 API 응답에 `notices[]`·`posts[]` 분리, `pagination.total`을 공지 제외 카운트로 변경
- 목록 API 응답 `board` 객체에 `showPostNumber` 포함

**Out**
- `displayType === "gallery"` 뷰 — 기존 인라인 격자 유지
- 상세 페이지·글쓰기·수정 페이지 — 기존 그대로
- 권한/인증 로직, 비밀글 동작, 첨부 업로드 로직 — 무변경
- 정렬 순서(`sortOrder`) 옵션 추가 — 본 스펙 범위 외

### 1.4 설계 원칙

- **플러그인 내부만 수정.** `src/plugins/boards/` 외부 파일 및 `@/components/ui/*` 같은 코어 컴포넌트는 수정하지 않는다 (코어 무변경 원칙).
- **단일 JSX + CSS 반응형.** 데스크톱·모바일 레이아웃을 각각 따로 렌더하지 않는다. 같은 DOM이 미디어 쿼리로 레이아웃만 달라진다.
- **스키마 변경 최소화.** 새 컬럼은 Board.`showPostNumber` 하나. 기본값 `false`로 기존 데이터에 대한 백필 없이 배포 가능.
- **번호 계산은 클라이언트에서.** 서버는 현재 제공 중인 `pagination.total`만 쓰면 되므로 API 간소화.

---

## 2. 현재 상태 분석

### 2.1 목록 렌더링

[BoardListPage.tsx:357-410](../../../src/plugins/boards/components/BoardListPage.tsx#L357-L410) 에서 일반 리스트 행은 다음과 같이 렌더된다 (요약):

```tsx
<Link className="block py-3 px-1 hover:bg-muted/40">
  <div>{title} {🔒 if secret} {📎 if attachments}</div>
  <div className="text-muted-foreground">
    <UserNickname /> · {date} · 👁 {views} · 💬 {comments} · 👍 {likes}
  </div>
</Link>
```

- 데스크톱/모바일 모두 2줄 형식 → 데스크톱에선 정보 밀도가 낮고 "표" 인상이 약함.
- `post.isNotice`인 글도 이 일반 렌더를 타므로 공지 시각 구분 없음.

### 2.2 API 계약의 반쪽짜리 공지 버그

- API([posts/route.ts](../../../src/plugins/boards/api/[slug]/posts/route.ts)) 는 공지·일반글을 `posts` 배열 하나로 묶어 반환하며, `notices` 키는 내려주지 않는다 (L139-L158).
- 클라이언트는 `setNotices(data.notices || [])` 로 받으려 시도하며 ([BoardListPage.tsx:127](../../../src/plugins/boards/components/BoardListPage.tsx#L127)), 이 배열이 비어있는 한 공지 전용 블록([BoardListPage.tsx:246-292](../../../src/plugins/boards/components/BoardListPage.tsx#L246-L292))은 렌더되지 않는다.
- 즉, 공지글은 "isNotice 정렬로 상단에 올라오지만 배지·배경 없이 일반 행으로 표시"되는 상태다.

### 2.3 번호 부재

게시글 번호 컬럼은 현재 존재하지 않는다. `Post.id` 는 autoincrement `Int` 지만 전역 증가이므로 특정 게시판 내 연속적이지 않다 (예: 128, 134, 139 …).

---

## 3. 설계

### 3.1 레이아웃 — 단일 JSX + CSS Grid

각 행은 하나의 `<div>` 이며, 화면 크기에 따라 grid-template이 달라진다.

**모바일 (<768px) — 2줄 행**
```
┌─────────────────────────────────────┐
│ 🔒 오늘 산책하다가 본 장면 [12]     │  제목 (15px, font-medium)
│ 달빛여우 · 15:42 · 👁 342 · 💬 12 · 👍 28 │  메타 (12.5px, muted)
└─────────────────────────────────────┘
```

**데스크톱 (≥768px) — 표 행**
```
┌────┬──────────────────────────┬────────┬──────┬────┬────┐
│번호 │ 제목                      │ 글쓴이  │ 날짜 │조회 │추천 │
├────┼──────────────────────────┼────────┼──────┼────┼────┤
│ 328 │ 오늘 산책하다가 본 장면 [12]│ 달빛여우 │15:42 │342 │ 28 │
└────┴──────────────────────────┴────────┴──────┴────┴────┘
```

### 3.2 CSS Grid 템플릿

```css
/* 기본(모바일) — 제목 / 메타 2줄로 흐름 */
.post-row {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-areas: "title" "meta";
  padding: 10px 12px;
  border-bottom: 1px solid hsl(var(--border));
  row-gap: 5px;
}
.cell-title  { grid-area: title; min-width: 0; }
.cell-number { display: none; }
.cell-author, .cell-date, .cell-views,
.cell-comments, .cell-likes {
  grid-area: meta;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: hsl(var(--muted-foreground));
  font-size: 12.5px;
}
.cell-meta-separator { opacity: 0.5; }
.mobile-only-icon { display: inline; width: 13px; height: 13px; opacity: 0.75; }

/* 데스크톱 — 6컬럼(번호 포함) 또는 5컬럼(번호 미표시) 표 */
@media (min-width: 768px) {
  .post-row {
    grid-template-columns: 50px 1fr 90px 60px 50px 50px;
    grid-template-areas: "num title author date views likes";
    align-items: center;
    padding: 8px 8px;
  }
  .post-row.hide-number {
    grid-template-columns: 1fr 90px 60px 50px 50px;
    grid-template-areas: "title author date views likes";
  }
  .cell-number { display: block; grid-area: num; text-align: center; }
  .post-row.hide-number .cell-number { display: none; }
  .cell-title { grid-area: title; text-align: left; }
  .cell-author { grid-area: author; text-align: center; display: block; }
  .cell-date { grid-area: date; text-align: center; display: block; }
  .cell-views { grid-area: views; text-align: center; display: block; }
  .cell-comments { display: none; /* 데스크톱에선 제목 옆 [12]로만 노출 */ }
  .cell-likes { grid-area: likes; text-align: center; display: block; }
  .mobile-only-icon { display: none; }
  .cell-meta-separator { display: none; }
}
```

Tailwind로 옮기든 모듈 CSS로 두든 구현 자유지만, 이 그리드 템플릿이 표준이다. `hide-number` 클래스는 `board.showPostNumber === false`일 때 행에 부여한다.

### 3.3 컴포넌트 구조

한 파일로도 가능하지만, 파일 크기 관리 차원에서 행 렌더만 분리한다.

```
src/plugins/boards/components/
  ├── BoardListPage.tsx            ← 기존 파일, 헤더·fetch·에러·로딩·갤러리 유지
  └── PostListRow.tsx              ← 새 파일, post 1건 렌더
```

**PostListRow props**
```ts
interface PostListRowProps {
  post: Post              // 공지·일반 동일 타입 사용
  board: BoardSummary     // useComment, useReaction, slug
  displayNumber?: number  // undefined 또는 number
  showNumber: boolean     // board.showPostNumber
  isNotice: boolean       // 공지 여부 (배경색·배지 제어)
  user: User | null
  isAdmin: boolean
  formatDate: (iso: string) => string
  locale: string
}
```

**BoardListPage 내부 렌더**
```tsx
{/* 데스크톱 전용 헤더 행 */}
<div className="post-row hidden md:grid bg-muted/50 text-xs font-semibold text-muted-foreground"
     {...hideNumberClass}>
  {showNumber && <div className="cell-number">번호</div>}
  <div className="cell-title">제목</div>
  <div className="cell-author">글쓴이</div>
  <div className="cell-date">날짜</div>
  <div className="cell-views">조회</div>
  <div className="cell-likes">추천</div>
</div>

{/* 공지 (항상 전체 노출) */}
{notices.map(n => (
  <PostListRow key={n.id} post={n} isNotice
               showNumber={board.showPostNumber} ... />
))}

{/* 일반 글 (페이지네이션) */}
{posts.map((p, i) => (
  <PostListRow key={p.id} post={p}
               displayNumber={total - (page - 1) * limit - i}
               showNumber={board.showPostNumber} isNotice={false} ... />
))}
```

### 3.4 공지 표시 규칙

- 공지 행은 `isNotice` prop이 true일 때 `bg-amber-50 dark:bg-amber-950/20` 배경 적용.
- 번호 셀에는 번호 대신 `<Badge variant="destructive">공지</Badge>` 렌더 (`showNumber=true` 데스크톱일 때).
- `showNumber=false` 또는 모바일일 때는 번호 셀이 `display:none` 이므로 공지 배지는 제목 cell의 prefix로 들어간다:
  ```tsx
  <div className="cell-title">
    {isNotice && <NoticeBadge className="title-badge md:hidden" />}
    {title}
    {commentCount > 0 && (
      <span className="hidden md:inline text-destructive font-semibold ml-1">[{commentCount}]</span>
    )}
    {hasAttachments && <Paperclip className="inline ml-1 h-3.5 w-3.5 text-muted-foreground" />}
  </div>
  ```
- `isMobile` 판별을 JS로 하지 않고 CSS 가시성으로 처리한다. 예:
  - 모바일에선 제목 prefix 배지를 `md:hidden`, 데스크톱에선 번호 셀 안의 배지를 `hidden md:inline`
  - `showPostNumber=false` 데스크톱에선 prefix 배지가 다시 보여야 하므로 `post-row.hide-number .title-badge { display: inline }` 같은 규칙 추가
  - 구현 시 컴포넌트 내부에서 조건 분기를 JS가 아닌 클래스 조합으로 처리

### 3.5 번호 계산 (전략 C — display-time reverse)

```ts
// 클라이언트에서
const displayNumber = pagination.total - (page - 1) * limit - index
```

- `pagination.total` 은 **공지 제외** 일반글 카운트. 공지는 번호 범위에서 제외.
- 초기 로드 후 "더 보기"로 다음 페이지를 append할 때, 각 새 페이지의 `index` 도 해당 페이지 내 0-based 이므로 누적 리스트의 index와 별개로 계산해야 한다. 구현 시 API 페이지별 `basePage`에서 계산 후 push한다.
- 한계: 글 추가/삭제로 같은 글의 번호가 바뀔 수 있음. 본 전략의 known trade-off로 수용.

### 3.6 메타 렌더 규칙 (공지·일반 동일)

**댓글 수 표시 방식 (브레이크포인트별)**
- 데스크톱: 제목 셀 우측에 `[12]` 형태로 inline 표시. 댓글 전용 컬럼은 없음.
- 모바일: 메타 줄에 `💬 12` 아이콘+숫자로 표시. `[12]`는 `md:inline` 으로 데스크톱에만 노출.
- 두 표시는 **상호 배타적**이며, 0일 때는 어느 쪽도 렌더하지 않는다.

**기타 값**
- 조회: 항상 표시 (0 포함)
- 추천: 데스크톱은 컬럼 정렬 유지 목적으로 0도 표시. 모바일 메타에서는 0일 때 생략.
- 글쓴이·날짜: 항상 표시.

**아이콘** (`lucide-react`): `Eye` / `MessageSquare` / `ThumbsUp`. 현재 코드의 💬 이모지는 `MessageSquare`로 교체.

### 3.7 API 변경

**목록 응답 쉐이프 변경** ([posts/route.ts](../../../src/plugins/boards/api/[slug]/posts/route.ts))

```ts
// 이전
{ board, posts, pagination: { page, limit, total, totalPages } }

// 이후
{
  board: { ..., showPostNumber },
  notices,       // Post[] — 전체 (페이지네이션 없음)
  posts,         // Post[] — 일반글 페이지 1장
  pagination: { page, limit, total, totalPages }  // total·totalPages는 공지 제외 수
}
```

**쿼리 분리**
```ts
const base = { boardId: board.id, status: 'published' }
const [notices, posts, total] = await Promise.all([
  prisma.post.findMany({
    where: { ...base, isNotice: true },
    orderBy: [{ createdAt: 'desc' }],
    select: postSelect,
  }),
  prisma.post.findMany({
    where: { ...base, isNotice: false, ...(search ? searchConditions : {}) },
    skip, take: limit,
    orderBy: postOrderBy,   // 기존 sortOrder 반영 (isNotice 정렬은 제거)
    select: postSelect,
  }),
  prisma.post.count({ where: { ...base, isNotice: false, ...(search ? searchConditions : {}) } }),
])
```

- 기존 `orderBy` 중 `{ isNotice: 'desc' }` 는 제거 (공지는 별도 쿼리).
- `postSelect` 는 현재 select 셋을 그대로 재사용. 갤러리 모드에서 `attachments` include가 필요한 건도 그대로.

### 3.8 Board 스키마 변경

```prisma
model Board {
  // ...기존 필드
  showPostNumber Boolean @default(false)
}
```

- `src/plugins/boards/schema.prisma` 에만 추가 (코어의 `prisma/schema.prisma` 는 산출물이라 직접 수정 금지).
- 기본값 `false` → 기존 게시판 데이터 유지 가능, 백필 불필요.
- Prisma 머징 후 `prisma migrate dev --name board_show_post_number` 로 마이그레이션 생성.

### 3.9 어드민 토글 UI

어드민 게시판 설정 페이지(`src/plugins/boards/admin/...`)에 체크박스 한 줄 추가:

- 라벨: `게시글 번호 표시` (i18n 키 신규: `boards.admin.showPostNumberLabel`)
- 헬프 텍스트: `목록에 순번을 표시합니다. 글 추가/삭제에 따라 번호가 재계산될 수 있습니다.` (`boards.admin.showPostNumberHelp`)
- 어드민 수정 API([boards/admin/api/[id]/route.ts](../../../src/plugins/boards/admin/api/[id]/route.ts)) 의 PATCH/PUT 바디에 `showPostNumber` 수용 추가.

### 3.10 "더 보기" 페이지네이션 호환

현재 구현([BoardListPage.tsx:412-435](../../../src/plugins/boards/components/BoardListPage.tsx#L412-L435))을 그대로 쓴다. 추가 요구사항:
- 페이지 2+ 로드 시 `notices` 는 덮어쓰지 않음 (1페이지에서 받은 것 유지).
- `posts` 는 현재처럼 append.
- 번호 계산은 각 페이지 로드 시점의 `page`·`limit`·`total` 로 산출.

---

## 4. 타이포그래피·색상

| 항목 | 값 |
|---|---|
| 제목 (모바일) | 15px / font-medium / line-height 1.35 |
| 제목 (데스크톱) | 14px / font-medium / truncate |
| 메타 (모바일) | 12.5px / text-muted-foreground |
| 메타 (데스크톱 셀) | 13px / text-muted-foreground |
| 숫자 (조회·추천) | `tabular-nums` |
| 공지 배경 | `bg-amber-50 dark:bg-amber-950/20` |
| 공지 배지 | `bg-destructive text-destructive-foreground text-[11px] px-1.5 rounded` |
| 댓글 수 `[N]` (제목 inline) | 데스크톱 전용 (`hidden md:inline`), `text-destructive font-semibold ml-1` |
| 댓글 아이콘 (메타 줄) | 모바일 전용 (`md:hidden`), `MessageSquare` + 숫자 |
| 비밀글 🔒 | lucide `Lock`, `text-yellow-500`, 제목 prefix |
| 첨부 | lucide `Paperclip`, `text-muted-foreground`, 제목 우측 inline |
| 데스크톱 헤더 행 | `bg-muted/50 text-xs font-semibold text-muted-foreground` |
| 행 hover | `hover:bg-muted/40` |
| 행 border | `border-b border-border` |

---

## 5. 엣지케이스

- **빈 게시판**: notices도 posts도 0 → 기존 "게시물이 없습니다" 중앙 메시지 유지.
- **공지만 있음**: 공지는 정상 렌더, 하단에 "게시물이 없습니다" 메시지 또는 공지 목록 아래 빈 상태.
- **비밀글 권한 없음**: 제목 prefix에 🔒, 링크 클릭 시 alert (현재 로직 유지).
- **listMemberOnly + 비로그인**: 기존 에러 카드 유지.
- **gallery 모드**: 본 재설계의 그리드 행은 무시되고 기존 갤러리 인라인 렌더 사용.
- **showPostNumber 토글 직후**: 로컬 상태 변화만으로 즉시 반영 — 별도 재로드 불필요.
- **번호 재계산(글 삭제/추가)**: 현재 보고 있는 페이지 내 번호가 바뀔 수 있음 — 수용.

---

## 6. 테스트 / 검증

**뷰포트 매트릭스 (Chrome DevTools 수동)**
- 375×667 (iPhone SE)
- 393×852 (iPhone 14 Pro)
- 768×1024 (iPad portrait) — 데스크톱 전환 경계
- 1280×800 (laptop)

**체크리스트**
- [ ] `showPostNumber=true` 에서 데스크톱에 번호 컬럼 표시, 모바일에선 숨김
- [ ] `showPostNumber=false` 에서 데스크톱 5컬럼, 헤더도 5컬럼
- [ ] 공지글: 양 모드에서 amber 배경 + `[공지]` 배지, 데스크톱에선 번호 자리에
- [ ] 공지만 있고 일반글 0 → 공지 표시 + 빈 상태 메시지
- [ ] "더 보기" 로 페이지 2 append 후 번호가 이어짐 (예: 128 → 127 → … → 109)
- [ ] 비밀글 🔒 + 권한 없을 때 alert
- [ ] 첨부 아이콘 표시
- [ ] 댓글 수 `[N]`: 공지·일반 모두, 데스크톱 제목 옆
- [ ] 모바일 메타 아이콘 렌더(Eye/MessageSquare/ThumbsUp)
- [ ] 데스크톱 hover 배경 전환, 모바일 tap 시 이동
- [ ] i18n: ko/en 모두 "번호"/"No." 등 대응 (신규 키만 추가, 기존 재사용 가능한 건 재사용)
- [ ] 어드민 설정에서 토글 ON/OFF 저장 후 프론트 반영

---

## 7. 변경하지 않는 것

- 상세 페이지(`BoardPostPage.tsx`) — 2026-04-19 디자인 유지
- 글쓰기·수정 페이지
- 권한/인증, 비밀글, 첨부 업로드 로직
- 갤러리 뷰 (`displayType==='gallery'`)
- `sortOrder` 정책 (popular/latest/oldest)
- 공지·일반 외 상태(`status`) 분기

---

## 8. 열린 이슈 / 후속 작업

- 갤러리 뷰 재디자인 — 별도 스펙
- 검색 UI — 현재 API 레벨로만 존재, 프론트 노출은 별건
- `sortOrder` 변경 UI — 별건
- 공지 페이지네이션 — 공지가 많아질 경우(>20?) 필요해질 수 있음. 현 스펙에선 "공지는 소수"라는 가정으로 전체 노출
