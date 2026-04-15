import { prisma } from '@/lib/prisma'
import { sendOrderStatusEmail, sendNewOrderEmailToAdmin, sendOrderCompletedEmail, sendOrderCancelledEmail, sendOrderCancelledEmailToAdmin } from '@/lib/email'

export type NotificationType = 'order_status' | 'review_reply' | 'qna_reply' | 'system'

interface CreateNotificationParams {
  userId: number
  type: NotificationType
  title: string
  message: string
  link?: string
}

/**
 * Create a notification record.
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
      }
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
    if (user?.email) {
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
    if (user?.email && items) {
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
    if (user?.email && cancelReason) {
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
