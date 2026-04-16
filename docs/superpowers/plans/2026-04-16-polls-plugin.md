# Polls Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polls plugin for NexiBase that lets admins create polls (manually or via AI), users vote on them, and display active polls as home widgets — inspired by sir.kr/polls.

**Architecture:** Plugin-based (auto-scanned by `scripts/scan-plugins.js`). Prisma for DB, Next.js API routes for backend, React client components for UI. Claude API for AI poll generation. Widget renders active poll in any home zone.

**Tech Stack:** Next.js 16, Prisma (MariaDB), Tailwind CSS, shadcn/ui, lucide-react, @anthropic-ai/sdk, next-intl

**Reference:** sir.kr/polls (UI), `/home/kagla/aaa/new` (Laravel polls source), `src/plugins/vibe-coding-recipes` (AI pattern)

---

## File Structure

```
src/plugins/polls/
├── plugin.ts                          # Plugin metadata
├── schema.prisma                      # Poll, PollOption, PollVote, PollGenerationLog models
├── schema.user.prisma                 # User relation injection
├── admin/
│   ├── menus.ts                       # Sidebar menu entry
│   ├── page.tsx                       # Admin CRUD page
│   └── api/
│       ├── route.ts                   # GET (list), POST (create)
│       ├── [id]/
│       │   └── route.ts              # GET, PUT, DELETE single poll
│       └── generate/
│           └── route.ts              # POST — AI poll generation
├── api/
│   ├── route.ts                       # GET public polls list
│   ├── current/
│   │   └── route.ts                  # GET current active poll
│   └── [id]/
│       └── vote/
│           └── route.ts              # POST vote, DELETE cancel vote
├── routes/
│   ├── page.tsx                       # Public polls list page
│   └── [id]/
│       └── page.tsx                  # Poll detail + vote page
├── components/
│   ├── PollsPage.tsx                  # Public list (client)
│   ├── PollDetail.tsx                 # Detail + voting UI (client)
│   ├── PollResultBar.tsx              # Percentage bar component
│   └── PollForm.tsx                   # Admin create/edit form (client)
├── widgets/
│   ├── ActivePoll.tsx                 # Widget: current poll
│   └── ActivePoll.meta.ts            # Widget metadata
├── lib/
│   ├── claude-client.ts              # Claude API wrapper
│   └── prompt-builder.ts            # AI prompt for poll generation
└── locales/
    ├── en.json
    └── ko.json
```

---

## Task 1: Plugin Scaffold & Prisma Schema

**Files:**
- Create: `src/plugins/polls/plugin.ts`
- Create: `src/plugins/polls/schema.prisma`
- Create: `src/plugins/polls/schema.user.prisma`
- Create: `src/plugins/polls/admin/menus.ts`
- Create: `src/plugins/polls/locales/en.json`
- Create: `src/plugins/polls/locales/ko.json`

- [ ] **Step 1: Create plugin.ts**

```typescript
// src/plugins/polls/plugin.ts
export default {
  name: 'Polls',
  description: 'Community polls with AI generation and voting',
  version: '1.0.0',
  author: 'nexibase',
  authorDomain: 'https://nexibase.com',
  repository: '',
  slug: 'polls',
  defaultEnabled: true,
}
```

- [ ] **Step 2: Create schema.prisma**

```prisma
// src/plugins/polls/schema.prisma

model Poll {
  id          Int       @id @default(autoincrement())
  question    String    @db.VarChar(500)
  description String?   @db.Text
  category    String?   @db.VarChar(50)
  isMultiple  Boolean   @default(false)
  status      String    @default("active") @db.VarChar(20) // draft, active, closed
  authorId    Int
  viewCount   Int       @default(0)
  closesAt    DateTime?
  isAi        Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  author      User         @relation("UserPolls", fields: [authorId], references: [id], onDelete: Cascade)
  options     PollOption[]
  votes       PollVote[]

  @@index([status])
  @@index([createdAt])
  @@map("polls")
}

model PollOption {
  id        Int    @id @default(autoincrement())
  pollId    Int
  label     String @db.VarChar(500)
  emoji     String? @db.VarChar(10)
  sortOrder Int    @default(0)

  poll      Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  votes     PollVote[]

  @@index([pollId])
  @@map("poll_options")
}

model PollVote {
  id        Int      @id @default(autoincrement())
  pollId    Int
  optionId  Int
  userId    Int?
  ip        String?  @db.VarChar(50)
  votedAt   DateTime @default(now())

  poll      Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  option    PollOption @relation(fields: [optionId], references: [id], onDelete: Cascade)
  user      User?      @relation("UserPollVotes", fields: [userId], references: [id], onDelete: SetNull)

  @@unique([pollId, userId])
  @@index([pollId])
  @@index([userId])
  @@map("poll_votes")
}

model PollGenerationLog {
  id           Int       @id @default(autoincrement())
  topic        String?   @db.VarChar(500)
  status       String    @db.VarChar(20) // running, success, failed
  pollId       Int?
  tokensUsed   Int?
  errorMessage String?   @db.Text
  startedAt    DateTime  @default(now())
  finishedAt   DateTime?

  @@index([status])
  @@map("poll_generation_logs")
}
```

- [ ] **Step 3: Create schema.user.prisma**

```prisma
polls     Poll[]     @relation("UserPolls")
pollVotes PollVote[] @relation("UserPollVotes")
```

- [ ] **Step 4: Create admin/menus.ts**

```typescript
// src/plugins/polls/admin/menus.ts
export default [
  { label: 'Polls', icon: 'BarChart3', path: '/admin/polls' },
]
```

- [ ] **Step 5: Create locales/en.json**

```json
{
  "polls": {
    "title": "Polls",
    "subtitle": "Community polls — vote and see results",
    "vote": "Vote",
    "votes": "votes",
    "voted": "Voted",
    "cancelVote": "Cancel vote",
    "viewResults": "View results",
    "closed": "Closed",
    "closesAt": "Closes",
    "multipleChoice": "Multiple choice",
    "loginToVote": "Login required to vote",
    "noPolls": "No polls yet.",
    "totalVotes": "Total votes",
    "aiGenerated": "AI generated",
    "admin": {
      "menu": "Polls",
      "title": "Manage Polls",
      "create": "Create Poll",
      "edit": "Edit Poll",
      "question": "Question",
      "description": "Description (optional)",
      "category": "Category",
      "options": "Options",
      "addOption": "Add option",
      "removeOption": "Remove",
      "multiple": "Allow multiple selections",
      "closesAt": "Close date (optional)",
      "status": "Status",
      "active": "Active",
      "draft": "Draft",
      "close": "Close",
      "save": "Save",
      "delete": "Delete",
      "deleteConfirm": "Delete this poll?",
      "totalPolls": "Total",
      "activePolls": "Active",
      "totalVotes": "Total votes",
      "generate": "AI Generate",
      "generateTitle": "Generate Poll with AI",
      "topic": "Topic or keyword",
      "topicPlaceholder": "e.g. favorite programming language, best CMS...",
      "generating": "Generating...",
      "generateSuccess": "Poll generated",
      "generateFailed": "Generation failed"
    }
  }
}
```

- [ ] **Step 6: Create locales/ko.json**

```json
{
  "polls": {
    "title": "투표",
    "subtitle": "커뮤니티 투표 — 참여하고 결과를 확인하세요",
    "vote": "투표하기",
    "votes": "표",
    "voted": "투표 완료",
    "cancelVote": "투표 취소",
    "viewResults": "결과 보기",
    "closed": "마감",
    "closesAt": "마감일",
    "multipleChoice": "복수 선택",
    "loginToVote": "투표하려면 로그인이 필요합니다",
    "noPolls": "등록된 투표가 없습니다.",
    "totalVotes": "총 투표수",
    "aiGenerated": "AI 생성",
    "admin": {
      "menu": "투표",
      "title": "투표 관리",
      "create": "투표 만들기",
      "edit": "투표 수정",
      "question": "질문",
      "description": "설명 (선택)",
      "category": "카테고리",
      "options": "선택지",
      "addOption": "선택지 추가",
      "removeOption": "삭제",
      "multiple": "복수 선택 허용",
      "closesAt": "마감일 (선택)",
      "status": "상태",
      "active": "진행 중",
      "draft": "임시저장",
      "close": "마감",
      "save": "저장",
      "delete": "삭제",
      "deleteConfirm": "이 투표를 삭제하시겠습니까?",
      "totalPolls": "전체",
      "activePolls": "진행 중",
      "totalVotes": "총 투표수",
      "generate": "AI 생성",
      "generateTitle": "AI로 투표 생성",
      "topic": "주제 또는 키워드",
      "topicPlaceholder": "예: 선호하는 프로그래밍 언어, 최고의 CMS...",
      "generating": "생성 중...",
      "generateSuccess": "투표가 생성되었습니다",
      "generateFailed": "생성에 실패했습니다"
    }
  }
}
```

- [ ] **Step 7: Run scan and migrate**

```bash
node scripts/scan-plugins.js
npx prisma db push
npx prisma generate
```

- [ ] **Step 8: Commit**

```bash
git add src/plugins/polls/
git commit -m "feat(polls): plugin scaffold with Prisma schema and i18n"
```

---

## Task 2: Admin API Routes

**Files:**
- Create: `src/plugins/polls/admin/api/route.ts`
- Create: `src/plugins/polls/admin/api/[id]/route.ts`

- [ ] **Step 1: Create admin list + create API**

```typescript
// src/plugins/polls/admin/api/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (search) {
    where.question = { contains: search }
  }
  if (status) {
    where.status = status
  }

  const [polls, total, activeCount, totalVotes] = await Promise.all([
    prisma.poll.findMany({
      where,
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.poll.count({ where }),
    prisma.poll.count({ where: { status: 'active' } }),
    prisma.pollVote.count(),
  ])

  return NextResponse.json({
    success: true,
    polls,
    stats: { total, activeCount, totalVotes },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.question || !body.options?.length) {
    return NextResponse.json({ error: 'Question and options required' }, { status: 400 })
  }

  const poll = await prisma.poll.create({
    data: {
      question: body.question,
      description: body.description || null,
      category: body.category || null,
      isMultiple: body.isMultiple || false,
      status: body.status || 'active',
      closesAt: body.closesAt ? new Date(body.closesAt) : null,
      isAi: body.isAi || false,
      authorId: admin.id,
      options: {
        create: body.options.map((opt: { label: string; emoji?: string }, i: number) => ({
          label: opt.label,
          emoji: opt.emoji || null,
          sortOrder: i,
        })),
      },
    },
    include: { options: true },
  })

  return NextResponse.json({ success: true, poll }, { status: 201 })
}
```

- [ ] **Step 2: Create single poll CRUD API**

```typescript
// src/plugins/polls/admin/api/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const poll = await prisma.poll.findUnique({
    where: { id: parseInt(id) },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { votes: true } },
    },
  })
  if (!poll) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ success: true, poll })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const pollId = parseInt(id)
  const body = await request.json()

  if (body.options) {
    await prisma.pollOption.deleteMany({ where: { pollId } })
    await prisma.pollOption.createMany({
      data: body.options.map((opt: { label: string; emoji?: string }, i: number) => ({
        pollId,
        label: opt.label,
        emoji: opt.emoji || null,
        sortOrder: i,
      })),
    })
  }

  const poll = await prisma.poll.update({
    where: { id: pollId },
    data: {
      ...(body.question && { question: body.question }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.category !== undefined && { category: body.category || null }),
      ...(body.isMultiple !== undefined && { isMultiple: body.isMultiple }),
      ...(body.status && { status: body.status }),
      ...(body.closesAt !== undefined && { closesAt: body.closesAt ? new Date(body.closesAt) : null }),
    },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  })

  return NextResponse.json({ success: true, poll })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.poll.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/plugins/polls/admin/api/
git commit -m "feat(polls): admin API routes (CRUD)"
```

---

## Task 3: AI Generation

**Files:**
- Create: `src/plugins/polls/lib/claude-client.ts`
- Create: `src/plugins/polls/lib/prompt-builder.ts`
- Create: `src/plugins/polls/admin/api/generate/route.ts`

- [ ] **Step 1: Create Claude client**

```typescript
// src/plugins/polls/lib/claude-client.ts
import Anthropic from '@anthropic-ai/sdk'

export interface ClaudeResponse {
  text: string
  inputTokens: number
  outputTokens: number
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<ClaudeResponse> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    temperature: 0.9,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text block in Claude response')
  }

  return {
    text: textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}
```

- [ ] **Step 2: Create prompt builder**

```typescript
// src/plugins/polls/lib/prompt-builder.ts

export function buildSystemPrompt(): string {
  return `You are a community poll creator for NexiBase, an open-source CMS platform.
Generate engaging, fun polls that encourage community participation.
Always respond with valid JSON only — no markdown, no explanation.`
}

export function buildUserPrompt(topic: string): string {
  return `Create a community poll about: "${topic}"

Requirements:
- The question should be concise, engaging, and easy to understand
- Provide 4-8 answer options
- Each option should have an optional emoji
- Decide if multiple selections make sense (isMultiple)
- Suggest a category (one of: tech, lifestyle, opinion, fun, community)

Respond in this exact JSON format:
{
  "question": "Which programming language do you prefer?",
  "description": "Share your favorite language with the community",
  "category": "tech",
  "isMultiple": false,
  "options": [
    { "label": "JavaScript", "emoji": "🟨" },
    { "label": "Python", "emoji": "🐍" },
    { "label": "TypeScript", "emoji": "🔷" },
    { "label": "Rust", "emoji": "🦀" },
    { "label": "Go", "emoji": "🐹" }
  ]
}`
}

export interface AiPollData {
  question: string
  description?: string
  category?: string
  isMultiple: boolean
  options: Array<{ label: string; emoji?: string }>
}

export function parseAiResponse(text: string): AiPollData {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in AI response')

  const data = JSON.parse(jsonMatch[0])
  if (!data.question || !Array.isArray(data.options) || data.options.length < 2) {
    throw new Error('Invalid poll structure from AI')
  }

  return {
    question: data.question,
    description: data.description || null,
    category: data.category || null,
    isMultiple: !!data.isMultiple,
    options: data.options.map((o: { label: string; emoji?: string }) => ({
      label: o.label,
      emoji: o.emoji || null,
    })),
  }
}
```

- [ ] **Step 3: Create generate API route**

```typescript
// src/plugins/polls/admin/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { callClaude } from '@/plugins/polls/lib/claude-client'
import { buildSystemPrompt, buildUserPrompt, parseAiResponse } from '@/plugins/polls/lib/prompt-builder'

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const topic = body.topic?.trim()
  if (!topic) {
    return NextResponse.json({ error: 'Topic required' }, { status: 400 })
  }

  const log = await prisma.pollGenerationLog.create({
    data: { topic, status: 'running' },
  })

  try {
    const response = await callClaude(buildSystemPrompt(), buildUserPrompt(topic))
    const parsed = parseAiResponse(response.text)

    const poll = await prisma.poll.create({
      data: {
        question: parsed.question,
        description: parsed.description,
        category: parsed.category,
        isMultiple: parsed.isMultiple,
        isAi: true,
        status: 'active',
        authorId: admin.id,
        options: {
          create: parsed.options.map((opt, i) => ({
            label: opt.label,
            emoji: opt.emoji,
            sortOrder: i,
          })),
        },
      },
      include: { options: true },
    })

    await prisma.pollGenerationLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        pollId: poll.id,
        tokensUsed: response.inputTokens + response.outputTokens,
        finishedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, poll })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await prisma.pollGenerationLog.update({
      where: { id: log.id },
      data: { status: 'failed', errorMessage: msg.slice(0, 2000), finishedAt: new Date() },
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/plugins/polls/lib/ src/plugins/polls/admin/api/generate/
git commit -m "feat(polls): AI poll generation with Claude API"
```

---

## Task 4: Public API (Vote)

**Files:**
- Create: `src/plugins/polls/api/route.ts`
- Create: `src/plugins/polls/api/current/route.ts`
- Create: `src/plugins/polls/api/[id]/vote/route.ts`

- [ ] **Step 1: Create public polls list API**

```typescript
// src/plugins/polls/api/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  const category = searchParams.get('category') || ''
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { status: { in: ['active', 'closed'] } }
  if (category) where.category = category

  const [polls, total] = await Promise.all([
    prisma.poll.findMany({
      where,
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { votes: true } } },
        },
        _count: { select: { votes: true } },
        author: { select: { nickname: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.poll.count({ where }),
  ])

  return NextResponse.json({
    polls,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}
```

- [ ] **Step 2: Create current active poll API (for widget)**

```typescript
// src/plugins/polls/api/current/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const poll = await prisma.poll.findFirst({
    where: {
      status: 'active',
      OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }],
    },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { votes: true } } },
      },
      _count: { select: { votes: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ poll })
}
```

- [ ] **Step 3: Create vote API**

```typescript
// src/plugins/polls/api/[id]/vote/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const { id } = await params
  const pollId = parseInt(id)
  const body = await request.json()
  const optionIds: number[] = Array.isArray(body.optionIds) ? body.optionIds : [body.optionId]

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: true },
  })

  if (!poll || poll.status !== 'active') {
    return NextResponse.json({ error: 'Poll not available' }, { status: 400 })
  }
  if (poll.closesAt && poll.closesAt < new Date()) {
    return NextResponse.json({ error: 'Poll has closed' }, { status: 400 })
  }

  const existing = await prisma.pollVote.findFirst({
    where: { pollId, userId: user.id },
  })
  if (existing) {
    return NextResponse.json({ error: 'Already voted' }, { status: 400 })
  }

  if (!poll.isMultiple && optionIds.length > 1) {
    return NextResponse.json({ error: 'Single choice only' }, { status: 400 })
  }

  const validOptionIds = poll.options.map((o) => o.id)
  const invalid = optionIds.find((oid) => !validOptionIds.includes(oid))
  if (invalid) {
    return NextResponse.json({ error: 'Invalid option' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

  await prisma.pollVote.createMany({
    data: optionIds.map((optionId) => ({
      pollId,
      optionId,
      userId: user.id,
      ip,
    })),
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const { id } = await params
  const pollId = parseInt(id)

  await prisma.pollVote.deleteMany({
    where: { pollId, userId: user.id },
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/plugins/polls/api/
git commit -m "feat(polls): public API — list, current, vote/cancel"
```

---

## Task 5: Admin Page UI

**Files:**
- Create: `src/plugins/polls/components/PollForm.tsx`
- Create: `src/plugins/polls/admin/page.tsx`

- [ ] **Step 1: Create PollForm component**

```typescript
// src/plugins/polls/components/PollForm.tsx
"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'

interface PollFormProps {
  initial?: {
    question: string
    description: string
    category: string
    isMultiple: boolean
    closesAt: string
    status: string
    options: Array<{ label: string; emoji: string }>
  }
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  saving: boolean
}

export default function PollForm({ initial, onSubmit, onCancel, saving }: PollFormProps) {
  const [question, setQuestion] = useState(initial?.question || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [category, setCategory] = useState(initial?.category || '')
  const [isMultiple, setIsMultiple] = useState(initial?.isMultiple || false)
  const [closesAt, setClosesAt] = useState(initial?.closesAt || '')
  const [status, setStatus] = useState(initial?.status || 'active')
  const [options, setOptions] = useState<Array<{ label: string; emoji: string }>>(
    initial?.options || [{ label: '', emoji: '' }, { label: '', emoji: '' }]
  )

  const addOption = () => setOptions([...options, { label: '', emoji: '' }])
  const removeOption = (i: number) => {
    if (options.length <= 2) return
    setOptions(options.filter((_, idx) => idx !== i))
  }
  const updateOption = (i: number, field: 'label' | 'emoji', value: string) => {
    const next = [...options]
    next[i] = { ...next[i], [field]: value }
    setOptions(next)
  }

  const handleSubmit = () => {
    if (!question.trim() || options.filter((o) => o.label.trim()).length < 2) return
    onSubmit({
      question: question.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      isMultiple,
      closesAt: closesAt || null,
      status,
      options: options.filter((o) => o.label.trim()),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Question</label>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What is your favorite...?" />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Category</label>
          <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">None</option>
            <option value="tech">Tech</option>
            <option value="lifestyle">Lifestyle</option>
            <option value="opinion">Opinion</option>
            <option value="fun">Fun</option>
            <option value="community">Community</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Status</label>
          <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Close date</label>
        <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isMultiple} onChange={(e) => setIsMultiple(e.target.checked)} />
        Allow multiple selections
      </label>
      <div>
        <label className="text-sm font-medium">Options</label>
        <div className="space-y-2 mt-1">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input className="w-16" placeholder="😀" value={opt.emoji} onChange={(e) => updateOption(i, 'emoji', e.target.value)} />
              <Input className="flex-1" placeholder={`Option ${i + 1}`} value={opt.label} onChange={(e) => updateOption(i, 'label', e.target.value)} />
              <Button variant="ghost" size="icon" onClick={() => removeOption(i)} disabled={options.length <= 2}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={addOption}>
          <Plus className="h-4 w-4 mr-1" /> Add option
        </Button>
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create admin page**

```typescript
// src/plugins/polls/admin/page.tsx
"use client"

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/admin/Sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BarChart3, Plus, Trash2, Pencil, Sparkles, Vote } from 'lucide-react'
import PollForm from '@/plugins/polls/components/PollForm'

interface PollOption {
  id: number
  label: string
  emoji: string | null
  sortOrder: number
}

interface PollData {
  id: number
  question: string
  description: string | null
  category: string | null
  isMultiple: boolean
  status: string
  isAi: boolean
  closesAt: string | null
  createdAt: string
  options: PollOption[]
  _count: { votes: number }
}

export default function PollsAdminPage() {
  const [polls, setPolls] = useState<PollData[]>([])
  const [stats, setStats] = useState({ total: 0, activeCount: 0, totalVotes: 0 })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPoll, setEditingPoll] = useState<PollData | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiTopic, setAiTopic] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const fetchPolls = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20', search })
      const res = await fetch(`/api/admin/polls?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPolls(data.polls || [])
        setStats(data.stats || {})
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchPolls() }, [fetchPolls])

  const handleCreate = async (formData: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        showMessage('Poll created')
        setModalOpen(false)
        fetchPolls()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (formData: Record<string, unknown>) => {
    if (!editingPoll) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/polls/${editingPoll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        showMessage('Poll updated')
        setEditingPoll(null)
        setModalOpen(false)
        fetchPolls()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this poll?')) return
    await fetch(`/api/admin/polls/${id}`, { method: 'DELETE' })
    showMessage('Poll deleted')
    fetchPolls()
  }

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) return
    setAiGenerating(true)
    try {
      const res = await fetch('/api/admin/polls/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic }),
      })
      if (res.ok) {
        showMessage('AI poll generated!')
        setAiModalOpen(false)
        setAiTopic('')
        fetchPolls()
      } else {
        const data = await res.json()
        showMessage(data.error || 'Generation failed')
      }
    } finally {
      setAiGenerating(false)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { active: 'default', draft: 'secondary', closed: 'outline' }
    return <Badge variant={map[status] as 'default' | 'secondary' | 'outline'}>{status}</Badge>
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" /> Polls
            </h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAiModalOpen(true)}>
                <Sparkles className="h-4 w-4 mr-1" /> AI Generate
              </Button>
              <Button onClick={() => { setEditingPoll(null); setModalOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" /> Create
              </Button>
            </div>
          </div>

          {message && (
            <div className="mb-4 px-4 py-2 bg-primary/10 text-primary rounded-md text-sm">{message}</div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.activeCount}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalVotes}</div>
              <div className="text-xs text-muted-foreground">Total votes</div>
            </CardContent></Card>
          </div>

          <div className="mb-4">
            <Input placeholder="Search polls..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Question</th>
                  <th className="text-center p-3 w-20">Status</th>
                  <th className="text-center p-3 w-20">Votes</th>
                  <th className="text-center p-3 w-24">Options</th>
                  <th className="text-right p-3 w-24">Actions</th>
                </tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                  ) : polls.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No polls yet.</td></tr>
                  ) : polls.map((poll) => (
                    <tr key={poll.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium">{poll.question}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {poll.isAi && <span className="text-purple-500 mr-2">✨ AI</span>}
                          {poll.category && <span className="mr-2">{poll.category}</span>}
                          {new Date(poll.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="text-center p-3">{statusBadge(poll.status)}</td>
                      <td className="text-center p-3">{poll._count.votes}</td>
                      <td className="text-center p-3">{poll.options.length}</td>
                      <td className="text-right p-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditingPoll(poll)
                            setModalOpen(true)
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(poll.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <span className="text-sm py-1">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}

          {/* Create/Edit Modal */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPoll ? 'Edit Poll' : 'Create Poll'}</DialogTitle>
              </DialogHeader>
              <PollForm
                initial={editingPoll ? {
                  question: editingPoll.question,
                  description: editingPoll.description || '',
                  category: editingPoll.category || '',
                  isMultiple: editingPoll.isMultiple,
                  closesAt: editingPoll.closesAt?.slice(0, 16) || '',
                  status: editingPoll.status,
                  options: editingPoll.options.map((o) => ({ label: o.label, emoji: o.emoji || '' })),
                } : undefined}
                onSubmit={editingPoll ? handleUpdate : handleCreate}
                onCancel={() => setModalOpen(false)}
                saving={saving}
              />
            </DialogContent>
          </Dialog>

          {/* AI Generate Modal */}
          <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" /> AI Generate Poll
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Topic or keyword</label>
                  <Input
                    placeholder="e.g. favorite programming language, best CMS..."
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAiGenerate} disabled={aiGenerating || !aiTopic.trim()} className="flex-1">
                    <Sparkles className="h-4 w-4 mr-1" />
                    {aiGenerating ? 'Generating...' : 'Generate'}
                  </Button>
                  <Button variant="outline" onClick={() => setAiModalOpen(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/plugins/polls/components/PollForm.tsx src/plugins/polls/admin/page.tsx
git commit -m "feat(polls): admin page with CRUD and AI generation UI"
```

---

## Task 6: Public Pages & Components

**Files:**
- Create: `src/plugins/polls/components/PollResultBar.tsx`
- Create: `src/plugins/polls/components/PollDetail.tsx`
- Create: `src/plugins/polls/components/PollsPage.tsx`
- Create: `src/plugins/polls/routes/page.tsx`
- Create: `src/plugins/polls/routes/[id]/page.tsx`

- [ ] **Step 1: Create PollResultBar**

```typescript
// src/plugins/polls/components/PollResultBar.tsx
"use client"

const COLORS = [
  'bg-blue-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-violet-500', 'bg-fuchsia-500', 'bg-cyan-500', 'bg-orange-500',
]

interface PollResultBarProps {
  label: string
  emoji?: string | null
  votes: number
  total: number
  index: number
  isSelected?: boolean
}

export default function PollResultBar({ label, emoji, votes, total, index, isSelected }: PollResultBarProps) {
  const pct = total > 0 ? Math.round((votes / total) * 1000) / 10 : 0
  const color = COLORS[index % COLORS.length]

  return (
    <div className={`relative rounded-lg border p-3 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}>
      <div
        className={`absolute inset-0 rounded-lg ${color} opacity-10 transition-all`}
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-sm font-medium">
          {emoji && <span className="mr-1.5">{emoji}</span>}
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="relative text-xs text-muted-foreground mt-1">{votes} votes</div>
    </div>
  )
}
```

- [ ] **Step 2: Create PollDetail component**

```typescript
// src/plugins/polls/components/PollDetail.tsx
"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import PollResultBar from './PollResultBar'

interface Option {
  id: number
  label: string
  emoji: string | null
  _count: { votes: number }
}

interface Poll {
  id: number
  question: string
  description: string | null
  category: string | null
  isMultiple: boolean
  status: string
  isAi: boolean
  closesAt: string | null
  createdAt: string
  options: Option[]
  _count: { votes: number }
  author: { nickname: string }
}

export default function PollDetail() {
  const params = useParams()
  const pollId = params.id as string
  const [poll, setPoll] = useState<Poll | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const [voting, setVoting] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const fetchPoll = useCallback(async () => {
    const res = await fetch(`/api/polls?page=1&limit=100`)
    if (!res.ok) return
    const data = await res.json()
    const found = data.polls?.find((p: Poll) => p.id === parseInt(pollId))
    if (found) setPoll(found)
  }, [pollId])

  const checkVoted = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (!res.ok) return
      // If user is logged in, we check vote status from the poll detail endpoint
      setHasVoted(false)
    } catch { /* not logged in */ }
  }, [])

  useEffect(() => {
    fetchPoll()
    checkVoted()
  }, [fetchPoll, checkVoted])

  const totalVotes = poll?.options.reduce((sum, o) => sum + o._count.votes, 0) || 0
  const isClosed = poll?.status === 'closed' || (poll?.closesAt && new Date(poll.closesAt) < new Date())

  const toggleOption = (optId: number) => {
    if (hasVoted || isClosed) return
    if (poll?.isMultiple) {
      setSelected((prev) => prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId])
    } else {
      setSelected([optId])
    }
  }

  const handleVote = async () => {
    if (selected.length === 0 || !poll) return
    setVoting(true)
    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIds: selected }),
      })
      if (res.ok) {
        setHasVoted(true)
        setShowResults(true)
        fetchPoll()
      } else {
        const data = await res.json()
        if (data.error === 'Already voted') {
          setHasVoted(true)
          setShowResults(true)
        }
        alert(data.error || 'Vote failed')
      }
    } finally {
      setVoting(false)
    }
  }

  const handleCancel = async () => {
    if (!poll) return
    const res = await fetch(`/api/polls/${poll.id}/vote`, { method: 'DELETE' })
    if (res.ok) {
      setHasVoted(false)
      setShowResults(false)
      setSelected([])
      fetchPoll()
    }
  }

  if (!poll) return <div className="py-12 text-center text-muted-foreground">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link href="/polls" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to polls
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">{poll.question}</h1>
              {poll.description && <p className="text-sm text-muted-foreground mt-1">{poll.description}</p>}
            </div>
            <div className="flex gap-1.5">
              {poll.isAi && <Badge variant="secondary">✨ AI</Badge>}
              {poll.category && <Badge variant="outline">{poll.category}</Badge>}
              {isClosed && <Badge variant="destructive">Closed</Badge>}
            </div>
          </div>

          {poll.isMultiple && !isClosed && (
            <p className="text-xs text-muted-foreground mb-3">Multiple selections allowed</p>
          )}

          <div className="space-y-2">
            {(showResults || hasVoted || isClosed) ? (
              poll.options.map((opt, i) => (
                <PollResultBar
                  key={opt.id}
                  label={opt.label}
                  emoji={opt.emoji}
                  votes={opt._count.votes}
                  total={totalVotes}
                  index={i}
                  isSelected={selected.includes(opt.id)}
                />
              ))
            ) : (
              poll.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                    selected.includes(opt.id)
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {opt.emoji && <span className="mr-1.5">{opt.emoji}</span>}
                  {opt.label}
                </button>
              ))
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <span className="text-sm text-muted-foreground">{totalVotes} votes</span>
            <div className="flex gap-2">
              {!isClosed && !hasVoted && !showResults && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowResults(true)}>View results</Button>
                  <Button size="sm" onClick={handleVote} disabled={selected.length === 0 || voting}>
                    {voting ? 'Voting...' : 'Vote'}
                  </Button>
                </>
              )}
              {!isClosed && showResults && !hasVoted && (
                <Button variant="outline" size="sm" onClick={() => setShowResults(false)}>Back to vote</Button>
              )}
              {hasVoted && !isClosed && (
                <Button variant="outline" size="sm" onClick={handleCancel}>Cancel vote</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create PollsPage (list)**

```typescript
// src/plugins/polls/components/PollsPage.tsx
"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart3 } from 'lucide-react'
import Link from 'next/link'
import PollResultBar from './PollResultBar'

interface Option {
  id: number
  label: string
  emoji: string | null
  _count: { votes: number }
}

interface Poll {
  id: number
  question: string
  description: string | null
  category: string | null
  isMultiple: boolean
  status: string
  isAi: boolean
  closesAt: string | null
  createdAt: string
  options: Option[]
  _count: { votes: number }
}

const CATEGORIES = ['tech', 'lifestyle', 'opinion', 'fun', 'community']

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchPolls = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '10' })
      if (category) params.set('category', category)
      const res = await fetch(`/api/polls?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPolls(data.polls || [])
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } finally {
      setLoading(false)
    }
  }, [page, category])

  useEffect(() => { fetchPolls() }, [fetchPolls])

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Polls
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Community polls — vote and see results</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Button variant={category === '' ? 'default' : 'outline'} size="sm" onClick={() => { setCategory(''); setPage(1) }}>
          All
        </Button>
        {CATEGORIES.map((cat) => (
          <Button key={cat} variant={category === cat ? 'default' : 'outline'} size="sm" onClick={() => { setCategory(cat); setPage(1) }}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : polls.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No polls yet.</div>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => {
            const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0)
            const isClosed = poll.status === 'closed' || (poll.closesAt && new Date(poll.closesAt) < new Date())
            return (
              <Card key={poll.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <Link href={`/polls/${poll.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <h2 className="text-lg font-semibold hover:text-primary transition-colors">{poll.question}</h2>
                      <div className="flex gap-1.5 shrink-0 ml-2">
                        {poll.isAi && <Badge variant="secondary" className="text-xs">✨ AI</Badge>}
                        {poll.category && <Badge variant="outline" className="text-xs">{poll.category}</Badge>}
                        {isClosed && <Badge variant="destructive" className="text-xs">Closed</Badge>}
                      </div>
                    </div>
                  </Link>
                  <div className="space-y-1.5">
                    {poll.options.slice(0, 5).map((opt, i) => (
                      <PollResultBar
                        key={opt.id}
                        label={opt.label}
                        emoji={opt.emoji}
                        votes={opt._count.votes}
                        total={totalVotes}
                        index={i}
                      />
                    ))}
                    {poll.options.length > 5 && (
                      <Link href={`/polls/${poll.id}`} className="text-xs text-primary hover:underline">
                        +{poll.options.length - 5} more options
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <span>{totalVotes} votes</span>
                    <span>{new Date(poll.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span className="text-sm py-1">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create route pages**

```typescript
// src/plugins/polls/routes/page.tsx
import type { Metadata } from 'next'
import PollsPage from '@/plugins/polls/components/PollsPage'

export const metadata: Metadata = {
  title: 'Polls',
  description: 'Community polls — vote and see results',
}

export default function Page() {
  return <PollsPage />
}
```

```typescript
// src/plugins/polls/routes/[id]/page.tsx
import PollDetail from '@/plugins/polls/components/PollDetail'

export default function Page() {
  return <PollDetail />
}
```

- [ ] **Step 5: Commit**

```bash
git add src/plugins/polls/components/ src/plugins/polls/routes/
git commit -m "feat(polls): public pages — list with category filter, detail with voting"
```

---

## Task 7: Widget

**Files:**
- Create: `src/plugins/polls/widgets/ActivePoll.meta.ts`
- Create: `src/plugins/polls/widgets/ActivePoll.tsx`

- [ ] **Step 1: Create widget meta**

```typescript
// src/plugins/polls/widgets/ActivePoll.meta.ts
export default {
  title: 'Active Poll',
  defaultZone: 'right',
  defaultColSpan: 4,
  defaultRowSpan: 1,
  settingsSchema: null,
}
```

- [ ] **Step 2: Create widget component**

```typescript
// src/plugins/polls/widgets/ActivePoll.tsx
"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3 } from 'lucide-react'
import Link from 'next/link'

const COLORS = [
  'bg-blue-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-violet-500', 'bg-fuchsia-500', 'bg-cyan-500', 'bg-orange-500',
]

interface Option {
  id: number
  label: string
  emoji: string | null
  _count: { votes: number }
}

interface Poll {
  id: number
  question: string
  isMultiple: boolean
  options: Option[]
  _count: { votes: number }
}

export default function ActivePoll() {
  const [poll, setPoll] = useState<Poll | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [voted, setVoted] = useState(false)
  const [voting, setVoting] = useState(false)

  const fetchPoll = useCallback(async () => {
    try {
      const res = await fetch('/api/polls/current')
      if (res.ok) {
        const data = await res.json()
        setPoll(data.poll)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchPoll() }, [fetchPoll])

  if (!poll) return null

  const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0)

  const toggleOption = (id: number) => {
    if (voted) return
    if (poll.isMultiple) {
      setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
    } else {
      setSelected([id])
    }
  }

  const handleVote = async () => {
    if (selected.length === 0) return
    setVoting(true)
    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIds: selected }),
      })
      if (res.ok) {
        setVoted(true)
        fetchPoll()
      } else {
        const data = await res.json()
        if (data.error === 'Already voted') setVoted(true)
      }
    } finally {
      setVoting(false)
    }
  }

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Poll</span>
        </div>
        <Link href={`/polls/${poll.id}`}>
          <h3 className="font-bold text-sm mb-3 hover:text-primary transition-colors">{poll.question}</h3>
        </Link>

        <div className="space-y-1.5">
          {poll.options.map((opt, i) => {
            const pct = totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 1000) / 10 : 0
            const color = COLORS[i % COLORS.length]
            const isSelected = selected.includes(opt.id)

            return voted ? (
              <div key={opt.id} className="relative rounded border p-2">
                <div className={`absolute inset-0 rounded ${color} opacity-10`} style={{ width: `${pct}%` }} />
                <div className="relative flex justify-between text-xs">
                  <span>{opt.emoji && <span className="mr-1">{opt.emoji}</span>}{opt.label}</span>
                  <span className="font-semibold">{pct}%</span>
                </div>
              </div>
            ) : (
              <button
                key={opt.id}
                onClick={() => toggleOption(opt.id)}
                className={`w-full text-left rounded border p-2 text-xs transition-colors ${
                  isSelected ? 'border-primary bg-primary/5 font-medium' : 'hover:border-primary/50'
                }`}
              >
                {opt.emoji && <span className="mr-1">{opt.emoji}</span>}
                {opt.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t">
          <span className="text-xs text-muted-foreground">{totalVotes} votes</span>
          {!voted ? (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={handleVote} disabled={selected.length === 0 || voting}>
              {voting ? '...' : 'Vote'}
            </Button>
          ) : (
            <Link href={`/polls/${poll.id}`} className="text-xs text-primary hover:underline">
              Details →
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/plugins/polls/widgets/
git commit -m "feat(polls): ActivePoll widget for home/sidebar display"
```

---

## Task 8: Header Menu & Final Wiring

**Files:**
- Create: `src/plugins/polls/menus/header.ts`

- [ ] **Step 1: Create header menu**

```typescript
// src/plugins/polls/menus/header.ts
export default [
  { label: 'Polls', path: '/polls', sort: 60 },
]
```

- [ ] **Step 2: Run scan, migrate, build, and test**

```bash
node scripts/scan-plugins.js
npx prisma db push
npx prisma generate
npm run build
pm2 delete nexibase-home && pm2 start ecosystem.config.js
```

- [ ] **Step 3: Test admin — create a poll manually**

Navigate to `/admin/polls`, click "Create", fill in question + options, save.

- [ ] **Step 4: Test admin — AI generate a poll**

Click "AI Generate", enter topic like "favorite programming language", generate.

- [ ] **Step 5: Test public — vote on a poll**

Navigate to `/polls`, click a poll, select option, vote. Verify results bars display.

- [ ] **Step 6: Test widget — add ActivePoll to home**

Navigate to `/admin/home-widgets`, add "Active Poll" widget to a zone, verify it renders on homepage.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat(polls): complete polls plugin with AI generation and widget"
```

---

## Summary

| Task | Component | Description |
|------|-----------|-------------|
| 1 | Scaffold | plugin.ts, schema, i18n, menus |
| 2 | Admin API | CRUD routes for polls |
| 3 | AI Gen | Claude integration for generating polls |
| 4 | Public API | List, current, vote/cancel endpoints |
| 5 | Admin UI | Management page with table + modals |
| 6 | Public UI | List page, detail page, result bars |
| 7 | Widget | ActivePoll sidebar/home widget |
| 8 | Wiring | Header menu, build, integration test |
