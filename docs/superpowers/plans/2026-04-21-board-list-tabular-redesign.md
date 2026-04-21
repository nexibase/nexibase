# Board List Tabular Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the board list view to a traditional Korean-community "게시판" layout — tabular on desktop (number · title · author · date · views · likes), 2-line with icon meta on mobile — all from a single JSX tree driven by CSS Grid responsive rules. Add a per-board toggle for post-number display. Fix the dead-code notices path so pinned notices render with amber background and `[공지]` badge.

**Architecture:** Single unified `PostListRow` component rendered via CSS Grid whose template switches at `md:` breakpoint. API separates notices and paginated posts into two arrays; client computes display numbers as `total − (page−1) × limit − index`. New `Board.showPostNumber` boolean drives column visibility. Plugin-internal changes only; no core file modifications.

**Tech Stack:** Next.js 15 (App Router, Turbopack), TypeScript, Tailwind CSS, Prisma 6, shadcn/ui, lucide-react, next-intl.

**Spec:** [docs/superpowers/specs/2026-04-21-board-list-tabular-redesign-design.md](../specs/2026-04-21-board-list-tabular-redesign-design.md)

**Feedback memory to respect:**
- Mobile fonts: body ≥15px, meta ≥12–13px, no 10–11px.
- Core-unchanged rule: do not modify files outside `src/plugins/boards/`.
- Prisma: edit `src/plugins/boards/schema.prisma` only. `prisma/schema.prisma` is a gitignored generated artifact.
- i18n: edit `src/plugins/boards/locales/*.json`. `src/messages/*.json` is a generated artifact.

---

## File Structure

**Modified files:**

| File | Responsibility |
|---|---|
| `src/plugins/boards/schema.prisma` | Add `showPostNumber` Boolean to Board model |
| `src/plugins/boards/api/[slug]/posts/route.ts` | Separate notices/posts queries; include `showPostNumber` in board payload |
| `src/plugins/boards/admin/api/[id]/route.ts` | Accept `showPostNumber` in PUT body |
| `src/plugins/boards/admin/[id]/page.tsx` | Add toggle checkbox in Display settings card |
| `src/plugins/boards/components/BoardListPage.tsx` | Update Post/Board interfaces; wire new API shape; delegate row rendering to `PostListRow` |
| `src/plugins/boards/locales/ko.json` | Add `admin.showPostNumberLabel`, `admin.showPostNumberHelp`, `list.columnNumber`, etc. |
| `src/plugins/boards/locales/en.json` | Same keys, English strings |

**New file:**

| File | Responsibility |
|---|---|
| `src/plugins/boards/components/PostListRow.tsx` | Render a single row (notice or regular) using CSS Grid. Handles all responsive show/hide via Tailwind classes |

---

## Visual Verification Convention

UI-touching steps end with a visual check instead of a unit test:

1. Dev server is running (`npm run dev` — already running from Task 0).
2. Open Chrome DevTools at `http://localhost:3000/boards/<slug>` (use any existing board slug; replace `<slug>`).
3. Toggle device toolbar to **iPhone SE (375×667)** for mobile checks.
4. Toggle off device toolbar and use **≥1024px** window for desktop checks.
5. Confirm each acceptance criterion listed in the step.

For API steps, verify via `curl` to the dev server.

---

## Task 0: Setup

**Files:** none

- [ ] **Step 0.1: Create feature branch**

```bash
cd /home/kagla/nexibase
git checkout main
git pull --ff-only
git checkout -b feat/board-list-tabular-redesign
```

Expected: `Switched to a new branch 'feat/board-list-tabular-redesign'`.

- [ ] **Step 0.2: Start the dev server in the background**

```bash
npm run dev
```

Run in background (`run_in_background: true` for Bash tool). Server listens on `http://localhost:3000`. Keep running through the whole plan.

- [ ] **Step 0.3: Smoke-test current board list**

Open `http://localhost:3000/boards/<slug>` (use any existing board slug — discover via `/admin/boards` if needed). Confirm the list loads with at least one post and the page does not error. Note any board with at least one `isNotice` post for later visual checks (or create one via the write flow, with an admin account).

Do **not** commit.

---

## Task 1: i18n keys for admin toggle and column header

**Files:**
- Modify: `src/plugins/boards/locales/ko.json`
- Modify: `src/plugins/boards/locales/en.json`

**Goal:** Add the i18n strings the later tasks consume. Isolating i18n first avoids noisy churn later.

- [ ] **Step 1.1: Add keys to Korean locale**

Open `src/plugins/boards/locales/ko.json`. Inside the `"admin"` object, add the following two keys (keep alphabetical order with neighbors where the file already sorts; otherwise append before the closing brace of `"admin"`):

```json
"showPostNumberLabel": "게시글 번호 표시",
"showPostNumberHelp": "목록에 순번을 표시합니다. 글 추가/삭제에 따라 번호가 재계산될 수 있습니다.",
```

Inside the top-level `"boards"` object (at the same level as `"admin"`), add — or extend if already present — the following (these are used by the new desktop header row):

```json
"colNumber": "번호",
"colTitle": "제목",
"colAuthor": "글쓴이",
"colDate": "날짜",
"colViews": "조회",
"colLikes": "추천",
"noticeBadgeShort": "공지"
```

If `noticeBadge` already exists, keep it; `noticeBadgeShort` may reuse the same string. Otherwise add it.

- [ ] **Step 1.2: Add matching keys to English locale**

In `src/plugins/boards/locales/en.json`, mirror the additions with English translations:

```json
"showPostNumberLabel": "Show post number",
"showPostNumberHelp": "Displays sequential numbers in the list. Numbers may shift as posts are added or removed.",
```

And under `"boards"` (top-level):

```json
"colNumber": "No.",
"colTitle": "Title",
"colAuthor": "Author",
"colDate": "Date",
"colViews": "Views",
"colLikes": "Likes",
"noticeBadgeShort": "Notice"
```

- [ ] **Step 1.3: Verify i18n merges into generated messages**

```bash
node scripts/scan-plugins.js
```

Then:

```bash
grep -l showPostNumberLabel src/messages/
```

Expected: both `src/messages/ko.json` and `src/messages/en.json` appear (these are generated artifacts — do not edit them directly).

- [ ] **Step 1.4: Commit**

```bash
git add src/plugins/boards/locales/ko.json src/plugins/boards/locales/en.json
git commit -m "$(cat <<'EOF'
i18n(boards): keys for post-number toggle and list column headers

Adds admin-side showPostNumberLabel/Help and list-side column
header keys (colNumber, colTitle, colAuthor, colDate, colViews,
colLikes, noticeBadgeShort) used by the tabular list redesign.

---

게시판 목록 탭형 리디자인에 쓰일 번호 토글 설정 라벨과 데스크톱
컬럼 헤더(번호·제목·글쓴이·날짜·조회·추천) 키를 ko/en 양쪽에 추가.
EOF
)"
```

---

## Task 2: Prisma schema — add `Board.showPostNumber`

**Files:**
- Modify: `src/plugins/boards/schema.prisma:1-28`

**Goal:** Add the new boolean field with default `false` so existing boards keep their current (no-number) behavior.

- [ ] **Step 2.1: Edit the plugin schema**

In `src/plugins/boards/schema.prisma`, inside `model Board { ... }`, add a new field between `displayType` and the `posts` relation:

```prisma
  displayType       String   @default("list") @db.VarChar(20)
  showPostNumber    Boolean  @default(false)
  posts             Post[]
```

- [ ] **Step 2.2: Regenerate merged schema**

```bash
node scripts/scan-plugins.js
```

Then verify the merged output contains the new field:

```bash
grep showPostNumber prisma/schema.prisma
```

Expected: a line like `showPostNumber    Boolean  @default(false)`.

- [ ] **Step 2.3: Create and apply the migration**

```bash
npx prisma migrate dev --name board_show_post_number
```

Expected: Prisma creates a new migration directory under `prisma/migrations/` (check: `ls prisma/migrations/ | tail -n 3`) and applies it. Prisma Client regenerates. No prompts to reset the database.

- [ ] **Step 2.4: Verify field exists in DB**

```bash
npx prisma db execute --stdin <<'SQL'
SHOW COLUMNS FROM boards LIKE 'showPostNumber';
SQL
```

Expected: one row reporting the column `showPostNumber`, type `tinyint(1)`, default `0`.

- [ ] **Step 2.5: Commit**

```bash
git add src/plugins/boards/schema.prisma prisma/migrations
git commit -m "$(cat <<'EOF'
feat(boards): add Board.showPostNumber for per-board number toggle

Default false so existing boards keep their current (number-less)
list. Admin UI and API consumption land in later commits.

---

게시판별 순번 노출 여부를 토글할 수 있도록 Board.showPostNumber 필드
를 추가. 기본값 false — 기존 게시판 동작 불변. 어드민 UI·API 반영은
후속 커밋에서.
EOF
)"
```

> Note: `prisma/schema.prisma` is gitignored (a merge artifact), so only the plugin schema and the new migration under `prisma/migrations/` are committed.

---

## Task 3: Admin — accept and toggle `showPostNumber`

**Files:**
- Modify: `src/plugins/boards/admin/api/[id]/route.ts:62-79, 117-137`
- Modify: `src/plugins/boards/admin/[id]/page.tsx:16-60, 62-89, 271-293`

**Goal:** Expose the toggle in the board settings UI and accept it via PUT.

- [ ] **Step 3.1: Extend the admin PUT handler destructuring**

In `src/plugins/boards/admin/api/[id]/route.ts`, find the destructuring on lines 62-79 and add `showPostNumber`:

```ts
    const {
      slug,
      name,
      description,
      category,
      listMemberOnly,
      readMemberOnly,
      writeMemberOnly,
      commentMemberOnly,
      useComment,
      useReaction,
      useFile,
      useSecret,
      postsPerPage,
      sortOrder,
      displayType,
      showPostNumber,
      isActive
    } = body
```

- [ ] **Step 3.2: Write the field on update**

In the same file, inside the `prisma.board.update({ ..., data: { ... } })` call (around lines 117-137), add `showPostNumber` with the same null-coalesce pattern as its peers. Place it between `displayType` and `isActive`:

```ts
        displayType: displayType || existingBoard.displayType,
        showPostNumber: showPostNumber ?? existingBoard.showPostNumber,
        isActive: isActive ?? existingBoard.isActive
```

- [ ] **Step 3.3: Extend the admin page `Board` interface and form state**

In `src/plugins/boards/admin/[id]/page.tsx`, update the `Board` interface (lines 16-35) to include:

```ts
interface Board {
  // ...existing fields...
  displayType: string
  showPostNumber: boolean
  isActive: boolean
  postCount: number
}
```

Update the `useState` default in `formData` (lines 44-60):

```ts
  const [formData, setFormData] = useState({
    // ...existing fields...
    displayType: 'list',
    showPostNumber: false,
    isActive: true,
  })
```

Update the load-from-fetch call (lines 69-85) so it hydrates the new field:

```ts
          setFormData({
            // ...existing fields...
            displayType: b.displayType || 'list',
            showPostNumber: b.showPostNumber ?? false,
            isActive: b.isActive ?? true,
          })
```

- [ ] **Step 3.4: Add the toggle control**

In the Display settings card (lines 271-293), add a third row after the existing `displayType`/`sortOrder` grid. Replace the whole `<Card>` block that starts with `{/* Display settings */}` with:

```tsx
          {/* Display settings */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">{t('admin.displaySettings')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('admin.displayType')}</Label>
                  <select value={formData.displayType} onChange={e => setFormData({ ...formData, displayType: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="list">{t('admin.displayList')}</option>
                    <option value="gallery">{t('admin.displayGallery')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t('admin.sortOrder')}</Label>
                  <select value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="latest">{t('admin.sortLatest')}</option>
                    <option value="popular">{t('admin.sortPopular')}</option>
                    <option value="oldest">{t('admin.sortOldest')}</option>
                  </select>
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-gray-300"
                  checked={formData.showPostNumber}
                  onChange={e => setFormData({ ...formData, showPostNumber: e.target.checked })}
                />
                <div>
                  <div className="text-sm font-medium">{t('admin.showPostNumberLabel')}</div>
                  <div className="text-xs text-muted-foreground">{t('admin.showPostNumberHelp')}</div>
                </div>
              </label>
            </CardContent>
          </Card>
```

- [ ] **Step 3.5: Visual verify**

In the browser, go to `/admin/boards`, click any board, scroll to "표시 설정" (Display settings) card. Confirm:

- [ ] Checkbox with label "게시글 번호 표시" and helper text below is visible.
- [ ] Toggling it and clicking "저장" saves without error.
- [ ] Reopening the edit page shows the checkbox state persisted.

Verify the round-trip via DB:

```bash
npx prisma db execute --stdin <<'SQL'
SELECT id, slug, showPostNumber FROM boards LIMIT 5;
SQL
```

Expected: at least one row reflects whatever you toggled.

- [ ] **Step 3.6: Commit**

```bash
git add src/plugins/boards/admin
git commit -m "$(cat <<'EOF'
feat(boards): admin toggle for showPostNumber

Adds a checkbox in the Display settings card and wires the field
through the PUT /api/admin/boards/[id] handler. No frontend list
consumption yet — that lands in the list rewrite commit.

---

어드민 '표시 설정' 카드에 게시글 번호 표시 체크박스를 추가하고
PUT 핸들러에서 해당 값을 저장·로드. 목록 쪽 소비는 후속 커밋에서.
EOF
)"
```

---

## Task 4: API — separate notices + expose `showPostNumber`

**Files:**
- Modify: `src/plugins/boards/api/[slug]/posts/route.ts:44-158`

**Goal:** Return notices and paginated non-notice posts as separate arrays. `pagination.total` counts only non-notice. Add `showPostNumber` to the returned board payload.

- [ ] **Step 4.1: Restructure the GET handler body**

Open `src/plugins/boards/api/[slug]/posts/route.ts`. Replace the block from `const limit = board.postsPerPage` through the final `return NextResponse.json({ ... })` in the GET handler (roughly lines 44-158) with the version below. The select shape stays unchanged from the existing query; the key differences are the split queries, the notice-excluded total, and the `showPostNumber` field in the returned `board`.

```ts
    const limit = board.postsPerPage
    const skip = (page - 1) * limit

    // Base filter shared by notice and regular queries
    const baseWhere: Record<string, unknown> = {
      boardId: board.id,
      status: 'published',
    }

    if (search) {
      baseWhere.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ]
    }

    // Non-notice sort (notice sort field is dropped because notices are fetched separately)
    let orderBy: Record<string, string>[] = []
    switch (board.sortOrder) {
      case 'popular':
        orderBy = [{ viewCount: 'desc' }, { createdAt: 'desc' }]
        break
      case 'oldest':
        orderBy = [{ createdAt: 'asc' }]
        break
      default:
        orderBy = [{ createdAt: 'desc' }]
    }

    // In gallery mode, also fetch attachment info
    const includeAttachments = board.displayType === 'gallery'

    const postSelect = {
      id: true,
      title: true,
      status: true,
      isNotice: true,
      isSecret: true,
      viewCount: true,
      likeCount: true,
      commentCount: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          uuid: true,
          nickname: true,
          image: true,
        },
      },
      _count: {
        select: { attachments: true },
      },
      ...(includeAttachments && {
        attachments: {
          where: { mimeType: { startsWith: 'image/' } },
          take: 1,
          orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
          select: {
            id: true,
            filePath: true,
            thumbnailPath: true,
            mimeType: true,
          },
        },
      }),
    }

    const noticeWhere = { ...baseWhere, isNotice: true }
    const postWhere = { ...baseWhere, isNotice: false }

    const [notices, posts, total] = await Promise.all([
      prisma.post.findMany({
        where: noticeWhere,
        orderBy: [{ createdAt: 'desc' }],
        select: postSelect,
      }),
      prisma.post.findMany({
        where: postWhere,
        skip,
        take: limit,
        orderBy,
        select: postSelect,
      }),
      prisma.post.count({ where: postWhere }),
    ])

    // Attach thumbnail info in gallery mode (applies to both arrays)
    const attachThumbnail = <T extends { attachments?: { filePath: string; thumbnailPath?: string | null }[] }>(list: T[]) =>
      list.map(p => {
        const attachment = p.attachments?.[0]
        return {
          ...p,
          thumbnail: attachment?.thumbnailPath || attachment?.filePath || null,
          attachments: undefined,
        }
      })

    const finalNotices = includeAttachments ? attachThumbnail(notices as never) : notices
    const finalPosts   = includeAttachments ? attachThumbnail(posts as never)   : posts

    return NextResponse.json({
      success: true,
      board: {
        id: board.id,
        slug: board.slug,
        name: board.name,
        description: board.description,
        writeMemberOnly: board.writeMemberOnly,
        useComment: board.useComment,
        useReaction: board.useReaction,
        displayType: board.displayType,
        showPostNumber: board.showPostNumber,
      },
      notices: finalNotices,
      posts: finalPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
```

- [ ] **Step 4.2: Functional verification via curl**

With the dev server running, hit the endpoint for a board you know has at least one notice post:

```bash
curl -s "http://localhost:3000/api/boards/<slug>/posts?page=1" | python3 -m json.tool | head -60
```

Expected JSON shape (abbreviated):

```json
{
  "success": true,
  "board": { "id": 1, "slug": "...", "showPostNumber": false, ... },
  "notices": [ { "id": ..., "isNotice": true, ... } ],
  "posts":   [ { "id": ..., "isNotice": false, ... } ],
  "pagination": { "page": 1, "limit": 20, "total": <non-notice-count>, "totalPages": ... }
}
```

Confirm: `notices` contains only `isNotice: true` entries; `posts` contains only `isNotice: false` entries; `pagination.total` equals the non-notice count (compare with `SELECT COUNT(*) FROM posts WHERE boardId=<id> AND isNotice=0`).

- [ ] **Step 4.3: Commit**

```bash
git add src/plugins/boards/api/[slug]/posts/route.ts
git commit -m "$(cat <<'EOF'
fix(boards): separate notices from paginated posts in list API

Previously all posts (notice + regular) shared the same paginated
array, which combined with the client's notice/post split produced
dead code and lost the notice visual treatment. Now returns
notices[] (full) and posts[] (paginated, non-notice) as distinct
arrays. pagination.total excludes notices so downstream numbering
stays consistent. Also exposes showPostNumber on the board payload.

---

공지글과 일반글을 한 배열로 합쳐서 내려주던 방식을 분리해, notices
(전체)와 posts(일반글 페이지네이션) 두 배열로 응답. 클라이언트의
공지 전용 렌더 경로가 살아나서 배지·배경 시각 구분이 동작하게 됨.
pagination.total은 공지 제외 수로, 번호 계산과 일관성 확보.
board 페이로드에 showPostNumber 포함.
EOF
)"
```

---

## Task 5: Client — consume new API shape (interim, keep old render)

**Files:**
- Modify: `src/plugins/boards/components/BoardListPage.tsx:25-50, 75-137`

**Goal:** Update types and state to match the new API response so notices render (with the existing — currently dead — notice block) and `showPostNumber` is readable. No layout change yet; this step is pure plumbing.

- [ ] **Step 5.1: Extend interfaces**

In `src/plugins/boards/components/BoardListPage.tsx`, update the `Board` interface (lines 25-38) to add `showPostNumber`:

```ts
interface Board {
  id: string
  slug: string
  name: string
  description: string | null
  listMemberOnly: boolean
  readMemberOnly: boolean
  writeMemberOnly: boolean
  commentMemberOnly: boolean
  useComment: boolean
  useReaction: boolean
  postsPerPage: number
  displayType: string
  showPostNumber: boolean
}
```

- [ ] **Step 5.2: Store `total` in state for number calc**

Inside the component (around lines 75-85), add a `total` state alongside `page`/`totalPages`:

```ts
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
```

In `fetchPosts` (around lines 101-137), replace the success branch with:

```ts
      if (data.success) {
        setBoard(data.board)
        setPosts(prev => append ? [...prev, ...data.posts] : data.posts)
        if (!append) setNotices(data.notices || [])
        setTotal(data.pagination.total)
        setTotalPages(data.pagination.totalPages)
      }
```

(The existing `setNotices` line already expected this shape; it just starts working now.)

- [ ] **Step 5.3: Visual verify notice revival**

Refresh the board list page (desktop, ≥1024px) for a board with at least one notice. Confirm:

- [ ] A notice card/row appears above the regular list with `bg-red-500/5` background and `[공지]` badge (from the existing notice block at current lines 246-292).
- [ ] Notice posts no longer appear duplicated inside the regular list (because API now filters them out).
- [ ] Regular list still renders normally in 2-line mode (no layout change yet).

On mobile (375px) the same block should render — it's the same JSX path. Confirm briefly.

- [ ] **Step 5.4: Commit**

```bash
git add src/plugins/boards/components/BoardListPage.tsx
git commit -m "$(cat <<'EOF'
fix(boards): wire notices from API, surface showPostNumber

Consumes the notices[] array and pagination.total from the list API.
The existing notice block (previously dead because the API didn't
send notices) now renders. No layout changes to the regular list
yet — that lands in the next commit.

---

API가 새로 내려주는 notices 배열과 pagination.total을 상태에 반영.
이전엔 항상 빈 배열이었던 공지 전용 렌더 블록이 드디어 동작. 일반
목록 레이아웃 변경은 다음 커밋에서.
EOF
)"
```

---

## Task 6: Client — PostListRow component + replace list rendering

**Files:**
- Create: `src/plugins/boards/components/PostListRow.tsx`
- Modify: `src/plugins/boards/components/BoardListPage.tsx:244-410`

**Goal:** Introduce the unified grid-based row renderer. Replace both the existing notice block and the existing 2-line regular-post block with the new row. Add a desktop-only header row. Switch the `💬` emoji to `MessageSquare`.

- [ ] **Step 6.1: Create `PostListRow.tsx`**

Create `src/plugins/boards/components/PostListRow.tsx` with the full contents below:

```tsx
"use client"

import Link from "next/link"
import { Eye, ThumbsUp, MessageSquare, Lock, Paperclip, Pin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { UserNickname } from "@/components/UserNickname"
import { useTranslations } from "next-intl"

interface PostAuthor {
  id: string
  uuid?: string
  nickname: string | null
  name?: string
  image: string | null
}

export interface PostListRowData {
  id: string
  title: string
  viewCount: number
  likeCount: number
  commentCount: number
  isNotice: boolean
  isSecret: boolean
  createdAt: string
  author: PostAuthor
  _count?: { attachments: number }
}

export interface PostListRowBoard {
  slug: string
  useComment: boolean
  useReaction: boolean
  showPostNumber: boolean
}

export interface PostListRowViewer {
  id?: string
  role?: string
}

interface PostListRowProps {
  post: PostListRowData
  board: PostListRowBoard
  displayNumber: number | null // null = notice (no number), or showPostNumber false
  viewer: PostListRowViewer | null
  isAdmin: boolean
  formatDate: (iso: string) => string
  onSecretBlocked: () => void
}

/**
 * Unified list row. One DOM tree; CSS Grid + md: breakpoint
 * selects between the desktop table layout and the mobile 2-line layout.
 */
export function PostListRow({
  post,
  board,
  displayNumber,
  viewer,
  isAdmin,
  formatDate,
  onSecretBlocked,
}: PostListRowProps) {
  const t = useTranslations('boards')
  const blocked = post.isSecret && post.author.id !== viewer?.id && !isAdmin
  const href = blocked ? '#' : `/boards/${board.slug}/${post.id}`

  const onClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-user-nickname]')) return
    if (blocked) {
      e.preventDefault()
      onSecretBlocked()
    }
  }

  // Grid templates:
  //   mobile (default): 1fr / "title" "meta"
  //   desktop (md+):   50px 1fr 90px 60px 50px 50px  (with-number)
  //                     1fr 90px 60px 50px 50px       (hide-number)
  const showNumberCol = board.showPostNumber
  const gridDesktop = showNumberCol
    ? "md:[grid-template-columns:50px_1fr_90px_60px_50px_50px] md:[grid-template-areas:'num_title_author_date_views_likes']"
    : "md:[grid-template-columns:1fr_90px_60px_50px_50px] md:[grid-template-areas:'title_author_date_views_likes']"

  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "grid gap-x-3 gap-y-1 items-center px-3 py-2.5 border-b border-border hover:bg-muted/40 transition-colors",
        "[grid-template-columns:1fr] [grid-template-areas:'title'_'meta']",
        "md:px-2 md:py-2",
        gridDesktop,
        post.isNotice ? "bg-amber-50 dark:bg-amber-950/20" : "",
      ].join(" ")}
    >
      {/* Number cell — desktop only, when showPostNumber is on */}
      {showNumberCol && (
        <div className="hidden md:flex md:items-center md:justify-center text-xs text-muted-foreground tabular-nums [grid-area:num]">
          {post.isNotice ? (
            <Badge variant="destructive" className="text-[11px] px-1.5 py-0">
              <Pin className="h-3 w-3 mr-1" />
              {t('noticeBadgeShort')}
            </Badge>
          ) : (
            displayNumber ?? ''
          )}
        </div>
      )}

      {/* Title cell */}
      <div className="min-w-0 [grid-area:title] md:text-left">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Notice badge — visible when not shown in number cell
              (mobile always; desktop when number column is hidden) */}
          {post.isNotice && (
            <Badge
              variant="destructive"
              className={[
                "shrink-0 text-[11px] px-1.5 py-0",
                showNumberCol ? "md:hidden" : "",
              ].join(" ")}
            >
              <Pin className="h-3 w-3 mr-1" />
              {t('noticeBadgeShort')}
            </Badge>
          )}
          {post.isSecret && <Lock className="h-3.5 w-3.5 shrink-0 text-yellow-500" />}
          <span className="truncate text-[15px] md:text-[14px] font-medium">{post.title}</span>
          {/* Desktop-only inline comment count */}
          {board.useComment && post.commentCount > 0 && (
            <span className="hidden md:inline shrink-0 text-destructive font-semibold text-[13px]">
              [{post.commentCount}]
            </span>
          )}
          {post._count && post._count.attachments > 0 && (
            <Paperclip className="hidden md:inline shrink-0 h-3.5 w-3.5 text-muted-foreground ml-0.5" />
          )}
        </div>

        {/* Mobile meta line (inside title cell) */}
        <div className="flex md:hidden flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted-foreground mt-1">
          <UserNickname
            userId={post.author.id}
            uuid={post.author.uuid}
            nickname={post.author.nickname}
            image={post.author.image}
            className="text-muted-foreground"
          />
          <span className="opacity-50">·</span>
          <span>{formatDate(post.createdAt)}</span>
          <span className="opacity-50">·</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount}</span>
          {board.useComment && post.commentCount > 0 && (
            <>
              <span className="opacity-50">·</span>
              <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{post.commentCount}</span>
            </>
          )}
          {board.useReaction && post.likeCount > 0 && (
            <>
              <span className="opacity-50">·</span>
              <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{post.likeCount}</span>
            </>
          )}
          {post._count && post._count.attachments > 0 && (
            <>
              <span className="opacity-50">·</span>
              <Paperclip className="h-3 w-3" />
            </>
          )}
        </div>
      </div>

      {/* Desktop-only cells */}
      <div className="hidden md:block text-center text-[13px] text-muted-foreground truncate [grid-area:author]">
        <UserNickname
          userId={post.author.id}
          uuid={post.author.uuid}
          nickname={post.author.nickname}
          image={post.author.image}
          className="text-muted-foreground"
        />
      </div>
      <div className="hidden md:block text-center text-[13px] text-muted-foreground tabular-nums [grid-area:date]">
        {formatDate(post.createdAt)}
      </div>
      <div className="hidden md:block text-center text-[13px] text-muted-foreground tabular-nums [grid-area:views]">
        {post.viewCount}
      </div>
      <div className="hidden md:block text-center text-[13px] text-muted-foreground tabular-nums [grid-area:likes]">
        {board.useReaction ? post.likeCount : ''}
      </div>
    </Link>
  )
}
```

- [ ] **Step 6.2: Add a desktop header row + swap rendering in `BoardListPage.tsx`**

In `src/plugins/boards/components/BoardListPage.tsx`, import the new component near the top (after other imports):

```tsx
import { PostListRow } from "./PostListRow"
```

The outer wrapper `<div className="divide-y divide-border">` (current line 244) and its closing `</div>` (current line 436) stay. The **Load more** block (current lines 412-435) stays. Replace everything **inside** that wrapper **above** the Load more block — that is, the notices block (current lines 246-292) and the post-list branch including its `{posts.length === 0 ? ... : board.displayType === 'gallery' ? ... : ...}` conditional (current lines 294-410) — with the structure below. The gallery JSX is preserved verbatim within the new structure's `else` branch.

```tsx
            {/* Notices + posts unified grid */}
            {board.displayType === 'list' ? (
              <div className="divide-y-0">
                {/* Desktop header row */}
                <div
                  className={[
                    "hidden md:grid gap-x-3 items-center px-2 py-2 bg-muted/50 border-b border-border",
                    "text-[12px] font-semibold text-muted-foreground",
                    board.showPostNumber
                      ? "md:[grid-template-columns:50px_1fr_90px_60px_50px_50px] md:[grid-template-areas:'num_title_author_date_views_likes']"
                      : "md:[grid-template-columns:1fr_90px_60px_50px_50px] md:[grid-template-areas:'title_author_date_views_likes']",
                  ].join(" ")}
                >
                  {board.showPostNumber && (
                    <div className="text-center [grid-area:num]">{t('colNumber')}</div>
                  )}
                  <div className="text-center [grid-area:title]">{t('colTitle')}</div>
                  <div className="text-center [grid-area:author]">{t('colAuthor')}</div>
                  <div className="text-center [grid-area:date]">{t('colDate')}</div>
                  <div className="text-center [grid-area:views]">{t('colViews')}</div>
                  <div className="text-center [grid-area:likes]">{t('colLikes')}</div>
                </div>

                {/* Notices */}
                {notices.map(notice => (
                  <PostListRow
                    key={`n-${notice.id}`}
                    post={notice}
                    board={board}
                    displayNumber={null}
                    viewer={user}
                    isAdmin={isAdmin}
                    formatDate={formatDate}
                    onSecretBlocked={() => alert(t('secretPostAlert'))}
                  />
                ))}

                {/* Regular posts (or empty state when none) */}
                {posts.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    {t('noPosts')}
                  </div>
                ) : (
                  posts.map((post, i) => (
                    <PostListRow
                      key={post.id}
                      post={post}
                      board={board}
                      displayNumber={
                        board.showPostNumber
                          ? total - (page - 1) * board.postsPerPage - i
                          : null
                      }
                      viewer={user}
                      isAdmin={isAdmin}
                      formatDate={formatDate}
                      onSecretBlocked={() => alert(t('secretPostAlert'))}
                    />
                  ))
                )}
              </div>
            ) : posts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {t('noPosts')}
              </div>
            ) : (
              /* Gallery view — preserved from previous implementation */
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={(e) => handlePostClick(post, e)}
                      className="group cursor-pointer"
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square relative rounded-lg overflow-hidden bg-muted mb-2">
                        {post.thumbnail ? (
                          <img
                            src={post.thumbnail}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                        )}
                        {post.isSecret && (
                          <div className="absolute top-2 left-2">
                            <Lock className="h-4 w-4 text-yellow-500 drop-shadow-md" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="space-y-1">
                        <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {post.title}
                          {post.commentCount > 0 && board.useComment && (
                            <span className="text-primary ml-1">[{post.commentCount}]</span>
                          )}
                          {post._count && post._count.attachments > 0 && (
                            <Paperclip className="h-3 w-3 text-muted-foreground ml-1 inline" />
                          )}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{post.author.nickname}</span>
                          <span className="flex items-center gap-0.5">
                            <Eye className="h-3 w-3" />
                            {post.viewCount}
                          </span>
                          {board.useReaction && post.likeCount > 0 && (
                            <span className="flex items-center gap-0.5">
                              <ThumbsUp className="h-3 w-3" />
                              {post.likeCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
```

> **Important:** when replacing, keep the entire existing gallery branch block intact (the full JSX from original lines 302-355 inclusive of the `<div className="aspect-square ...">` block). Only the notices block and the list-view branch are swapped out. The `{page < totalPages && …}` Load-more block after them stays unchanged.

Clean up imports at the top of `BoardListPage.tsx`:

- **Remove** the `Badge` import line (`import { Badge } from "@/components/ui/badge"`) — no longer referenced in this file (moved into `PostListRow`).
- **Remove** `Pin` from the `lucide-react` import — used only in the old notice block.
- **Keep** `Loader2`, `Eye`, `ThumbsUp`, `Lock`, `PenSquare`, `Home`, `ImageIcon`, `Paperclip`, `Settings` — all still referenced (loading state, gallery view, write button, board header, error state).
- **Keep** the `UserNickname` import if present — it's still used indirectly through PostListRow, but may also appear here if any leftover code references it; if no leftover references exist, remove it.

- [ ] **Step 6.3: Visual verify — desktop**

Reload `/boards/<slug>` on a ≥1024px window.

- [ ] Header row shows: (번호) 제목 글쓴이 날짜 조회 추천 — with/without "번호" depending on `showPostNumber`.
- [ ] Notice rows appear first with `bg-amber-50` background and `[공지]` badge in the number cell (if `showPostNumber=true`) or as a prefix in the title cell (if `showPostNumber=false`).
- [ ] Regular rows show title on the left with `[N]` comment count inline (if any) and attachment paperclip inline.
- [ ] Author/date/views/likes are in their own centered columns.
- [ ] Hover highlights the row (`bg-muted/40`).

- [ ] **Step 6.4: Visual verify — mobile**

Switch to iPhone SE (375×667).

- [ ] Rows become 2-line: title on top, meta with icons (`👁 342 · 💬 12 · 👍 28`) below.
- [ ] No column header visible.
- [ ] Notice rows still have amber background; `[공지]` badge is prefix in the title line.
- [ ] `[N]` comment count does NOT appear next to the title (mobile uses the meta icon instead).
- [ ] Tap a regular row → navigates to post. Tap a blocked secret post → alerts.

- [ ] **Step 6.5: Commit**

```bash
git add src/plugins/boards/components/PostListRow.tsx src/plugins/boards/components/BoardListPage.tsx
git commit -m "$(cat <<'EOF'
refactor(boards): single grid-based row for list (desktop table / mobile 2-line)

Extracts PostListRow — one JSX tree that renders as a 6-column
(or 5-column) table row on md+ and collapses to a 2-line compact
row on mobile via CSS Grid template switching. Desktop header row
added above the rows. Replaces the dead notice block with live
PostListRow instances against the new API notices array. Mobile
meta uses lucide MessageSquare in place of the 💬 emoji.

---

데스크톱에선 표 형태, 모바일에선 2줄 행으로 전환되는 통합 행 컴포넌트
PostListRow를 도입. CSS Grid 템플릿을 브레이크포인트별로 교체하고
JSX는 하나만 유지. 데스크톱 전용 컬럼 헤더 행도 추가. 죽어있던 공지
블록을 새 API notices 배열 기반 PostListRow로 교체. 💬 이모지는
lucide MessageSquare로 치환.
EOF
)"
```

---

## Task 7: Enable post-number display end-to-end

**Files:** no code changes (verification only)

**Goal:** Confirm the number display works through the toggle. Task 3 already wrote the toggle; Task 6 already computed `displayNumber`. This task verifies the round trip and catches any off-by-one.

- [ ] **Step 7.1: Turn on `showPostNumber` for a board**

Via the admin UI at `/admin/boards/<id>`, toggle "게시글 번호 표시" to on and save.

- [ ] **Step 7.2: Verify desktop shows numbers**

Reload the public list page for that board on desktop.

- [ ] Desktop header includes "번호" column.
- [ ] Regular post numbers descend: the newest post should show `total` (confirm with `curl` to `/api/boards/<slug>/posts?page=1` and check `pagination.total`).
- [ ] Notice rows show `[공지]` in the number cell, not a number.

- [ ] **Step 7.3: Verify page 2 continuation**

If the board has more than `postsPerPage` non-notice posts, scroll to the bottom and click "더 보기". Expected: the next batch's first item is numbered `total - postsPerPage`, continuing the descending sequence without gaps (barring concurrent edits).

- [ ] **Step 7.4: Verify mobile hides numbers**

Switch to iPhone SE. Number column should be absent from both rows and the (now hidden) header.

- [ ] **Step 7.5: Verify toggle off**

Toggle `showPostNumber` back off in admin. Reload list. Desktop header loses the 번호 column; rows reflow to 5-column layout. Commit is not needed since no code changed — this task is purely a gate.

If any of the above fail, return to Task 3 or Task 6 and fix before moving on.

---

## Task 8: Edge-case sweep and final polish

**Files:** possibly `src/plugins/boards/components/PostListRow.tsx` or `BoardListPage.tsx` for minor fixes only

**Goal:** Walk the spec's edge cases and catch anything the happy-path checks missed.

- [ ] **Step 8.1: Empty board**

Find or create a board with zero posts and zero notices. Visit its list page.

- [ ] Shows "게시물이 없습니다" center-aligned.
- [ ] Desktop header row is still visible (empty). If this reads as noise to you, hide the header when both notices and posts are empty — a one-line conditional wrapper. (Optional polish, commit separately if applied.)

- [ ] **Step 8.2: Notices only, no regular posts**

On a board with only notice posts and no regular posts:

- [ ] Notices render correctly.
- [ ] Below them, "게시물이 없습니다" message appears.

- [ ] **Step 8.3: Secret post rendering**

On a board with a secret post authored by someone else (viewer is not that author and not admin):

- [ ] 🔒 icon shows before the title.
- [ ] Clicking the row triggers the `secretPostAlert` and does not navigate.

- [ ] **Step 8.4: Member-only list + logged out**

Switch to an incognito window, visit a `listMemberOnly` board. Expected: the existing error card renders; no layout regression.

- [ ] **Step 8.5: Gallery mode regression check**

Toggle a board's `displayType` to `gallery`. Reload.

- [ ] Gallery grid renders as before.
- [ ] Number toggle has no effect on gallery (rows don't exist in this mode).

- [ ] **Step 8.6: Cross-browser smoke**

Tailwind arbitrary `[grid-template-columns:...]` and `[grid-template-areas:...]` values are modern but well-supported. Quick sanity check in Chrome (primary target) + one other browser the team uses (Safari or Firefox). Confirm: columns align, no fallback to single-column layout on desktop.

- [ ] **Step 8.7: Accessibility quick pass**

- [ ] Tab-focus traverses each row's `<Link>` (visible focus ring).
- [ ] Each row has a meaningful link target (title text is inside the anchor).
- [ ] Contrast: amber notice background vs. foreground is readable in both light and dark modes (check dark mode by toggling site theme if available).

- [ ] **Step 8.8: Commit any polish**

If any optional polish (e.g., hiding header when fully empty, adjusting spacing) was applied, commit it:

```bash
git add src/plugins/boards/components/
git commit -m "$(cat <<'EOF'
polish(boards): list edge-case tweaks

<one-line summary of what changed, e.g. "hide header row when board
has no posts and no notices">.

---

빈 게시판·공지 전용·권한 등 엣지케이스 점검 결과를 반영한 소폭
다듬기.
EOF
)"
```

If nothing needed polish, skip this commit.

---

## Task 9: Version bump and changelog

**Files:**
- Modify: `package.json` (version field only)
- Modify: `package-lock.json` (sync)

**Goal:** Bump version. Follow the project's pattern (latest release on `main` was v0.23.2 per `git log`; next feature commit warrants v0.24.0 given the schema change).

- [ ] **Step 9.1: Bump version**

```bash
npm version minor --no-git-tag-version
```

Expected: version in `package.json` becomes `0.24.0` (or the next minor if subsequent work has bumped it). `package-lock.json` auto-updates.

- [ ] **Step 9.2: Commit version**

```bash
git add package.json package-lock.json
git commit -m "chore: v0.24.0 — board list tabular redesign + post number toggle"
```

If the maintainer's convention is to use the bilingual body format for version commits too, use:

```bash
git commit -m "$(cat <<'EOF'
chore: v0.24.0 — board list tabular redesign + post number toggle

Desktop list view becomes a traditional tabular layout (number,
title, author, date, views, likes) while mobile stays a 2-line
compact row with icon meta. Adds Board.showPostNumber toggle.
Fixes notice display by separating notices/posts in the list API.

---

데스크톱 게시판 목록을 전통 표 형식(번호·제목·글쓴이·날짜·조회·추천)
으로, 모바일은 2줄 아이콘 메타로 전환. Board.showPostNumber 토글과
공지 분리 렌더링까지 포함.
EOF
)"
```

Match the repo's existing convention for version commits — inspect the last few with `git log --oneline | grep chore:` if unsure.

- [ ] **Step 9.3: Push and open PR**

```bash
git push -u origin feat/board-list-tabular-redesign
```

Then open a PR — but **only if the user explicitly requests it**. Otherwise, stop here and let the user review locally.
