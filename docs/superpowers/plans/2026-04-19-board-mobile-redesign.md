# Board Mobile/Desktop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize board post-detail and list pages with a social-feed inspired layout, readable typography (16px body / 13px meta minimum), and responsive behavior from mobile through desktop.

**Architecture:** Pure UI refactor of two client components. No API, DB, or permission-logic changes. Work is decomposed into small, independently-committable JSX/Tailwind edits. After each section change, verify visually in the dev server at 375px (mobile) and ≥768px (desktop) before committing.

**Tech Stack:** Next.js 15 (App Router, Turbopack), TypeScript, Tailwind CSS, shadcn/ui primitives (Button, Badge, Card, Popover, Input), `lucide-react` icons, `next-intl` i18n.

**Spec:** [docs/superpowers/specs/2026-04-19-board-mobile-redesign-design.md](../specs/2026-04-19-board-mobile-redesign-design.md)

**Feedback memory to respect:**
- Mobile fonts: body ≥16px, meta ≥13px, no 10–11px.
- Core-unchanged rule: do not modify files outside `src/plugins/boards/`.

---

## File Structure

**Modified files (only):**

| File | Responsibility |
|---|---|
| `src/plugins/boards/components/BoardPostPage.tsx` | Detail page — post header, body, reactions, edit/delete, comments, compose |
| `src/plugins/boards/components/BoardListPage.tsx` | List page — board header, notices, post rows, pagination |

**No new files, no component extraction in this plan.** If either file grows past readability during work, note as follow-up — do not extract mid-plan.

---

## Visual Verification Convention

This is a UI-only refactor. Steps that modify JSX/Tailwind end with a visual check instead of a unit test:

1. Dev server is running (`npm run dev`).
2. Open Chrome DevTools at target URL (default `/boards/free/1` for detail, `/boards/free` for list — slug may differ locally; use any existing board).
3. Toggle device toolbar to **iPhone SE (375×667)** for mobile checks.
4. Toggle back to desktop (≥1024px) for responsive checks where specified.
5. Confirm the acceptance criterion in the step, then commit.

---

## Task 0: Setup

**Files:** none

- [ ] **Step 0.1: Create feature branch**

```bash
cd /home/kagla/nexibase
git checkout main
git pull --ff-only
git checkout -b feat/board-mobile-redesign
```

Expected: `Switched to a new branch 'feat/board-mobile-redesign'`.

- [ ] **Step 0.2: Start the dev server in the background**

```bash
npm run dev
```

Run in background. Server listens on `http://localhost:3000` (or the next free port). Keep running through the whole plan.

- [ ] **Step 0.3: Smoke test current board**

Open `http://localhost:3000/boards/free` (or any configured board slug). Confirm it loads with at least one post. Click a post — confirm detail page loads. If it doesn't, pause and fix environment before proceeding.

Do **not** commit.

---

## Task 1: BoardPostPage — Outer Container & Top Bar

**Files:**
- Modify: `src/plugins/boards/components/BoardPostPage.tsx:616-660`

**Goal:** Keep the top bar (back + prev/next/list) but allow the post content underneath to shed the `<Card>` wrapper in later tasks. This task only adjusts the outer container width/padding to match the new spec (mobile full-bleed, desktop `max-w-3xl`).

- [ ] **Step 1.1: Widen outer container classes**

In `BoardPostPage.tsx`, locate the outer wrapper (around line 618):

```tsx
<div className="max-w-4xl mx-auto sm:px-4 py-2 sm:py-6">
```

Replace with:

```tsx
<div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-6">
```

- [ ] **Step 1.2: Visual check**

Reload `/boards/<slug>/<postId>` at 375px and at desktop width. The content should have `px-4` on mobile (previously had no horizontal padding at `sm:` breakpoint below). No visual regression of the top bar.

- [ ] **Step 1.3: Commit**

```bash
git add src/plugins/boards/components/BoardPostPage.tsx
git commit -m "$(cat <<'EOF'
refactor(boards): adjust post detail outer container for redesign

Drop sm: gating on horizontal padding so mobile gets px-4 instead of a
flush-left card. Narrow desktop max width to 3xl per the redesign spec.

---

모바일에서 본문 좌우 여백을 확보하기 위해 sm: 조건을 제거하고
데스크탑 최대 너비를 3xl 로 좁힘.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: BoardPostPage — Post Header (Avatar + Name + Meta + Title)

**Files:**
- Modify: `src/plugins/boards/components/BoardPostPage.tsx:663-708`

**Goal:** Replace the title-first + separate author row layout with author-first layout, merging view/like/comment counts into a single meta line under the author name. Remove the outer `<Card>` wrapper around the post.

- [ ] **Step 2.1: Locate the existing post card block**

The block spans roughly lines 663–911. It starts with:

```tsx
{/* Post */}
<Card className="mb-4 sm:mb-6 rounded-none sm:rounded-lg">
  <CardContent className="p-3 sm:p-6">
```

and ends with `</CardContent></Card>` before the comments card.

- [ ] **Step 2.2: Remove outer Card, replace title/author block**

Replace the opening `<Card>` + `<CardContent>` with a plain `<section>`. Replace lines 665–708 (the title + author info block) with the new header. Full replacement of the opening:

```tsx
{/* Post */}
<section className="mb-6 sm:mb-8">
  {/* Title badges */}
  <div className="flex items-center gap-2 mb-3">
    {post.isNotice && (
      <Badge variant="destructive">
        <Pin className="h-3 w-3 mr-1" />
        {t('noticeBadge')}
      </Badge>
    )}
    {post.isSecret && (
      <Badge variant="secondary">
        <Lock className="h-3 w-3 mr-1" />
        {t('post.secret')}
      </Badge>
    )}
  </div>

  {/* Author header */}
  <div className="flex items-center gap-3 mb-3">
    <UserNickname
      userId={post.author.id}
      uuid={post.author.uuid}
      nickname={post.author.nickname}
      image={post.author.image}
      showAvatar
      avatarSize="md"
      avatarOnly
    />
    <div className="min-w-0 flex-1">
      <UserNickname
        userId={post.author.id}
        uuid={post.author.uuid}
        nickname={post.author.nickname}
        image={post.author.image}
        className="font-semibold text-[15px]"
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground mt-0.5">
        <span>{formatDate(post.createdAt)}</span>
        <span className="opacity-50">·</span>
        <span className="inline-flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          {post.viewCount}
        </span>
        {board.useReaction && totalReactions > 0 && (
          <>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" />
              {totalReactions}
            </span>
          </>
        )}
        {board.useComment && post.commentCount > 0 && (
          <>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {post.commentCount}
            </span>
          </>
        )}
      </div>
    </div>
  </div>

  {/* Title */}
  <h1 className="text-[22px] sm:text-[28px] font-bold leading-tight mb-4">{post.title}</h1>
```

After this block, the existing body rendering (`<div ref={contentRef} …>`) stays as-is.

- [ ] **Step 2.3: Verify `UserNickname` supports `avatarOnly` prop**

```bash
grep -n "avatarOnly" /home/kagla/nexibase/src/components/UserNickname.tsx
```

If it returns matches, skip to Step 2.5. If not, do Step 2.4 to render the avatar directly instead.

- [ ] **Step 2.4: Fallback — render avatar directly (only if `avatarOnly` not supported)**

Replace the first `<UserNickname … avatarOnly />` with:

```tsx
<div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-[14px] font-semibold shrink-0 overflow-hidden">
  {post.author.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={post.author.image} alt="" className="w-full h-full object-cover" />
  ) : (
    (post.author.nickname || post.author.name || '?').charAt(0).toUpperCase()
  )}
</div>
```

Remove the `avatarOnly` attribute.

- [ ] **Step 2.5: Close the section at the end of the old card**

Find where the old `</CardContent></Card>` (for the post) lives — right before `{/* Comments */}`. Replace `</CardContent></Card>` with `</section>`.

- [ ] **Step 2.6: Remove the hairline border-y block around the original author row**

Confirm lines 685–708 (the `<div className="flex items-center justify-between py-3 border-y mb-6">` block) are gone — they should have been removed in Step 2.2.

- [ ] **Step 2.7: Visual check — mobile**

At 375px, confirm: badges row → avatar + name / date·views·likes·comments line → title (22px, bold) → body. No Card border visible on the post.

- [ ] **Step 2.8: Visual check — desktop**

At ≥1024px, confirm the title is 28px, layout centered within 3xl max-width, everything remains readable.

- [ ] **Step 2.9: Commit**

```bash
git add src/plugins/boards/components/BoardPostPage.tsx
git commit -m "$(cat <<'EOF'
refactor(boards): move author above title, merge meta into one line

Author + date + views/likes/comments now sit on a single line above the
title; the surrounding Card is gone so the post reads as a feed item.
Title scales 22→28px across sm:.

---

작성자와 조회/추천/댓글 메타를 한 줄로 합쳐 제목 위로 배치하고
외곽 카드를 제거. 제목은 모바일 22px, 데스크탑 28px.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: BoardPostPage — Reaction Chips (pill style, responsive labels)

**Files:**
- Modify: `src/plugins/boards/components/BoardPostPage.tsx:853-886`

**Goal:** Replace the `<Button variant="default|outline">` reactions with thin pill chips. Mobile shows emoji + count (when active). Desktop shows emoji + label + count.

- [ ] **Step 3.1: Update REACTIONS color config**

Locate the `REACTIONS` constant (around lines 47–53). Replace with:

```tsx
const REACTIONS = [
  { type: 'like',   emoji: '👍', activeClass: 'bg-blue-500/10   border-blue-500   text-blue-400'   },
  { type: 'haha',   emoji: '😂', activeClass: 'bg-amber-500/10  border-amber-500  text-amber-400'  },
  { type: 'agree',  emoji: '👌', activeClass: 'bg-emerald-500/10 border-emerald-500 text-emerald-400' },
  { type: 'thanks', emoji: '🙏', activeClass: 'bg-pink-500/10   border-pink-500   text-pink-400'   },
  { type: 'wow',    emoji: '😮', activeClass: 'bg-purple-500/10 border-purple-500 text-purple-400' },
] as const
```

- [ ] **Step 3.2: Replace the reaction row JSX**

Locate the block starting with `{board.useReaction && (` around line 853. Replace the entire block (ends at the matching `)}`) with:

```tsx
{board.useReaction && (
  <div className="flex flex-wrap items-center gap-1.5 pt-4 border-t">
    {REACTIONS.map(({ type, emoji, activeClass }) => {
      const count = reactions[type] || 0
      const isActive = userReactions.includes(type)

      return (
        <button
          key={type}
          type="button"
          onClick={() => handleReaction(type)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] transition-colors",
            isActive
              ? activeClass
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="text-[15px] leading-none">{emoji}</span>
          <span className="hidden sm:inline">{t(`reactions.${type}`)}</span>
          {count > 0 && (
            <span className="font-semibold text-[12px] min-w-[1ch] text-center">{count}</span>
          )}
        </button>
      )
    })}
  </div>
)}
```

- [ ] **Step 3.3: Remove now-unused `EmojiIcon` helper**

Locate the `EmojiIcon` component (around lines 42–44). Delete it — it's no longer referenced.

```tsx
// DELETE these lines:
const EmojiIcon = ({ emoji, className }: { emoji: string; className?: string }) => (
  <span className={cn("text-base leading-none", className)}>{emoji}</span>
)
```

- [ ] **Step 3.4: Visual check — mobile**

At 375px, chips show only emoji (+ count if active). Active `like` is blue-tinted, active `haha` is amber. Inactive chips have only the border.

- [ ] **Step 3.5: Visual check — desktop**

At ≥1024px, chips additionally show the reaction label text (`Like`, `Haha`, `Agree`, `Thanks`, `Wow`).

- [ ] **Step 3.6: Functional check**

Click an inactive chip: it toggles active (color fills, count appears). Click it again: it toggles off. Works for each of the 5 types.

- [ ] **Step 3.7: Commit**

```bash
git add src/plugins/boards/components/BoardPostPage.tsx
git commit -m "$(cat <<'EOF'
refactor(boards): reaction chips as pill buttons, responsive labels

Drop the shadcn Button wrapping and render reactions as thin pill
chips. Mobile shows emoji + count; sm: adds the localized label. Each
reaction type keeps its own tinted active color.

---

리액션을 얇은 pill chip 으로 전환. 모바일은 이모지+카운트,
sm: 이상은 라벨까지 표시. 활성 상태 색상은 타입별 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: BoardPostPage — Edit/Delete Ghost Buttons

**Files:**
- Modify: `src/plugins/boards/components/BoardPostPage.tsx:889-909`

**Goal:** De-emphasize edit/delete as muted ghost buttons sitting directly under the reaction row. Remove their separate `border-t` divider.

- [ ] **Step 4.1: Replace the edit/delete block**

Locate `{canEdit && (` around line 889. Replace the entire block with:

```tsx
{canEdit && (
  <div className="flex justify-end gap-2 pt-3">
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.push(`/boards/${slug}/${postId}/edit`)}
      className="text-muted-foreground hover:text-foreground"
    >
      <Pencil className="h-3.5 w-3.5 mr-1" />
      {t('edit')}
    </Button>
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-3.5 w-3.5 mr-1" />
      {t('delete')}
    </Button>
  </div>
)}
```

- [ ] **Step 4.2: Visual check**

As author or admin, Edit / Delete appear under reactions, muted until hover. No divider line above.

- [ ] **Step 4.3: Commit**

```bash
git add src/plugins/boards/components/BoardPostPage.tsx
git commit -m "$(cat <<'EOF'
refactor(boards): edit/delete as muted ghost buttons

De-emphasize the owner actions so they sit quietly beneath the
reactions instead of commanding a bordered block of their own.

---

편집/삭제 버튼을 muted ghost 스타일로 변경해 리액션 아래에서
조용히 보이도록.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: BoardPostPage — Comments Wrapper & Connector Lines

**Files:**
- Modify: `src/plugins/boards/components/BoardPostPage.tsx:913-1163`

**Goal:** Drop the outer `<Card>` around the comments section (replace with `<section>`), add a CSS-pseudo connector line to reply comments.

- [ ] **Step 5.1: Replace the comments card wrapper**

Find `{board.useComment && (` around line 913. The section opens with `<Card className="rounded-none sm:rounded-lg"><CardContent className="p-3 sm:p-6">`. Replace those two lines with a single:

```tsx
<section className="pt-6 sm:pt-8 border-t">
```

Find the matching closing tags (`</CardContent></Card>`) and replace with:

```tsx
</section>
```

- [ ] **Step 5.2: Add connector style to reply comments**

There is one reply rendering block — inside `replyMap.get(comment.id)?.map((reply) => ...)` around line 1053. Its current className is:

```tsx
className="border-b py-3 pl-11 scroll-mt-20"
```

Replace with:

```tsx
className="border-b py-3 pl-11 scroll-mt-20 relative before:content-[''] before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-[2px] before:bg-border"
```

Search the file for any other occurrence of `pl-11 scroll-mt-20` — if another exists in a reply context, apply the same replacement. If none, move on.

- [ ] **Step 5.3: Increase comment body typography**

Find the two `className="text-sm prose prose-sm dark:prose-invert max-w-none"` (around lines 1019 and 1100). Replace each with:

```tsx
className="text-[15px] prose prose-sm dark:prose-invert max-w-none"
```

Also update the reply `<div className="text-sm">` (around line 1096) to:

```tsx
<div className="text-[15px]">
```

And the `<span className="text-xs text-muted-foreground">` for comment dates (lines 980, 1059) to:

```tsx
<span className="text-[12px] text-muted-foreground">
```

- [ ] **Step 5.4: Visual check**

Confirm: comments section has no Card background; reply comments show a vertical `2px` connector line on the left; comment body reads at 15px (noticeably larger than before).

- [ ] **Step 5.5: Functional check**

Post a comment, edit it, delete it. Post a reply. All existing flows still work — no logic was changed, only class names.

- [ ] **Step 5.6: Commit**

```bash
git add src/plugins/boards/components/BoardPostPage.tsx
git commit -m "$(cat <<'EOF'
refactor(boards): strip comment card, add reply connector lines

Replace the comments Card with a section under a hairline, bump
comment body to 15px for readability, and draw a 2px connector on
threaded replies so nesting is visually obvious without relying on
indentation alone.

---

댓글 영역 카드를 hairline 구분선 섹션으로 전환, 댓글 본문을
15px 로 키워 가독성 확보. 대댓글엔 2px connector 라인을 추가해
들여쓰기만으로 구조가 보이지 않던 문제 해소.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: BoardPostPage — Compose Pill Wrapper

**Files:**
- Modify: `src/plugins/boards/components/BoardPostPage.tsx:1143-1160`

**Goal:** Wrap the new-comment `MiniEditor` and submit button in a muted pill container for visual unity with the rest of the feed.

- [ ] **Step 6.1: Replace the new-comment compose block**

Locate the block starting with `{canComment && !replyTo ? (` around line 1144. Replace the first branch (the `<div>` with `MiniEditor`) with:

```tsx
{canComment && !replyTo ? (
  <div className="mt-6 rounded-2xl bg-muted/40 border border-border p-3">
    <MiniEditor content={commentText} onChange={setCommentText} placeholder={t('comment.placeholder')} />
    <div className="flex justify-end mt-2">
      <Button
        size="sm"
        onClick={(e) => { setReplyTo(null); handleCommentSubmit(e) }}
        disabled={submittingComment || !commentText || commentText === '<p></p>'}
      >
        {submittingComment ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
        {t('comment.write')}
      </Button>
    </div>
  </div>
) : board.commentMemberOnly && !isLoggedIn ? (
```

Keep the rest of the conditional (`board.commentMemberOnly && !isLoggedIn` branch) as-is.

- [ ] **Step 6.2: Visual check**

The compose input sits at the bottom of the comments section as a soft rounded pill block with a subtle border, visually unified with the rest.

- [ ] **Step 6.3: Commit**

```bash
git add src/plugins/boards/components/BoardPostPage.tsx
git commit -m "$(cat <<'EOF'
refactor(boards): wrap new-comment compose in a pill container

Give the bottom compose area a soft rounded muted background so it
reads as a distinct input region without shouting.

---

새 댓글 입력 영역을 둥근 pill 컨테이너로 감싸 입력 구간임을
부드럽게 구분.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: BoardPostPage — Full-Page Verification

**Files:** none (verification only)

- [ ] **Step 7.1: Mobile smoke test (375px)**

Navigate to a post with: reactions, comments, replies, attachments (if the board has them). Confirm visually:

- Top bar: back + board name + ‹ › ☰ (icons only, no labels)
- Post: badges (if present) → avatar + name + date·views·likes·comments → title → body
- Reactions: pill chips, emoji + count only
- Edit/Delete: ghost buttons (if owner/admin)
- Comments: flowing section, replies indented with connector line
- Compose: pill container at bottom
- Body text readable at 16px, meta at 13px (zoom/measure in DevTools if unsure)

- [ ] **Step 7.2: Desktop smoke test (≥1024px)**

Same page at desktop width. Confirm:

- Max-width 3xl centered
- Title 28px
- Reactions include labels (Like, Haha, etc.)
- ‹ › ☰ buttons show their labels

- [ ] **Step 7.3: Regression smoke**

- Toggle a reaction: persists after refresh.
- Post a new comment: appears.
- Post a reply: appears indented with connector.
- Edit a comment: edit UI renders inside the comment row.
- Delete a comment: removes it.
- Click prev / next: navigates (if adjacent posts exist).
- Click ☰ list: returns to list.

- [ ] **Step 7.4: Lint and typecheck**

```bash
npm run lint
```

Expected: no errors in changed files. If warnings exist that pre-existed, leave them.

```bash
npx tsc --noEmit
```

Expected: no type errors in `BoardPostPage.tsx`.

- [ ] **Step 7.5: No commit needed (verification only)**

If regressions found, fix in place and stage/commit the fix with a `fix(boards): ...` prefix.

---

## Task 8: BoardListPage — Outer Container & Board Header

**Files:**
- Modify: `src/plugins/boards/components/BoardListPage.tsx:216-240`

**Goal:** Match the detail page's outer container width and padding.

- [ ] **Step 8.1: Update outer container classes**

Locate the outer wrapper around line 216:

```tsx
<div className="max-w-4xl mx-auto sm:px-4 py-2 sm:py-6">
```

Replace with:

```tsx
<div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-6">
```

- [ ] **Step 8.2: Visual check**

Board list has left/right padding on mobile, centered within 3xl on desktop.

- [ ] **Step 8.3: Commit**

```bash
git add src/plugins/boards/components/BoardListPage.tsx
git commit -m "$(cat <<'EOF'
refactor(boards): align list outer container with detail redesign

Same px-4 / max-w-3xl treatment so both board screens share spacing.

---

목록 페이지 외곽 컨테이너를 상세와 동일한 px-4 / max-w-3xl 로 통일.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: BoardListPage — Strip Post Card & Notices Block

**Files:**
- Modify: `src/plugins/boards/components/BoardListPage.tsx:242-266`

**Goal:** Remove the `<Card>` wrapper around the entire list. Rebuild the notices block with a 2-line layout (badge+title / meta) and the same meta line as normal rows.

- [ ] **Step 9.1: Replace Card wrapper opening**

Locate around line 242:

```tsx
<Card>
  <CardContent className="p-0">
```

Replace with:

```tsx
<div className="divide-y divide-border">
```

Find the matching `</CardContent></Card>` (around line 418–419) and replace with a single `</div>`.

- [ ] **Step 9.2: Replace the notices block**

Locate `{notices.length > 0 && (` around line 245. Replace the whole block (down to the closing `)}`) with:

```tsx
{notices.length > 0 && (
  <div className="space-y-2 py-3">
    {notices.map((post) => {
      const postUrl = post.isSecret && post.author.id !== user?.id && !isAdmin ? '#' : `/boards/${slug}/${post.id}`
      return (
        <Link
          key={post.id}
          href={postUrl}
          className="block rounded-lg bg-red-500/5 hover:bg-red-500/10 transition-colors px-3 py-2.5"
          onClick={(e) => {
            if (post.isSecret && post.author.id !== user?.id && !isAdmin) {
              e.preventDefault()
              alert(t('secretPostAlert'))
            }
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="destructive" className="shrink-0 text-[11px] px-1.5 py-0">
              <Pin className="h-3 w-3 mr-1" />
              {t('noticeBadge')}
            </Badge>
            <span className="font-semibold text-[14px] truncate flex-1">{post.title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
            <span>{post.author.nickname}</span>
            <span className="opacity-50">·</span>
            <span>{formatDate(post.createdAt)}</span>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount}</span>
            {board.useReaction && post.likeCount > 0 && (
              <>
                <span className="opacity-50">·</span>
                <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{post.likeCount}</span>
              </>
            )}
            {board.useComment && post.commentCount > 0 && (
              <>
                <span className="opacity-50">·</span>
                <span className="inline-flex items-center gap-1">💬 {post.commentCount}</span>
              </>
            )}
          </div>
        </Link>
      )
    })}
  </div>
)}
```

- [ ] **Step 9.3: Visual check**

Notices appear as a small stack of red-tinted rounded blocks, each with: badge + title / `admin · date · 👁 · 👍 · 💬` (zero counts hidden). No outer Card around the full list area.

- [ ] **Step 9.4: Commit**

```bash
git add src/plugins/boards/components/BoardListPage.tsx
git commit -m "$(cat <<'EOF'
refactor(boards): drop list Card and rebuild notices with full meta

Replace the Card wrapping the whole list with a hairline-divided
stack, and give notices the same author/date/views/likes/comments
meta line as regular rows (zero counts hidden) so engagement is
visible at a glance.

---

목록 전체를 감싸던 카드를 hairline 구분 stack 으로 교체하고,
공지 블록도 일반 글과 동일한 메타 라인(작성자·날짜·조회·추천·
댓글, 0인 값은 숨김)을 표시하도록 재구성.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: BoardListPage — Normal Post Rows (unified 2-line meta)

**Files:**
- Modify: `src/plugins/boards/components/BoardListPage.tsx:331-391`

**Goal:** Collapse the current separate mobile-stacked / desktop-table layouts into a single responsive layout: title (14px bold) + meta line (13px) for both widths. The existing `displayType === 'gallery'` path stays untouched.

- [ ] **Step 10.1: Replace the list-view branch**

Locate the conditional around line 331:

```tsx
) : board.displayType === 'gallery' ? (
  /* Gallery view */
  …existing gallery code stays…
) : (
  /* List view */
  <div>
    {/* Desktop header */} … existing header …
    {posts.map(...)} … existing mobile/desktop markup …
  </div>
)}
```

Replace **only** the `List view` branch (keep the gallery branch untouched) with:

```tsx
) : (
  /* List view — unified responsive 2-line rows */
  <div>
    {posts.map((post) => {
      const postUrl = post.isSecret && post.author.id !== user?.id && !isAdmin ? '#' : `/boards/${slug}/${post.id}`
      return (
        <Link
          key={post.id}
          href={postUrl}
          className="block py-3 px-1 hover:bg-muted/40 transition-colors"
          onClick={(e) => {
            if (post.isSecret && post.author.id !== user?.id && !isAdmin) {
              e.preventDefault()
              alert(t('secretPostAlert'))
            }
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            {post.isSecret && <Lock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
            <span className="font-semibold text-[14px] sm:text-[15px] truncate flex-1">{post.title}</span>
            {post.commentCount > 0 && board.useComment && (
              <span className="text-primary text-[13px] shrink-0">[{post.commentCount}]</span>
            )}
            {post._count && post._count.attachments > 0 && (
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
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
            {board.useReaction && post.likeCount > 0 && (
              <>
                <span className="opacity-50">·</span>
                <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{post.likeCount}</span>
              </>
            )}
          </div>
        </Link>
      )
    })}
  </div>
)}
```

Note: the `handlePostClick` helper is no longer used in the list view (we use `<Link>` with `onClick` for the secret-guard). Do not delete `handlePostClick` — it's still used by the gallery view branch.

- [ ] **Step 10.2: Visual check — mobile**

Each post row shows: title line (14px, bold, with comment count badge and paperclip if applicable) / meta line (13px, `nickname · date · 👁 · 👍`).

- [ ] **Step 10.3: Visual check — desktop**

Same 2-line layout at desktop (title bumps to 15px). No table header. Hover tint visible.

- [ ] **Step 10.4: Functional check**

Click a post → detail page opens. Click a secret post you can't see → alert. Gallery boards still render gallery view (check a board with `displayType === 'gallery'`).

- [ ] **Step 10.5: Commit**

```bash
git add src/plugins/boards/components/BoardListPage.tsx
git commit -m "$(cat <<'EOF'
refactor(boards): unify list rows into responsive 2-line layout

Collapse the split mobile-stacked / desktop-table markup into a
single 2-line row (title / meta) that scales across breakpoints.
Gallery view is untouched.

---

모바일 2줄 / 데스크탑 테이블로 갈라져 있던 목록 행을 반응형
2줄 레이아웃(제목 / 메타)으로 통일. 갤러리 뷰는 미변경.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: BoardListPage — "더 보기" Pagination

**Files:**
- Modify: `src/plugins/boards/components/BoardListPage.tsx:78-136` (state + fetch)
- Modify: `src/plugins/boards/components/BoardListPage.tsx:394-417` (pagination UI)

**Goal:** Replace page-number pagination with a single "더 보기" button that appends the next page's posts.

- [ ] **Step 11.1: Introduce a loadingMore state and switch fetch to append mode on pages > 1**

Find the state declarations (around line 77–84):

```tsx
const [posts, setPosts] = useState<Post[]>([])
const [notices, setNotices] = useState<Post[]>([])
const [user, setUser] = useState<User | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [page, setPage] = useState(1)
const [totalPages, setTotalPages] = useState(1)
```

Add a new state below `totalPages`:

```tsx
const [loadingMore, setLoadingMore] = useState(false)
```

Replace the `fetchPosts` function (currently around lines 101–136) with:

```tsx
const fetchPosts = useCallback(async (targetPage: number, append: boolean) => {
  if (append) {
    setLoadingMore(true)
  } else {
    setLoading(true)
  }
  setError(null)
  try {
    const params = new URLSearchParams({ page: targetPage.toString() })
    const response = await fetch(`/api/boards/${slug}/posts?${params}`)
    const data = await response.json()

    if (!response.ok) {
      if (response.status === 403) {
        setError(data.requireLogin ? t('listRequiresLogin') : (data.error || t('noPermission')))
      } else if (response.status === 404) {
        setError(t('boardNotFound'))
      } else {
        setError(data.error || t('loadUnavailable'))
      }
      return
    }

    if (data.success) {
      setBoard(data.board)
      setPosts(prev => append ? [...prev, ...data.posts] : data.posts)
      if (!append) setNotices(data.notices || [])
      setTotalPages(data.pagination.totalPages)
    }
  } catch (error) {
    console.error('failed to fetch posts:', error)
    setError(t('loadError'))
  } finally {
    setLoading(false)
    setLoadingMore(false)
  }
}, [slug, t])
```

- [ ] **Step 11.2: Update the initial fetch effect**

Find the effect around line 142:

```tsx
useEffect(() => {
  fetchPosts()
}, [fetchPosts])
```

Replace with:

```tsx
useEffect(() => {
  setPage(1)
  fetchPosts(1, false)
}, [fetchPosts])
```

- [ ] **Step 11.3: Replace the pagination UI**

Find the pagination block around line 394:

```tsx
{/* Pagination */}
{totalPages > 1 && (
  <div className="flex justify-center items-center gap-2 py-4 border-t">
    …prev / page indicator / next…
  </div>
)}
```

Replace with:

```tsx
{/* Load more */}
{page < totalPages && (
  <div className="flex justify-center py-4">
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const next = page + 1
        setPage(next)
        fetchPosts(next, true)
      }}
      disabled={loadingMore}
    >
      {loadingMore ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          {t('loading')}
        </>
      ) : (
        t('loadMore')
      )}
    </Button>
  </div>
)}
```

- [ ] **Step 11.4: Ensure i18n keys exist**

Check `src/messages/<locale>.json` for `boards.loading` and `boards.loadMore`:

```bash
grep -rn "loadMore\|loading" /home/kagla/nexibase/src/messages/ | grep -i boards
```

If `loadMore` is missing, add it to every locale file under the `boards` namespace:

- `en.json`: `"loadMore": "Load more"`, `"loading": "Loading..."`
- `ko.json`: `"loadMore": "더 보기"`, `"loading": "로딩 중..."`

Keep any existing `loading` key if present.

- [ ] **Step 11.5: Visual check**

The list renders page 1. A "더 보기" / "Load more" button sits below the last row. Clicking it appends the next page's posts and the button disappears when the last page is reached.

- [ ] **Step 11.6: Functional check — rapid clicks**

Click "더 보기" quickly twice. Confirm the button is disabled during the fetch (`loadingMore`) and there are no duplicate rows.

- [ ] **Step 11.7: Commit**

```bash
git add src/plugins/boards/components/BoardListPage.tsx src/messages/
git commit -m "$(cat <<'EOF'
feat(boards): replace page-number pagination with load more

Replace prev/next pagination with a single append-on-click "더 보기"
button. fetchPosts now takes (page, append) and either resets or
concatenates posts.

---

페이지 번호 pagination 을 "더 보기" 버튼으로 교체. fetchPosts 가
(page, append) 를 받아 초기화 또는 누적 로딩을 분기.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: BoardListPage — Final Verification

**Files:** none (verification only)

- [ ] **Step 12.1: Mobile smoke test (375px)**

Navigate to the board list. Confirm:

- Header: board name (bold), description beneath, write button on the right (if `canWrite`)
- Notices (if any): red-tinted rounded blocks with 2-line meta
- Normal posts: 2-line rows, title 14px bold, meta 13px
- "더 보기" button at bottom if more pages

- [ ] **Step 12.2: Desktop smoke test (≥1024px)**

Same layout centered within 3xl. Title scales to 15px. Hover tint on rows.

- [ ] **Step 12.3: Gallery view unaffected**

Visit a board with `displayType === 'gallery'` — confirm thumbnails grid still renders as before.

- [ ] **Step 12.4: Lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 12.5: Final full regression**

From the list, click through to detail, back, post a comment, toggle reactions, hit "더 보기", click a notice — nothing should throw.

- [ ] **Step 12.6: Final commit if fixes were needed**

If Steps 12.1–12.5 found issues, fix them, commit with `fix(boards): …`. Otherwise no commit.

---

## Task 13: Push and Summarize

**Files:** none

- [ ] **Step 13.1: Push the branch**

```bash
git push -u origin feat/board-mobile-redesign
```

- [ ] **Step 13.2: Summary message for the user**

Report back in the terminal:
- List of commits added (run `git log main..HEAD --oneline`).
- Branch pushed: `feat/board-mobile-redesign`.
- Remaining follow-ups noted in the spec's "열린 이슈" section (gallery redesign, edit page, comment reactions styling, attachments UI) — not in scope.

Do **not** open a PR unless the user asks.

---

## Acceptance Summary

The branch is ready when:

1. All 13 tasks are committed on `feat/board-mobile-redesign`.
2. `npm run lint` and `npx tsc --noEmit` pass clean on the changed files.
3. Detail page at 375px matches the redesign (author-first header, pill reactions, ghost edit/delete, connector replies, pill compose).
4. List page at 375px matches the redesign (2-line rows, red-tinted notices with full meta, "더 보기" pagination).
5. Both pages remain functional: reactions toggle, comments CRUD works, navigation works, secrets/permissions honored.
6. Write page (`BoardWritePage.tsx`) is unchanged.
