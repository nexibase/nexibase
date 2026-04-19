export const NotificationType = {
  POST_COMMENT: 'post_comment',
  COMMENT_REPLY: 'comment_reply',
  MENTION: 'mention',
  DIRECT_MESSAGE: 'direct_message',
  ORDER_STATUS: 'order_status',
} as const

export type NotificationTypeValue =
  typeof NotificationType[keyof typeof NotificationType]

// DIRECT_MESSAGE intentionally omitted — its in-app delivery is
// mandatory (mirroring the former ADMIN_MESSAGE behavior).
export const PREFERENCE_CONTROLLED_TYPES: NotificationTypeValue[] = [
  NotificationType.POST_COMMENT,
  NotificationType.COMMENT_REPLY,
  NotificationType.MENTION,
  NotificationType.ORDER_STATUS,
]
