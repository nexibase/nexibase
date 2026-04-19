# Lean DM (Phase 2) — Design

- **Date:** 2026-04-19
- **Status:** Approved (brainstorming → writing-plans)
- **Builds on:** `2026-04-17-notifications-completion-design.md` (Phase 1 notifications)
- **Replaces:** Phase 1's `admin_message` notification type and `SendNotificationDialog` send path

## 1. Goals and Scope

### 1.1 Goal

Layer a **1:1 threaded direct messaging (DM)** feature on top of the Phase 1 notification system. Members can exchange persistent threaded messages with one another and with administrators. The Phase 1 single-shot `admin_message` notification path is replaced by DM — there is one send mechanism, and that mechanism supports replies.

### 1.2 In scope (Phase 2)

- `Conversation` + `Message` schema (1:1 only; unique pair enforced at DB level).
- Core library at `src/lib/messaging.ts` exposing `findOrCreateConversation`, `sendMessage`, `markConversationRead`, `hideConversation`, `unhideConversation`, `canSendMessage`.
- REST-ish API under `/api/messages/*`.
- UI pages: `/mypage/messages` (conversation list) and `/mypage/messages/[id]` (thread view).
- "쪽지 보내기" button added to `UserProfileModal` and `/profile/[uuid]`.
- Polling: header notification count at 60s (reuse existing), thread view at 5s for new messages.
- Notification integration: every incoming message creates a `direct_message` notification row (no dedup — one per message, the header cap `99+` handles overflow). Opening a thread marks its notifications read.
- Email integration: `NotificationPreference.emailDirectMessage` (default OFF); admin UI can override per-send via a checkbox.
- Conversation hide/unhide per user with a "hidden conversations" tab; auto-reappear on new message or when the user sends one again.
- Admin send flow: `/admin/users` row action + shop order admin detail button both open the refactored `SendMessageDialog` which posts to `/api/messages/send`.
- Full removal of `admin_message` type and its associated helpers, preference field, email function, and API route.

### 1.3 Out of scope (explicitly deferred)

- Group DMs / multi-party conversations.
- File / image attachments.
- Message-level edit / delete (conversation-level hide only).
- Typing indicators.
- Per-message read receipts (e.g. the "1" style in Korean portals).
- Full-text message search.
- Admin moderation / ability to view other users' conversations.
- Abuse reporting flow.
- Real-time push (SSE / WebSocket).
- Per-user "block" for mutual blocking. Admin-side control uses the existing `User.status` (`banned` / `inactive`), no new field.
- Message-arrival toast / sound.
- Separate header envelope icon — the existing Bell dropdown covers DM via the notification row.

### 1.4 Design principles

- Plugins do not own DM — DM lives in core.
- Reuse Phase 1 notification / email plumbing; do not create parallel systems.
- Polling-only, hosting-agnostic.
- DB enforces invariants the code relies on (`user1Id < user2Id` + `@@unique`).
- Privacy by default: only conversation participants can read a thread; not even admins.

## 2. Architecture

### 2.1 Responsibility split

| Layer | Responsibility |
|---|---|
| Core DB | `Conversation`, `Message` tables. `NotificationPreference.emailDirectMessage` field. |
| Core lib (`src/lib/messaging.ts` — new) | find-or-create, send, read, hide, permission helpers. Emits the notification row as part of send. |
| Core API (`src/app/api/messages/*`) | List conversations, fetch thread, send, read, hide. |
| UI | `/mypage/messages` list, `/mypage/messages/[id]` thread, refactored `SendMessageDialog`, profile "쪽지 보내기" buttons. |
| Notification bridge | `messaging.sendMessage` calls into Phase 1's notification + email helpers. Reading a thread marks related unread notifications read. |

### 2.2 Core API surface (for other code paths)

```ts
// src/lib/messaging.ts
findOrCreateConversation(userA: number, userB: number): Promise<Conversation>
sendMessage({ conversationId, senderId, content }): Promise<Message>
sendMessageTo({ fromUserId, toUserId, content, sendEmail? }): Promise<{ conversation, message }>
markConversationRead(conversationId: number, viewerId: number): Promise<void>
hideConversation(conversationId: number, viewerId: number): Promise<void>
unhideConversation(conversationId: number, viewerId: number): Promise<void>
canSendMessage(userId: number): Promise<boolean>   // User.status === 'active'
```

### 2.3 Delivery model

- **Generation:** synchronous DB insert at send time.
- **Notification row:** created inline with each message (type `direct_message`). No dedup — one notification per incoming message.
- **Email:** fire-and-forget, governed by `emailDirectMessage` preference unless the admin explicitly set `sendEmail: true` as an override.
- **Client refresh:**
  - Header dropdown: keeps its existing 60-second poll on `/api/notifications/count`. DM count folds into the total.
  - `/mypage/messages`: fetches once on mount. No background polling; user returns to the page or opens a thread to see new state.
  - `/mypage/messages/[id]`: 5-second poll on `GET /api/messages/[id]?after=<lastMsgId>`; auto-calls `PUT /read` on each new batch arrival.

### 2.4 Flow diagrams

**Member → member (from profile modal):**
```
User A on @B's profile → clicks "쪽지 보내기"
  → SendMessageDialog (content only)
  → POST /api/messages/send { toUserId: B, content }
  → server: canSendMessage(A) check → findOrCreateConversation(A, B)
           → create Message → clear B's hiddenAt → createNotification
           → (sender-admin-with-sendEmail OR shouldEmail(B)) → sendDirectMessageEmail
  → response { conversationId, messageId }
  → client: redirect to /mypage/messages/[conversationId]
```

**Admin → customer (from /admin/users row or order detail):**
```
Admin clicks Send icon
  → SendMessageDialog (content + "이메일도 발송" checkbox)
  → POST /api/messages/send { toUserId, content, sendEmail }
  → server: same path; sendEmail=true forces email even if user.emailDirectMessage is false
  → response
  → client: alert "발송 완료" and close dialog (no redirect; admin can keep sending)
```

**Recipient receives:**
```
Recipient's open browser:
  Header: 60s poll → /api/notifications/count (direct_message rows counted in)
  Bell dropdown: dot + new row "💬 A님의 쪽지"
  Click notification → navigates to /mypage/messages/[conversationId]
  Thread page mounts → PUT /read → notification isRead=true, lastReadAt updated
  Every 5s while page open → GET /api/messages/[id]?after=<lastMsgId>
    → new messages appended → PUT /read again
```

### 2.5 `admin_message` removal

Carefully phased:
- `NotificationType.ADMIN_MESSAGE` removed from the constants module.
- `createAdminMessageNotification` function removed from `src/lib/notification.ts`.
- `sendAdminMessageEmail` removed from `src/lib/email.ts`.
- `POST /api/admin/notifications/send` route file deleted.
- `NotificationPreference.emailAdminMessage` column dropped.
- Settings page: admin-message row removed, DM row added.
- Existing DB rows with `type='admin_message'`: **left in place** for history. The `/mypage/notifications` page's `iconFor` keeps a fallback entry for this legacy value so those records continue to render. The link on legacy rows points at the obsolete dialog — the UI treats them as read-only history items.

### 2.6 File map

```
prisma/schema.base.prisma                                modify
src/lib/messaging.ts                                     new
src/lib/notification.ts                                  modify (remove admin_message bits)
src/lib/notification-types.ts                            modify (ADMIN_MESSAGE → DIRECT_MESSAGE)
src/lib/email.ts                                         modify (remove sendAdminMessageEmail, add sendDirectMessageEmail)
src/app/api/messages/route.ts                            new (GET list + POST send)
src/app/api/messages/[id]/route.ts                       new (GET thread)
src/app/api/messages/[id]/read/route.ts                  new (PUT)
src/app/api/messages/[id]/hide/route.ts                  new (PUT)
src/app/api/admin/notifications/send/route.ts            delete
src/app/[locale]/mypage/messages/page.tsx                new
src/app/[locale]/mypage/messages/[id]/page.tsx           new
src/components/messaging/SendMessageDialog.tsx           new (replaces SendNotificationDialog)
src/components/messaging/ConversationList.tsx            new (used by /mypage/messages)
src/components/messaging/ConversationView.tsx            new (used by /mypage/messages/[id])
src/components/admin/SendNotificationDialog.tsx          delete
src/components/UserProfileModal.tsx                      modify ("쪽지 보내기" button)
src/app/[locale]/profile/[uuid]/page.tsx                 modify (same button)
src/app/[locale]/admin/users/page.tsx                    modify (dialog swap)
src/plugins/shop/admin/orders/[id]/page.tsx              modify (dialog swap) — submodule
src/app/[locale]/mypage/notifications/page.tsx           modify (iconFor adds direct_message; keeps admin_message fallback)
src/app/[locale]/mypage/settings/notifications/page.tsx  modify (swap admin row → DM row)
src/components/layout/MyPageLayout.tsx                   modify (add /mypage/messages nav)
src/layouts/default/Header.tsx                           modify (add direct_message icon mapping)
src/locales/ko.json, en.json                             modify
```

## 3. Data model

### 3.1 New `Conversation`

```prisma
model Conversation {
  id              Int       @id @default(autoincrement())
  user1Id         Int       // invariant: user1Id < user2Id
  user2Id         Int
  lastMessageAt   DateTime?
  user1LastReadAt DateTime?
  user2LastReadAt DateTime?
  user1HiddenAt   DateTime?
  user2HiddenAt   DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  messages        Message[]
  user1           User      @relation("ConversationUser1", fields: [user1Id], references: [id], onDelete: Cascade)
  user2           User      @relation("ConversationUser2", fields: [user2Id], references: [id], onDelete: Cascade)

  @@unique([user1Id, user2Id])
  @@index([user1Id, lastMessageAt])
  @@index([user2Id, lastMessageAt])
  @@map("conversations")
}
```

- `user1Id < user2Id` is enforced by `findOrCreateConversation` sorting the two ids before lookup/insert. The unique constraint guarantees one row per pair.
- Per-viewer state (`lastReadAt`, `hiddenAt`) lives in `user{1,2}` columns rather than a join table. Simple for 1:1; if group DMs come later, split into a `ConversationParticipant` table.
- Cascade on the `User` relations means a user's account deletion removes their conversations (and through the next cascade, their messages).

### 3.2 New `Message`

```prisma
model Message {
  id             Int      @id @default(autoincrement())
  conversationId Int
  senderId       Int
  content        String   @db.Text
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         User         @relation("MessageSender", fields: [senderId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
  @@index([senderId])
  @@map("messages")
}
```

- No `deletedAt` — message-level delete is out of scope.
- `@@index([conversationId, createdAt])` supports cursor pagination and newest-first fetch.
- Content max 2000 chars (enforced at the API layer, not the column — TEXT covers it).

### 3.3 `User` relations

```prisma
model User {
  // existing fields...
  conversationsAsUser1 Conversation[] @relation("ConversationUser1")
  conversationsAsUser2 Conversation[] @relation("ConversationUser2")
  sentMessages         Message[]      @relation("MessageSender")
}
```

### 3.4 `NotificationPreference` changes

Add one column, drop one column:

```prisma
model NotificationPreference {
  // existing fields...
  emailDirectMessage Boolean @default(false)
  // emailAdminMessage  ← drop
}
```

Migration SQL:
```sql
ALTER TABLE notification_preferences ADD COLUMN emailDirectMessage BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notification_preferences DROP COLUMN emailAdminMessage;
```

No backfill — default handles existing rows.

### 3.5 `NotificationType` constants

```ts
// src/lib/notification-types.ts (replace)
export const NotificationType = {
  POST_COMMENT: 'post_comment',
  COMMENT_REPLY: 'comment_reply',
  MENTION: 'mention',
  DIRECT_MESSAGE: 'direct_message',
  ORDER_STATUS: 'order_status',
} as const

// DIRECT_MESSAGE intentionally omitted — in-app delivery is mandatory,
// mirroring the old ADMIN_MESSAGE behavior.
export const PREFERENCE_CONTROLLED_TYPES: NotificationTypeValue[] = [
  NotificationType.POST_COMMENT,
  NotificationType.COMMENT_REPLY,
  NotificationType.MENTION,
  NotificationType.ORDER_STATUS,
]
```

`shouldEmail` gains a `DIRECT_MESSAGE: false` default and a switch case reading `pref.emailDirectMessage`. The `ADMIN_MESSAGE` entry is removed from defaults and switch.

## 4. API design

### 4.1 Endpoints

```
GET  /api/messages                              # my conversation list
GET  /api/messages/[conversationId]             # thread messages
POST /api/messages/send                         # send a message (find-or-create)
PUT  /api/messages/[conversationId]/read        # mark my lastReadAt + related notifications read
PUT  /api/messages/[conversationId]/hide        # toggle my hiddenAt
```

### 4.2 `GET /api/messages`

**Query params:** `hidden=true|false` (default false).

**Response:**
```ts
{
  conversations: Array<{
    id: number
    opponent: { id, nickname, image }
    lastMessage: { content, createdAt, senderId } | null
    unreadCount: number
    hiddenByMe: boolean
    lastMessageAt: Date | null
  }>
  totalCount: number
}
```

- Filter by `user1Id = me OR user2Id = me`.
- Filter by `user{me}HiddenAt IS NULL` (or `IS NOT NULL` when `hidden=true`).
- Sort by `lastMessageAt DESC` (null last).
- `unreadCount` computed per row: `SELECT COUNT(*) FROM messages WHERE conversationId = c.id AND senderId != me AND createdAt > c.user{me}LastReadAt`. Done via subquery to avoid N+1.

### 4.3 `GET /api/messages/[conversationId]`

**Query params:**
- `before=<messageId>` (optional) — fetch messages older than this id (for "load earlier").
- `after=<messageId>` (optional) — fetch messages newer than this id (for polling).
- `limit=30` (default).

**Response:**
```ts
{
  conversation: {
    id: number
    opponent: { id, nickname, image }
    hiddenByMe: boolean
  }
  messages: Array<{ id, senderId, content, createdAt }>
  hasMore: boolean    // relevant only for `before`-mode
}
```

- Authorization: `conv.user1Id === me || conv.user2Id === me`, else 403.
- Does **not** auto-mark read. Client calls `PUT /read` explicitly on mount and after each poll that yields new messages.

### 4.4 `POST /api/messages/send`

**Body:**
```ts
{
  toUserId: number
  content: string           // 1..2000 chars
  sendEmail?: boolean       // honored only when session.role in ['admin','manager']
}
```

**Behavior:**
1. 401 if no session.
2. 403 if `session.status !== 'active'`.
3. 400 if `toUserId === session.id`.
4. 404 if recipient user not found or `deletedAt` set.
5. 400 if content length out of 1..2000.
6. 429 if rate limit (60/min/session, in-memory bucket) exceeded.
7. `findOrCreateConversation(session.id, toUserId)` — ids sorted to (user1, user2).
8. Create `Message`, update `Conversation.lastMessageAt`, and clear the recipient's `user{N}HiddenAt` (so hidden conversations resurface).
9. Create a `Notification` row for the recipient (type `direct_message`, title / message preview / link).
10. Email: if `sendEmail === true && session.role in ['admin','manager']` OR `await shouldEmail(recipient, DIRECT_MESSAGE)` → fire `sendDirectMessageEmail`.
11. Response: `{ conversationId, messageId }`.

### 4.5 `PUT /api/messages/[conversationId]/read`

- Authorization check.
- Update `user{me}LastReadAt = now()`.
- `prisma.notification.updateMany` set `isRead = true` where `userId = me AND type = 'direct_message' AND link = '/mypage/messages/<conversationId>'`.
- Single transaction.
- Response: `{ success: true }`.

### 4.6 `PUT /api/messages/[conversationId]/hide`

**Body:** `{ hidden: boolean }`

- Authorization check.
- Set `user{me}HiddenAt = hidden ? now() : null`.
- Response: `{ success: true }`.

### 4.7 Removed endpoints

- `POST /api/admin/notifications/send` — deleted. Admin flow uses `/api/messages/send`.

### 4.8 Security summary

| Check | Where | Response |
|---|---|---|
| Logged in | every endpoint | 401 |
| Sender is active | `/send` | 403 |
| Participant check | thread GET, `/read`, `/hide` | 403 |
| Recipient exists and not deleted | `/send` | 404 |
| Self-send | `/send` | 400 |
| Content 1..2000 chars | `/send` | 400 |
| Rate limit 60/min per session | `/send` | 429 |

## 5. UI

### 5.1 `/mypage/messages` — conversation list

- Uses `MyPageLayout`.
- Header: "쪽지" title with envelope icon.
- Filter tabs: **전체 / 안 읽음 / 숨긴 대화** (query param driven).
- Rows: opponent avatar + nickname, last-message preview (`line-clamp-1`), relative time + hover tooltip for full timestamp, unread badge when `> 0`. On hover, right-side icon for hide (or restore in the hidden tab).
- Row click → `/mypage/messages/[id]`.
- Empty states: loading via `tc('loading')`; no conversations shows an encouraging empty hint pointing at profile send.
- Pagination: simple "load more" at the bottom if total > page size.

### 5.2 `/mypage/messages/[id]` — thread view

- Dedicated layout — not `MyPageLayout` (full-height chat surface is wanted; sidebar would cramp it).
- Header row: back button, opponent avatar + nickname (clicking opens `UserProfileModal`), overflow menu `⋮` with "이 대화 숨기기 / 복구".
- Message list: bubbles aligned by sender (me right / primary color; opponent left / muted). Consecutive same-sender messages suppress the avatar+name. Below each bubble, a small relative timestamp with full-timestamp tooltip.
- "Earlier messages" appears when the oldest loaded message isn't the first — `IntersectionObserver` on the top triggers fetch with `before=<oldestId>` and preserves scroll offset.
- Input at the bottom: `Textarea` auto-expanding 1–6 lines then scrolling, Ctrl/Cmd+Enter or Send button submits, a 2000-char counter turns warning-colored beyond 950.
- On mount: `GET /api/messages/[id]` + `PUT /read`.
- While mounted: every 5s `GET /api/messages/[id]?after=<lastMsgId>`; if new messages arrive, append and `PUT /read` again.
- Navigating away cancels the polling timer.

### 5.3 `SendMessageDialog`

Replaces Phase 1's `SendNotificationDialog`. Moves to `src/components/messaging/`.

**Props:**
```ts
{
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  userLabel?: string
  prefillContent?: string
}
```

**Fields:**
- Message body (textarea, required, 1..2000).
- "이메일도 함께 발송" checkbox — visible only when the current session is admin/manager (non-admin callers still see this component via profile modal, so gate it).

**Submit:**
- Client-side validation (mirroring server).
- `POST /api/messages/send`.
- On success:
  - If opened from `UserProfileModal` or `/profile/[uuid]` (non-admin path): redirect to `/mypage/messages/[conversationId]`.
  - If opened from admin surfaces (`/admin/users`, order detail): toast + close, stay on admin page. Distinguished by a `redirectAfter?: 'thread' | 'none'` prop with `'thread'` as the default.

### 5.4 `UserProfileModal` and `/profile/[uuid]`

- Add a "쪽지 보내기" button next to the existing action area.
- Hide the button when viewing one's own profile.
- Button opens `SendMessageDialog` with `userId` = the profile's user id; no `prefillContent`.

### 5.5 `/admin/users` and shop order admin detail

- Swap `<SendNotificationDialog>` for `<SendMessageDialog>`.
- Admin send retains the "이메일도 함께 발송" override.
- Shop order detail provides `prefillContent` such as `주문번호 ${order.orderNo} 관련 안내드립니다.` (concrete copy finalized during implementation).

### 5.6 `/mypage/settings/notifications`

- Remove the `adminMessage` row (the pinned in-app + email row).
- Add a `directMessage` row:
  - In-app switch: `disabled checked` with info tooltip ("쪽지는 인앱에서 끌 수 없습니다").
  - Email switch: toggle bound to `emailDirectMessage` (default off).

### 5.7 `MyPageLayout` nav

Add an entry after the existing "알림" item:
```ts
items.push({ label: t('messages.label'), icon: 'MessageSquare', path: '/mypage/messages' })
```
`iconMap` in `MyPageLayout.tsx` already imports `MessageSquare`; no icon-map change needed.

### 5.8 `Header.tsx` notification dropdown

- Extend the icon mapping added in Phase 1 to include `direct_message` → `MessageSquare`.
- Keep a legacy `admin_message` entry (points to the same icon) so old rows still render sensibly.
- No separate envelope icon on the header — DM count flows through the existing Bell unread count.

### 5.9 i18n keys (ko / en)

New / updated:
- `mypage.messages.{label, filterAll, filterUnread, filterHidden, empty, hideAction, unhideAction, loadMore}`
- `mypage.messagesThread.{placeholder, sendButton, charLimit, confirmHide}`
- `admin.messages.send.{title, contentLabel, sendEmailLabel, submit, cancel, success, failure}` (replaces the `admin.notifications.send.*` keys)
- `mypage.settings.notifications.types.directMessage`
- `mypage.settings.notifications.directMessageNote` (the in-app-mandatory explanation)
- Remove:
  - `mypage.settings.notifications.types.adminMessage`
  - `admin.notifications.send.*` (or rename to `admin.messages.send.*`)

## 6. Cross-cutting concerns

### 6.1 Notification flow on message arrival

Happens inside `sendMessage`:
1. Insert `Message`.
2. Update `Conversation.lastMessageAt`; clear recipient's `hiddenAt`.
3. `prisma.notification.create({ data: { userId: recipientId, type: 'direct_message', title, message: contentPreview, link: \`/mypage/messages/\${conversationId}\` } })`.
4. Email dispatch per §4.4 step 10.

Admin messages bypass `shouldNotify` implicitly — `direct_message` is not in `PREFERENCE_CONTROLLED_TYPES`, so `shouldNotify` already returns true for it.

### 6.2 Read flow on thread open

`PUT /read` executes both updates in a single transaction:
- `conversation.user{N}LastReadAt = now()`
- `notification.updateMany` where `userId = me AND type = 'direct_message' AND link = target AND isRead = false` → `isRead = true`

### 6.3 Email helper

New `src/lib/email.ts` export:
```ts
export async function sendDirectMessageEmail(
  to: string,
  senderName: string,
  content: string,
  conversationId: number,
) { ... }
```
- Subject: `[<shopName>] <senderName>님의 쪽지`.
- Body: HTML-escaped sender name and first 200 chars of content, "답장하러 가기" button linking to `${APP_URL}/mypage/messages/<conversationId>`, the same disclaimer footer used elsewhere.
- Wrapped in try/catch; logs on failure; never throws.
- Removed: `sendAdminMessageEmail`.

### 6.4 Migration

```sql
-- 1. tables
CREATE TABLE conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user1Id INT NOT NULL,
  user2Id INT NOT NULL,
  lastMessageAt DATETIME(3) NULL,
  user1LastReadAt DATETIME(3) NULL,
  user2LastReadAt DATETIME(3) NULL,
  user1HiddenAt DATETIME(3) NULL,
  user2HiddenAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  UNIQUE KEY conversations_user1Id_user2Id_key (user1Id, user2Id),
  INDEX conversations_user1Id_lastMessageAt_idx (user1Id, lastMessageAt),
  INDEX conversations_user2Id_lastMessageAt_idx (user2Id, lastMessageAt),
  CONSTRAINT conversations_user1Id_fkey FOREIGN KEY (user1Id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT conversations_user2Id_fkey FOREIGN KEY (user2Id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversationId INT NOT NULL,
  senderId INT NOT NULL,
  content TEXT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX messages_conversationId_createdAt_idx (conversationId, createdAt),
  INDEX messages_senderId_idx (senderId),
  CONSTRAINT messages_conversationId_fkey FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT messages_senderId_fkey FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. preference column swap
ALTER TABLE notification_preferences ADD COLUMN emailDirectMessage BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notification_preferences DROP COLUMN emailAdminMessage;
```

Apply path:
- If `prisma migrate dev` succeeds (shadow DB works): use it.
- Otherwise: `prisma db execute --file <migration.sql>` + `prisma migrate resolve --applied <name>`, same as Phase 1.

Rollback:
- New code paths are gated by the schema presence; reverting requires code revert (back to Phase 1) plus `DROP TABLE messages; DROP TABLE conversations; ALTER TABLE notification_preferences DROP COLUMN emailDirectMessage; ADD COLUMN emailAdminMessage BOOLEAN NOT NULL DEFAULT true;`.

Existing `type='admin_message'` notification rows are **preserved** and remain readable on `/mypage/notifications`.

### 6.5 Testing strategy

The codebase has no test runner. Verification is manual E2E — same convention as Phase 1.

**Manual E2E checklist:**
1. Two members, test2 → test3 via profile modal: dialog opens, sending lands on `/mypage/messages/[id]`; test3's header bell shows +1; test3 opens thread → bell clears.
2. Reply from test3 → test2 in same thread; both users see combined history; time tooltips render per locale.
3. Member → admin: test2 → admin's profile, shows "쪽지 보내기". Admin receives and replies.
4. Admin from `/admin/users`: send to test2 with `sendEmail` checked → email arrives; test2's `emailDirectMessage` being `false` does NOT block because admin override.
5. Hide test2's conversation → disappears from main tab, shows in "숨긴 대화" tab; click "복구" → returns. Alternatively, admin sends a new message → conversation resurfaces automatically.
6. Rate limit: send 61 messages rapidly from a test account → the 61st returns 429.
7. Banned sender: change test4's `status` to `banned` via `/admin/users`, try to send → 403.
8. Self-send: construct API call with `toUserId = session.id` → 400.
9. Settings: open `/mypage/settings/notifications`, verify DM in-app is disabled/checked, email toggles; `adminMessage` row absent.
10. Legacy `admin_message` rows from Phase 1 remain visible and read state on `/mypage/notifications`.
11. DM pagination: chat exceeding 30 messages, scroll up → older messages load without jump.

### 6.6 Implementation order

```
Step  1  Prisma schema additions + migration (conversations, messages, pref col swap)
Step  2  src/lib/notification-types.ts: DIRECT_MESSAGE in / ADMIN_MESSAGE out
Step  3  src/lib/notification.ts: remove createAdminMessageNotification; shouldEmail defaults/switch updated
Step  4  src/lib/email.ts: drop sendAdminMessageEmail, add sendDirectMessageEmail
Step  5  src/lib/messaging.ts: find-or-create, sendMessage, markRead, hide/unhide, canSendMessage
Step  6  API routes: list, thread GET (with before/after), send, read, hide
Step  7  Delete /api/admin/notifications/send
Step  8  SendMessageDialog (replaces SendNotificationDialog)
Step  9  /mypage/messages list page + ConversationList component
Step 10  /mypage/messages/[id] thread page + ConversationView component + polling
Step 11  UserProfileModal + /profile/[uuid]: Send button wiring
Step 12  /admin/users + shop order detail: dialog swap
Step 13  /mypage/settings/notifications: admin row out, DM row in
Step 14  /mypage/notifications: iconFor updated (direct_message, legacy admin_message)
Step 15  MyPageLayout + Header icon mapping updates
Step 16  i18n ko/en keys (add DM keys, remove admin-message keys)
Step 17  Manual E2E pass
```

Each step is one commit. No feature flag.

### 6.7 Performance / security

- Conversation list query: `WHERE user1Id = me OR user2Id = me` forces a two-index read. Consider a covering index or a materialized column later if it ever becomes hot. Phase 2 scale does not need it.
- Thread fetch: `@@index([conversationId, createdAt])` used directly.
- XSS: React auto-escape on message rendering. No link autolinking in Phase 2 (safer, simpler).
- Rate limit 60/min per session is a soft ceiling; daily quotas and IP-level limits deferred.

### 6.8 Future (Phase 3+)

- Message-level edit/delete
- File attachments
- Group DMs (→ introduce ConversationParticipant table)
- Block / mute between members
- Abuse reporting and admin moderation tooling
- Real-time push (SSE)
- Search
- Per-message read receipts
- Typing indicators
- Separate envelope icon with its own unread counter

---

## (한국어) 설계 요약

### 목표

Phase 1 알림 위에 **1:1 스레드형 쪽지(DM)** 를 얹는다. Phase 1의 단방향 `admin_message`는 DM으로 **완전 대체**. 발송 경로는 하나로 통일하며, 답장 가능.

### 범위

**포함**
- `Conversation` + `Message` 테이블 (1:1, user1Id < user2Id 불변식)
- `src/lib/messaging.ts` 코어 헬퍼
- `/api/messages/*` REST 엔드포인트
- `/mypage/messages` 목록 / `/mypage/messages/[id]` 대화방
- `UserProfileModal` 및 `/profile/[uuid]`에 "쪽지 보내기" 버튼
- 폴링: 헤더 60초(기존), 대화방 5초
- 메시지당 1건 `direct_message` 알림 생성 (헤더 99+ 캡)
- 대화방 열람 시 관련 알림 자동 isRead
- `NotificationPreference.emailDirectMessage` (기본 OFF, 인앱은 강제 ON)
- 대화방 숨기기(본인만) + 자동/수동 복구
- 관리자 발송은 `SendMessageDialog` 재활용, "이메일 발송" override
- `admin_message` 타입·관련 코드 완전 제거

**제외**: 그룹 DM, 첨부, 메시지 단위 편집/삭제, 타이핑, 메시지별 읽음 표시, 검색, 모더레이션, 신고, 실시간, 유저간 차단, 토스트/사운드, 별도 쪽지 아이콘.

### 원칙

- DM은 코어. 플러그인은 참여 안 함.
- Phase 1 알림/이메일 인프라 재사용.
- 폴링만, 어떤 호스팅에서든 동작.
- DB 불변식으로 코드 단순화 (`@@unique(user1Id, user2Id)`).
- 프라이버시 기본값: 참여자 외 누구도(관리자 포함) 대화 열람 불가.

### 데이터 모델

- 신규 `Conversation` (unique pair + per-viewer lastReadAt/hiddenAt)
- 신규 `Message`
- 기존 `User`에 관계 3개 추가
- `NotificationPreference`: `emailDirectMessage` 추가, `emailAdminMessage` 삭제
- `NotificationType`: `ADMIN_MESSAGE` → `DIRECT_MESSAGE` (상수 파일 교체)

### 주요 기능 흐름

- **회원 → 회원**: 프로필 모달의 "쪽지 보내기" → 다이얼로그 → POST /send → 대화방 리다이렉트
- **관리자 → 고객**: `/admin/users` 행 or 주문 상세 → 같은 다이얼로그, 이메일 override 가능, 대화방 리다이렉트 안 함
- **수신자**: 헤더 배지 + 알림 드롭다운 row → 클릭 시 대화방. 대화방 진입 = 알림 자동 읽음.
- **대화방**: 5초 폴링으로 새 메시지 append, 위로 스크롤 시 이전 로드.
- **숨기기**: 본인 쪽만 사라짐, 상대가 새 메시지 보내면 자동 복원. 숨긴 대화 탭에서 수동 복원.

### 구현 순서

17단계 (스키마·마이그레이션 → 코어 lib → API → UI 페이지/컴포넌트 → 통합 → i18n → 수동 E2E). 단계별 독립 커밋. 기능 플래그 없음.

### 마이그레이션

- 신규 테이블 2개 + pref 컬럼 swap
- `prisma migrate dev` 실패 시 Phase 1과 동일한 수동 SQL + `migrate resolve` 경로
- 기존 `type='admin_message'` 알림 row는 히스토리로 보존
- 롤백은 완전 revert + 테이블 DROP

### 성능·보안

- `Conversation` 두 축 인덱스로 목록 조회 빠름
- `Message(conversationId, createdAt)` 인덱스로 스레드/커서 페이지네이션
- React 자동 이스케이프 + 서버 API 검증 (길이/권한/rate-limit 60/min)
- 프라이버시: 참여자 검증 3곳(thread GET, read, hide)

### 미래 작업 (Phase 3+)

개별 삭제·수정, 첨부, 그룹, 차단, 신고, 실시간, 검색, 메시지별 읽음 표시, 타이핑, 별도 쪽지 아이콘.
