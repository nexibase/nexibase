import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NotificationType, type NotificationTypeValue } from '@/lib/notification-types'
import { emitNotification, emailPreference } from '@/lib/notifications/service'

// Kept as a compatibility helper. All supported in-app notifications are mandatory.
export async function shouldNotify(_userId: number, _type: string) { return true }
export async function shouldEmail(userId: number, type: string) {
  return emailPreference(await prisma.notificationPreference.findUnique({ where: { userId } }), type)
}
export interface CreateNotificationParams {
  userId: number; type: NotificationTypeValue | string; title: string; message: string; link?: string; eventKey?: string
}
export function createNotification(params: CreateNotificationParams, transaction?: Prisma.TransactionClient) {
  return emitNotification({ ...params, eventKey: params.eventKey || randomUUID() }, transaction)
}
interface PostCommentParams {
  userId: number               // recipient (post author)
  fromUserName: string         // commenter nickname (for display)
  postTitle: string
  postLink: string             // e.g. "/boards/free/123"
  eventKey?: string
  excerpt?: string             // short snippet of the comment body
}

export async function createPostCommentNotification(params: PostCommentParams, transaction?: Prisma.TransactionClient) {
  return createNotification({
    userId: params.userId,
    eventKey: params.eventKey,
    type: NotificationType.POST_COMMENT,
    title: `💬 ${params.fromUserName}님이 댓글을 남겼습니다`,
    message: `"${params.postTitle}" — ${params.excerpt ?? ''}`.trim(),
    link: params.postLink,
  }, transaction)
}

interface CommentReplyParams {
  userId: number               // recipient (parent-comment author)
  fromUserName: string
  postTitle: string
  postLink: string
  eventKey?: string
  excerpt?: string
}

export async function createCommentReplyNotification(params: CommentReplyParams, transaction?: Prisma.TransactionClient) {
  return createNotification({
    userId: params.userId,
    eventKey: params.eventKey,
    type: NotificationType.COMMENT_REPLY,
    title: `↩️ ${params.fromUserName}님이 답글을 남겼습니다`,
    message: `"${params.postTitle}" — ${params.excerpt ?? ''}`.trim(),
    link: params.postLink,
  }, transaction)
}

interface MentionParams {
  userId: number               // recipient (mentioned user)
  fromUserName: string
  postTitle: string
  postLink: string
  eventKey?: string
  excerpt?: string
}

export async function createMentionNotification(params: MentionParams, transaction?: Prisma.TransactionClient) {
  return createNotification({
    userId: params.userId,
    eventKey: params.eventKey,
    type: NotificationType.MENTION,
    title: `@ ${params.fromUserName}님이 회원님을 언급했습니다`,
    message: `"${params.postTitle}" — ${params.excerpt ?? ''}`.trim(),
    link: params.postLink,
  }, transaction)
}
