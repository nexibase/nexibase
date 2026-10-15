export const CHANNELS = ['email', 'sms', 'alimtalk'] as const
export type Channel = typeof CHANNELS[number]
export type DeliveryStatus = 'pending' | 'processing' | 'accepted' | 'delivered' | 'failed' | 'unknown' | 'skipped' | 'tested'
export const CORE_EVENTS = {
  post_comment: '게시글 댓글', comment_reply: '댓글 답글', mention: '멘션',
  direct_message: '쪽지', order_status: '주문 알림',
} as const
export const PREF_FIELDS = {
  post_comment: 'PostComment', comment_reply: 'CommentReply', mention: 'Mention',
  direct_message: 'DirectMessage', order_status: 'OrderStatus',
} as const
export type MobileMode = 'independent' | 'alimtalk_first'

export function normalizePhone(value: string) {
  return value.replace(/^\+82\s?0?/, '0').replace(/[^0-9]/g, '')
}
export function validPhone(value: string) { return /^0\d{8,10}$/.test(normalizePhone(value)) }
export function maskRecipient(value: string, channel: Channel) {
  if (!value) return '(없음)'
  if (channel === 'email') {
    const [name, domain] = value.split('@')
    return domain ? `${name.slice(0, 1)}***@${domain}` : '***'
  }
  const phone = normalizePhone(value)
  return phone.length > 7 ? `${phone.slice(0, 3)}-****-${phone.slice(-4)}` : '***'
}
export function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/#\{([^}]+)\}/g, (_, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) throw new Error(`템플릿 변수 누락: ${key}`)
    return variables[key]
  })
}
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
export function mobileChannels(mode: MobileMode, sms: boolean, alimtalk: boolean): Channel[] {
  return mode === 'alimtalk_first' && alimtalk ? ['alimtalk'] : [sms && 'sms', alimtalk && 'alimtalk'].filter(Boolean) as Channel[]
}
export function isNotificationDevelopment() {
  if (process.env.NOTIFICATION_ENVIRONMENT === 'development' || process.env.NODE_ENV === 'development') return true
  try {
    const host = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').hostname
    return host.startsWith('dev.') || ['localhost', '127.0.0.1'].includes(host)
  } catch { return false }
}
export function canUseLiveDelivery(config: { liveEnabled: boolean; testRecipients: string[] }, recipient: string, channel: Channel) {
  // Dev deployment sets this independently of NODE_ENV (optimized builds use production).
  if (!config.liveEnabled) return false
  if (!isNotificationDevelopment()) return true
  return config.testRecipients.some(r => channel === 'email'
    ? r.trim().toLowerCase() === recipient.toLowerCase()
    : !r.includes('@') && normalizePhone(r) === normalizePhone(recipient))
}
