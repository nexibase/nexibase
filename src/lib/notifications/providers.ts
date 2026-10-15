import nodemailer from 'nodemailer'
import type { NotificationSettings, Secrets } from './config'
import { normalizePhone, type Channel } from './policy'

export interface DeliveryPayload {
  to: string; subject: string; text: string; html?: string
  templateCode?: string; buttons?: unknown; test?: boolean; smtpTest?: boolean
}
export interface ProviderResult {
  status: 'accepted' | 'delivered' | 'failed' | 'unknown' | 'tested' | 'retry'
  providerId?: string; code?: string; reason?: string
}
type ApiResult = Record<string, unknown> & { list?: Record<string, unknown>[]; info?: Record<string, unknown> }
export async function aligoRequest(channel: 'sms' | 'alimtalk', endpoint: string,
  config: NotificationSettings, secrets: Secrets, params: Record<string, string>, fetcher = fetch): Promise<ApiResult> {
  const auth: Record<string, string> = channel === 'sms'
    ? { key: secrets.aligoKey || '', user_id: config.aligoUserId }
    : { apikey: secrets.aligoKey || '', userid: config.aligoUserId }
  const response = await fetcher(`https://${channel === 'sms' ? 'apis' : 'kakaoapi'}.aligo.in/${endpoint}/`, {
    method: 'POST', body: new URLSearchParams({ ...auth, ...params }),
    signal: AbortSignal.timeout(15000), redirect: 'error',
  })
  // A proxy error or malformed response does not prove that a paid send was rejected.
  if (!response.ok) throw new Error('ALIGO_RESPONSE_UNCERTAIN')
  return await response.json() as ApiResult
}
export function safeProviderReason(value: unknown, secrets: Secrets = {}) {
  let reason = String(value || '').slice(0, 1000)
  for (const secret of Object.values(secrets)) if (secret) reason = reason.split(secret).join('[비공개]')
  return reason.replace(/(?:\+82[-\s]?0?|0)\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g, '[연락처]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[이메일]').slice(0, 500)
}
export function networkFailure(error: unknown): ProviderResult {
  const err = error as { code?: string; responseCode?: number; cause?: { code?: string } }
  const code = err.cause?.code || err.code || 'NETWORK_UNCERTAIN'
  if (['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code) || (err.responseCode && err.responseCode >= 400 && err.responseCode < 500)) {
    return { status: 'retry', code, reason: '서버가 접수하지 못했습니다. 제한 횟수 내 재시도합니다.' }
  }
  if (err.responseCode && err.responseCode >= 500) return { status: 'failed', code: String(err.responseCode), reason: 'SMTP 서버가 요청을 거부했습니다.' }
  return { status: 'unknown', code, reason: '접수 여부 불명확: 중복 방지를 위해 자동 재발송하지 않습니다.' }
}
export function smtpTransport(settings: NotificationSettings, secrets: Secrets) {
  return nodemailer.createTransport({ host: settings.smtpHost, port: settings.smtpPort, secure: settings.smtpSecure,
    ...(settings.smtpUser ? { auth: { user: settings.smtpUser, pass: secrets.smtpPass } } : {}),
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, logger: false, debug: false })
}
export function smtpFailure(error: unknown, mayHaveSent = true): ProviderResult {
  const result = networkFailure(error)
  const err = error as { code?: string; responseCode?: number }
  const code = err.code || result.code
  const reason = code === 'EAUTH' ? 'SMTP 인증 실패: 계정과 비밀번호를 확인하세요. Gmail 등에서 2단계 인증을 사용하면 앱 비밀번호가 필요합니다.'
    : code === 'ENOTFOUND' || code === 'EAI_AGAIN' ? 'SMTP 호스트를 찾을 수 없습니다. 서버 주소와 DNS 설정을 확인하세요.'
    : code === 'ECONNREFUSED' ? 'SMTP 연결 거부: 포트 번호와 서버 방화벽을 확인하세요.'
    : code === 'ETIMEDOUT' ? 'SMTP 응답 시간 초과: 서버 주소·포트와 방화벽을 확인하세요.'
    : ['ETLS', 'EPROTO', 'ESOCKET', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(code || '') ? 'SMTP 보안 연결 실패: 포트·TLS 설정과 서버 인증서를 확인하세요. 465는 연결 시 TLS를 켜고, 587은 끄세요.'
    : err.responseCode && err.responseCode >= 500 ? 'SMTP 서버가 발송을 거부했습니다. 발신 주소·수신 주소와 메일 계정의 발송 제한을 확인하세요.'
    : result.reason
  return { ...result, code: [code, err.responseCode].filter(Boolean).join('/'), reason: `${reason}${mayHaveSent && result.status === 'unknown' ? ' 접수 여부가 불명확하여 자동 재발송하지 않습니다.' : ''}` }
}
export async function sendViaProvider(channel: Channel, payload: DeliveryPayload, settings: NotificationSettings,
  secrets: Secrets, live: boolean, fetcher = fetch): Promise<ProviderResult> {
  if (channel === 'email') {
    if (!live) return { status: 'tested', reason: 'SMTP 모의 처리: 실제 메일을 보내지 않았습니다.' }
    try {
      const result = await smtpTransport(settings, secrets).sendMail({ from: settings.smtpFrom, to: payload.to,
        subject: payload.subject, text: payload.text, html: payload.html })
      return result.accepted.length ? { status: 'accepted', providerId: result.messageId, reason: 'SMTP 서버 접수 완료. 수신함 도착 여부는 확인되지 않습니다.' }
        : { status: 'failed', reason: 'SMTP 서버가 수신자를 거부했습니다.' }
    } catch (error) { return smtpFailure(error) }
  }
  try {
    const result = channel === 'sms'
      ? await aligoRequest('sms', 'send', settings, secrets, { sender: settings.sender, receiver: normalizePhone(payload.to),
        msg: payload.text, testmode_yn: live ? 'N' : 'Y' }, fetcher)
      : await aligoRequest('alimtalk', 'akv10/alimtalk/send', settings, secrets, {
        senderkey: secrets.senderKey || '', tpl_code: payload.templateCode || '', sender: settings.sender,
        receiver_1: normalizePhone(payload.to), subject_1: payload.subject, message_1: payload.text,
        ...(payload.buttons ? { button_1: JSON.stringify(payload.buttons) } : {}),
        failover: 'N', testMode: live ? 'N' : 'Y',
      }, fetcher)
    const code = Number(channel === 'sms' ? result.result_code : result.code)
    const accepted = channel === 'sms' ? code > 0 : code === 0
    if (!Number.isFinite(code)) return { status: 'unknown', reason: '알리고 응답 형식 불명확. 자동 재발송하지 않습니다.' }
    if (!accepted) return { status: 'failed', code: String(code), reason: safeProviderReason(result.message, secrets) }
    const successCount = channel === 'sms' ? result.success_cnt : result.info?.scnt
    const failureCount = channel === 'sms' ? result.error_cnt : result.info?.fcnt
    if (successCount !== undefined && Number(successCount) === 0 && Number(failureCount) > 0) return { status: 'failed', code: String(code), reason: '알리고가 수신자 발송 요청을 거부했습니다.' }
    const id = channel === 'sms' ? result.msg_id : result.info?.mid
    if (!live) return { status: 'tested', code: String(code), reason: '알리고 테스트 모드 접수. 실제 수신 성공 검증은 아닙니다.' }
    if (!id) return { status: 'unknown', code: String(code), reason: '접수 응답에 메시지 ID가 없어 결과를 확인할 수 없습니다.' }
    return { status: 'accepted', providerId: String(id), code: String(code), reason: '알리고 접수 완료. 최종 전달 결과 대기 중입니다.' }
  } catch (error) { return networkFailure(error) }
}
export function parseFinalResult(channel: 'sms' | 'alimtalk', rows: Record<string, unknown>[], recipient: string): ProviderResult | null {
  const row = rows.find(r => normalizePhone(String(channel === 'sms' ? r.receiver : r.phone)) === normalizePhone(recipient))
  if (!row) return null
  const message = String(channel === 'sms' ? row.sms_state || '' : row.rslt_message || '')
  if (channel === 'alimtalk' && (String(row.msgid).startsWith('Q') || !row.rsltdate || !row.rslt)) return null
  if (channel === 'alimtalk' && Number(row.smid) > 0) return { status: 'unknown', reason: '알리고 대체문자 처리 내역이 있어 앱의 문자 대체를 중지했습니다. 알리고 내역을 확인하세요.', code: String(row.rslt) }
  if (/^(발송완료|전송완료|수신완료|성공|정상|정상처리|정상 처리|전송성공|발송성공)$/.test(message.trim()) || /^정상적으로 전송되었/.test(message)) return { status: 'delivered', reason: message, code: String(row.rslt || '') }
  if (/실패|오류|거부|거절|불가|없음|일치하지|불일치|차단|만료|미가입|미사용|미설치|미등록|부족|초과|잘못|제한|취소/.test(message)) return { status: 'failed', reason: message, code: String(row.rslt || '') }
  if (channel === 'alimtalk') return { status: 'unknown', code: String(row.rslt), reason: `확인되지 않은 최종 결과: ${message || String(row.rslt)}. 자동 문자 대체를 중지했습니다.` }
  // Unknown provider codes remain pending; never treat status=3 as delivery success.
  return null
}
export async function queryDelivery(channel: 'sms' | 'alimtalk', providerId: string, recipient: string,
  settings: NotificationSettings, secrets: Secrets): Promise<ProviderResult | null> {
  const result = await aligoRequest(channel, channel === 'sms' ? 'sms_list' : 'akv10/history/detail', settings, secrets,
    { mid: providerId, page: '1', ...(channel === 'sms' ? { page_size: '50' } : { limit: '50' }) })
  if (Number(channel === 'sms' ? result.result_code : result.code) !== (channel === 'sms' ? 1 : 0)) return null
  const parsed = parseFinalResult(channel, result.list || [], recipient)
  return parsed ? { ...parsed, reason: safeProviderReason(parsed.reason, secrets) } : null
}
