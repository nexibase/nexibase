// Canonical notification type identifiers. Kept as string literals so
// stored values remain readable in the DB and existing 'order_status'
// records stay compatible.
export const NotificationType = {
  POST_COMMENT: 'post_comment',
  COMMENT_REPLY: 'comment_reply',
  MENTION: 'mention',
  ADMIN_MESSAGE: 'admin_message',
  ORDER_STATUS: 'order_status',
} as const

export type NotificationTypeValue =
  typeof NotificationType[keyof typeof NotificationType]

// Types that obey user preference (both in-app and email).
// ADMIN_MESSAGE is intentionally omitted — admin messages must always
// reach the user in-app and can only be opted out of by email.
export const PREFERENCE_CONTROLLED_TYPES: NotificationTypeValue[] = [
  NotificationType.POST_COMMENT,
  NotificationType.COMMENT_REPLY,
  NotificationType.MENTION,
  NotificationType.ORDER_STATUS,
]
