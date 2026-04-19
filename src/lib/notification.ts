import { prisma } from '@/lib/prisma'
import { sendOrderStatusEmail, sendNewOrderEmailToAdmin, sendOrderCompletedEmail, sendOrderCancelledEmail, sendOrderCancelledEmailToAdmin } from '@/lib/email'
import { NotificationType, NotificationTypeValue, PREFERENCE_CONTROLLED_TYPES } from '@/lib/notification-types'

// NotificationType value union comes from '@/lib/notification-types'.

interface CreateNotificationParams {
  userId: number
  type: NotificationTypeValue
  title: string
  message: string
  link?: string
}

/**
 * Consult the user's NotificationPreference row and decide whether an
 * in-app notification of the given type should be written.
 *
 * Rules:
 *   - ADMIN_MESSAGE bypasses preferences (always delivered in-app).
 *   - Types in PREFERENCE_CONTROLLED_TYPES respect the matching
 *     boolean field. Missing row = default (all true).
 *   - Any unlisted custom type (e.g. legacy 'review_reply') defaults to
 *     delivered (backwards compatible).
 */
export async function shouldNotify(
  userId: number,
  type: NotificationTypeValue | string,
): Promise<boolean> {
  if (type === NotificationType.ADMIN_MESSAGE) return true
  if (!PREFERENCE_CONTROLLED_TYPES.includes(type as NotificationTypeValue)) {
    return true
  }
  let pref
  try {
    pref = await prisma.notificationPreference.findUnique({ where: { userId } })
  } catch (error) {
    console.error('failed to read notification preference:', error)
    return true
  }
  if (!pref) return true
  switch (type) {
    case NotificationType.POST_COMMENT: return pref.postComment
    case NotificationType.COMMENT_REPLY: return pref.commentReply
    case NotificationType.MENTION: return pref.mention
    case NotificationType.ORDER_STATUS: return pref.orderStatus
    default: return true
  }
}

/**
 * Companion helper: should this type also trigger an email?
 */
export async function shouldEmail(
  userId: number,
  type: NotificationTypeValue | string,
): Promise<boolean> {
  // Defaults when the row is absent. Keep in sync with schema defaults.
  const defaults: Record<string, boolean> = {
    [NotificationType.POST_COMMENT]: false,
    [NotificationType.COMMENT_REPLY]: false,
    [NotificationType.MENTION]: false,
    [NotificationType.ADMIN_MESSAGE]: true,
    [NotificationType.ORDER_STATUS]: true,
  }
  let pref
  try {
    pref = await prisma.notificationPreference.findUnique({ where: { userId } })
  } catch (error) {
    console.error('failed to read notification preference:', error)
    return defaults[type] ?? false
  }
  if (!pref) return defaults[type] ?? false
  switch (type) {
    case NotificationType.POST_COMMENT: return pref.emailPostComment
    case NotificationType.COMMENT_REPLY: return pref.emailCommentReply
    case NotificationType.MENTION: return pref.emailMention
    case NotificationType.ADMIN_MESSAGE: return pref.emailAdminMessage
    case NotificationType.ORDER_STATUS: return pref.emailOrderStatus
    default: return defaults[type] ?? false
  }
}

/**
 * Create a notification record. Silently returns null when the user has
 * disabled this type via their NotificationPreference.
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    if (!(await shouldNotify(params.userId, params.type))) return null
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
      },
    })
  } catch (error) {
    console.error('failed to create notification:', error)
    return null
  }
}

/**
 * Create an order-status-change notification (also sends an email).
 */
export async function createOrderStatusNotification(
  userId: number,
  orderNo: string,
  oldStatus: string,
  newStatus: string,
  trackingNumber?: string
) {
  const statusLabels: Record<string, string> = {
    pending: '결제 대기',
    paid: '결제 완료',
    preparing: '배송 준비중',
    shipping: '배송중',
    delivered: '배송 완료',
    cancelled: '주문 취소',
    cancel_requested: '취소 요청',
    refund_requested: '환불 요청',
    refunded: '환불 완료',
  }

  const statusMessages: Record<string, string> = {
    paid: '결제가 완료되었습니다.',
    preparing: '상품을 준비하고 있습니다.',
    shipping: '상품이 발송되었습니다. 배송을 시작합니다.',
    delivered: '상품이 배송 완료되었습니다.',
    cancelled: '주문이 취소되었습니다.',
    refunded: '환불이 완료되었습니다.',
  }

  const title = `주문 상태 변경: ${statusLabels[newStatus] || newStatus}`
  const message = statusMessages[newStatus] || `주문 상태가 "${statusLabels[newStatus] || newStatus}"(으)로 변경되었습니다.`

  // Send email (fire-and-forget)
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, nickname: true }
    })
    if (user?.email && await shouldEmail(userId, NotificationType.ORDER_STATUS)) {
      sendOrderStatusEmail(user.email, user.nickname || '고객', orderNo, newStatus, trackingNumber)
    }
  } catch (error) {
    console.error('failed to send order status email:', error)
  }

  return createNotification({
    userId,
    type: 'order_status',
    title,
    message: `[주문번호: ${orderNo}] ${message}`,
    link: `/shop/orders/${orderNo}`,
  })
}

/**
 * Notify the customer that an order has been completed (also sends email).
 */
export async function createOrderCompletedNotification(
  userId: number,
  orderNo: string,
  totalAmount: number,
  items?: { name: string; quantity: number; price: number }[]
) {
  // Send email (fire-and-forget)
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, nickname: true, name: true }
    })
    if (user?.email && items && await shouldEmail(userId, NotificationType.ORDER_STATUS)) {
      sendOrderCompletedEmail(
        user.email,
        user.name || user.nickname || '고객',
        orderNo,
        totalAmount,
        items
      )
    }
  } catch (error) {
    console.error('failed to send order completion email:', error)
  }

  return createNotification({
    userId,
    type: 'order_status',
    title: '🛒 주문이 완료되었습니다',
    message: `[주문번호: ${orderNo}] ${totalAmount.toLocaleString()}원 주문이 접수되었습니다.`,
    link: `/shop/orders/${orderNo}`,
  })
}

/**
 * Notify admins / sub-admins about a new order.
 */
export async function createNewOrderNotificationForAdmins(
  orderId: number,
  orderNo: string,
  totalAmount: number,
  customerName: string
) {
  try {
    // Look up notification recipients from shop settings
    const shopSetting = await prisma.shopSetting.findUnique({
      where: { key: 'order_notification_target' }
    })

    const notificationTarget = shopSetting?.value || 'admin'

    // Stop early when notifications are disabled
    if (notificationTarget === 'none') {
      return []
    }

    // Decide which role(s) to notify
    let targetRoles: string[] = []
    switch (notificationTarget) {
      case 'admin':
        targetRoles = ['admin']
        break
      case 'manager':
        targetRoles = ['manager']
        break
      case 'both':
        targetRoles = ['admin', 'manager']
        break
    }

    // Fetch target admins
    const admins = await prisma.user.findMany({
      where: {
        role: { in: targetRoles }
      },
      select: { id: true, email: true }
    })

    // Create a notification and send email for each admin
    const notifications = await Promise.all(
      admins.map(async admin => {
        // Send email (async)
        if (admin.email) {
          sendNewOrderEmailToAdmin(admin.email, orderNo, customerName, totalAmount)
        }

        return createNotification({
          userId: admin.id,
          type: 'order_status',
          title: '🛒 새 주문이 접수되었습니다',
          message: `[주문번호: ${orderNo}] ${customerName}님이 ${totalAmount.toLocaleString()}원 주문을 접수했습니다.`,
          link: `/admin/shop/orders/${orderNo}`,
        })
      })
    )

    return notifications.filter(n => n !== null)
  } catch (error) {
    console.error('failed to create admin order notification:', error)
    return []
  }
}

/**
 * Notify the customer that an order has been cancelled (also sends email).
 */
export async function createOrderCancelledNotification(
  userId: number,
  orderNo: string,
  refundAmount: number,
  cancelReason?: string
) {
  // Send email (fire-and-forget)
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, nickname: true, name: true }
    })
    if (user?.email && cancelReason && await shouldEmail(userId, NotificationType.ORDER_STATUS)) {
      sendOrderCancelledEmail(
        user.email,
        user.name || user.nickname || '고객',
        orderNo,
        refundAmount,
        cancelReason
      )
    }
  } catch (error) {
    console.error('failed to send order cancellation email:', error)
  }

  return createNotification({
    userId,
    type: 'order_status',
    title: '❌ 주문이 취소되었습니다',
    message: `[주문번호: ${orderNo}] 주문이 취소되고 ${refundAmount.toLocaleString()}원이 환불 처리됩니다.`,
    link: `/shop/orders/${orderNo}`,
  })
}

/**
 * Notify the customer of an admin-initiated order cancellation (with reason).
 */
export async function createOrderCancelledByAdminNotification(
  userId: number,
  orderNo: string,
  refundAmount: number,
  cancelReason: string
) {
  return createNotification({
    userId,
    type: 'order_status',
    title: '❌ 주문이 취소되었습니다',
    message: `[주문번호: ${orderNo}] 관리자에 의해 주문이 취소되었습니다.\n\n취소 사유: ${cancelReason}\n\n${refundAmount.toLocaleString()}원이 환불 처리됩니다.`,
    link: `/shop/orders/${orderNo}`,
  })
}

/**
 * Notify admins that an order cancellation is complete (also sends email).
 */
export async function createOrderCancelledNotificationForAdmins(
  orderNo: string,
  customerName: string,
  refundAmount: number,
  cancelReason?: string
) {
  try {
    // Look up notification recipients from shop settings
    const shopSetting = await prisma.shopSetting.findUnique({
      where: { key: 'order_notification_target' }
    })

    const notificationTarget = shopSetting?.value || 'admin'

    // Stop early when notifications are disabled
    if (notificationTarget === 'none') {
      return []
    }

    // Decide which role(s) to notify
    let targetRoles: string[] = []
    switch (notificationTarget) {
      case 'admin':
        targetRoles = ['admin']
        break
      case 'manager':
        targetRoles = ['manager']
        break
      case 'both':
        targetRoles = ['admin', 'manager']
        break
    }

    // Fetch target admins
    const admins = await prisma.user.findMany({
      where: {
        role: { in: targetRoles }
      },
      select: { id: true, email: true }
    })

    // Create a notification and send email for each admin
    const notifications = await Promise.all(
      admins.map(async admin => {
        // Send email (async)
        if (admin.email && cancelReason) {
          sendOrderCancelledEmailToAdmin(admin.email, orderNo, customerName, refundAmount, cancelReason)
        }

        return createNotification({
          userId: admin.id,
          type: 'order_status',
          title: '❌ 주문이 취소되었습니다',
          message: `[주문번호: ${orderNo}] ${customerName}님의 주문이 취소되었습니다. 환불금액: ${refundAmount.toLocaleString()}원`,
          link: `/admin/shop/orders/${orderNo}`,
        })
      })
    )

    return notifications.filter(n => n !== null)
  } catch (error) {
    console.error('failed to create admin order cancellation notification:', error)
    return []
  }
}

/**
 * Notify admins of a cancellation / refund request.
 */
export async function createCancelRequestNotificationForAdmins(
  orderNo: string,
  customerName: string,
  requestType: 'cancel' | 'refund'
) {
  try {
    // Look up notification recipients from shop settings
    const shopSetting = await prisma.shopSetting.findUnique({
      where: { key: 'order_notification_target' }
    })

    const notificationTarget = shopSetting?.value || 'admin'

    // Stop early when notifications are disabled
    if (notificationTarget === 'none') {
      return []
    }

    // Decide which role(s) to notify
    let targetRoles: string[] = []
    switch (notificationTarget) {
      case 'admin':
        targetRoles = ['admin']
        break
      case 'manager':
        targetRoles = ['manager']
        break
      case 'both':
        targetRoles = ['admin', 'manager']
        break
    }

    // Fetch target admins
    const admins = await prisma.user.findMany({
      where: {
        role: { in: targetRoles }
      },
      select: { id: true }
    })

    const title = requestType === 'cancel'
      ? '⚠️ 주문 취소 요청이 접수되었습니다'
      : '⚠️ 환불 요청이 접수되었습니다'

    const message = requestType === 'cancel'
      ? `[주문번호: ${orderNo}] ${customerName}님이 주문 취소를 요청했습니다. 확인이 필요합니다.`
      : `[주문번호: ${orderNo}] ${customerName}님이 환불을 요청했습니다. 확인이 필요합니다.`

    // Create a notification for each admin
    const notifications = await Promise.all(
      admins.map(admin =>
        createNotification({
          userId: admin.id,
          type: 'order_status',
          title,
          message,
          link: `/admin/shop/orders/${orderNo}`,
        })
      )
    )

    return notifications.filter(n => n !== null)
  } catch (error) {
    console.error('failed to create admin cancel/refund request notification:', error)
    return []
  }
}

interface PostCommentParams {
  userId: number               // recipient (post author)
  fromUserName: string         // commenter nickname (for display)
  postTitle: string
  postLink: string             // e.g. "/boards/free/123"
  excerpt?: string             // short snippet of the comment body
}

export async function createPostCommentNotification(params: PostCommentParams) {
  return createNotification({
    userId: params.userId,
    type: NotificationType.POST_COMMENT,
    title: `💬 ${params.fromUserName}님이 댓글을 남겼습니다`,
    message: `"${params.postTitle}" — ${params.excerpt ?? ''}`.trim(),
    link: params.postLink,
  })
}

interface CommentReplyParams {
  userId: number               // recipient (parent-comment author)
  fromUserName: string
  postTitle: string
  postLink: string
  excerpt?: string
}

export async function createCommentReplyNotification(params: CommentReplyParams) {
  return createNotification({
    userId: params.userId,
    type: NotificationType.COMMENT_REPLY,
    title: `↩️ ${params.fromUserName}님이 답글을 남겼습니다`,
    message: `"${params.postTitle}" — ${params.excerpt ?? ''}`.trim(),
    link: params.postLink,
  })
}

interface MentionParams {
  userId: number               // recipient (mentioned user)
  fromUserName: string
  postTitle: string
  postLink: string
  excerpt?: string
}

export async function createMentionNotification(params: MentionParams) {
  return createNotification({
    userId: params.userId,
    type: NotificationType.MENTION,
    title: `@ ${params.fromUserName}님이 회원님을 언급했습니다`,
    message: `"${params.postTitle}" — ${params.excerpt ?? ''}`.trim(),
    link: params.postLink,
  })
}

interface AdminMessageParams {
  userId: number
  title: string
  message: string
  link?: string
}

/**
 * Admin free-form notification. Bypasses in-app preferences (see
 * shouldNotify). Caller is responsible for sending the email separately
 * after consulting shouldEmail + user's email.
 */
export async function createAdminMessageNotification(params: AdminMessageParams) {
  try {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: NotificationType.ADMIN_MESSAGE,
        title: params.title,
        message: params.message,
        link: params.link || null,
      },
    })
  } catch (error) {
    console.error('failed to create admin notification:', error)
    return null
  }
}
