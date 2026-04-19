import { prisma } from '@/lib/prisma'
import { shouldEmail } from '@/lib/notification'
import { NotificationType } from '@/lib/notification-types'
import { sendDirectMessageEmail } from '@/lib/email'

const MAX_CONTENT = 2000

// Orient two user ids so user1 < user2. Required by the
// @@unique([user1Id, user2Id]) invariant on the Conversation table.
function orient(userA: number, userB: number): [number, number] {
  return userA < userB ? [userA, userB] : [userB, userA]
}

/** Whether the user is allowed to send a message right now. */
export async function canSendMessage(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, deletedAt: true },
  })
  if (!user) return false
  if (user.deletedAt) return false
  return user.status === 'active'
}

/** Look up or create the single Conversation row that pairs these two users. */
export async function findOrCreateConversation(userA: number, userB: number) {
  if (userA === userB) {
    throw new Error('cannot converse with self')
  }
  const [user1Id, user2Id] = orient(userA, userB)
  return prisma.conversation.upsert({
    where: { user1Id_user2Id: { user1Id, user2Id } },
    update: {},
    create: { user1Id, user2Id },
  })
}

interface SendArgs {
  fromUserId: number
  toUserId: number
  content: string
  /** Admin override: when true AND the sender is admin/manager, bypass
   *  the recipient's emailDirectMessage preference and force an email. */
  sendEmailOverride?: boolean
  /** Sender display name used in the notification title. */
  fromUserName: string
  /** Whether the sender has admin/manager role — validates sendEmailOverride. */
  senderIsAdmin: boolean
  /** Recipient's email, if any. */
  recipientEmail: string | null
}

/**
 * Create a message inside a find-or-created conversation.
 * Side effects:
 *  - Updates Conversation.lastMessageAt.
 *  - Clears the recipient's hiddenAt (auto-resurface rule).
 *  - Creates a direct_message notification row for the recipient.
 *  - Dispatches email when appropriate (admin override OR recipient pref).
 *
 * Caller is responsible for:
 *  - Validating session, content length, rate-limit, recipient existence.
 *  - Passing accurate senderIsAdmin and fromUserName.
 */
export async function sendMessageTo(args: SendArgs) {
  if (args.content.length < 1 || args.content.length > MAX_CONTENT) {
    throw new Error('content length out of range')
  }
  const conversation = await findOrCreateConversation(args.fromUserId, args.toUserId)
  const recipientIsUser1 = conversation.user1Id === args.toUserId

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: args.fromUserId,
      content: args.content,
    },
  })

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: message.createdAt,
      ...(recipientIsUser1 ? { user1HiddenAt: null } : { user2HiddenAt: null }),
    },
  })

  // In-app notification (mandatory; DIRECT_MESSAGE bypasses shouldNotify)
  await prisma.notification.create({
    data: {
      userId: args.toUserId,
      type: NotificationType.DIRECT_MESSAGE,
      title: `💬 ${args.fromUserName}님의 쪽지`,
      message: args.content.slice(0, 80),
      link: `/mypage/messages/${conversation.uuid}`,
    },
  })

  // Email (fire-and-forget)
  const adminForcingEmail = args.sendEmailOverride === true && args.senderIsAdmin
  if (args.recipientEmail) {
    const shouldSend = adminForcingEmail || (await shouldEmail(args.toUserId, NotificationType.DIRECT_MESSAGE))
    if (shouldSend) {
      sendDirectMessageEmail(args.recipientEmail, args.fromUserName, args.content, conversation.uuid)
    }
  }

  return { conversation, message }
}

/** Update the viewer's lastReadAt and mark related unread notifications read. */
export async function markConversationRead(conversationId: number, viewerId: number) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conv) return
  const isUser1 = conv.user1Id === viewerId
  if (!isUser1 && conv.user2Id !== viewerId) return // not a participant

  const link = `/mypage/messages/${conv.uuid}`
  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conversationId },
      data: isUser1 ? { user1LastReadAt: new Date() } : { user2LastReadAt: new Date() },
    }),
    prisma.notification.updateMany({
      where: {
        userId: viewerId,
        type: NotificationType.DIRECT_MESSAGE,
        link,
        isRead: false,
      },
      data: { isRead: true },
    }),
  ])
}

/** Toggle hide/unhide for the viewer side of a conversation. */
export async function setConversationHidden(conversationId: number, viewerId: number, hidden: boolean) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conv) throw new Error('conversation not found')
  const isUser1 = conv.user1Id === viewerId
  if (!isUser1 && conv.user2Id !== viewerId) throw new Error('not a participant')

  const stamp = hidden ? new Date() : null
  await prisma.conversation.update({
    where: { id: conversationId },
    data: isUser1 ? { user1HiddenAt: stamp } : { user2HiddenAt: stamp },
  })
}
