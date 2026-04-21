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
  //   mobile (default): 1fr / "title"  — meta is nested inside title cell
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
        "[grid-template-columns:1fr] [grid-template-areas:'title']",
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
              <Paperclip className="h-3 w-3" aria-label={t('attachmentsLabel')} />
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
