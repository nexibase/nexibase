import type { NotificationSettings, Secrets } from './config'
import { aligoRequest, safeProviderReason } from './providers'

export type AligoConnectionCheck = { id: 'sms' | 'alimtalk'; status: 'ok' | 'warning' | 'error'; message: string }
function failure(label: string, result: Record<string, unknown>, secrets: Secrets) {
  const code = Number(result.result_code ?? result.code)
  const reason = safeProviderReason(result.message, secrets) || 'API 응답 형식을 확인할 수 없습니다.'
  return `${label}: ${reason}${Number.isFinite(code) ? ` (${code})` : ''} · 아이디·API 키·서버 IP 허용 설정을 확인하세요.`
}
function connectionFailure(error: unknown) {
  const detail = (error || {}) as { code?: string; cause?: { code?: string } }
  const code = detail.cause?.code || detail.code
  return code === 'ENOTFOUND' || code === 'EAI_AGAIN'
    ? '알리고 서버 주소를 찾을 수 없습니다. DNS 설정을 확인하세요.'
    : '알리고 서버 연결 또는 응답 확인에 실패했습니다. 네트워크·방화벽·서버 IP 허용 설정을 확인하세요.'
}
function count(value: unknown) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}
export async function checkAligoConnection(settings: NotificationSettings, secrets: Secrets, fetcher = fetch): Promise<AligoConnectionCheck[]> {
  async function sms(): Promise<AligoConnectionCheck> {
    try {
      const result = await aligoRequest('sms', 'remain', settings, secrets, {}, fetcher)
      if (Number(result.result_code) !== 1) return { id: 'sms', status: 'error', message: failure('문자 API 인증 실패', result, secrets) }
      const counts = [['SMS', result.SMS_CNT], ['LMS', result.LMS_CNT], ['MMS', result.MMS_CNT]]
        .map(([label, value]) => ({ label, value: count(value) })).filter(item => item.value !== null)
      return { id: 'sms', status: 'ok', message: `문자 API 인증 성공${counts.length ? ` · 발송 가능 ${counts.map(item => `${item.label} ${item.value}건`).join(', ')}` : ' · 잔여 건수는 응답에 포함되지 않았습니다.'}` }
    } catch (error) { return { id: 'sms', status: 'error', message: connectionFailure(error) } }
  }
  async function profile(): Promise<AligoConnectionCheck> {
    try {
      const result = await aligoRequest('alimtalk', 'akv10/profile/list', settings, secrets,
        secrets.senderKey ? { senderkey: secrets.senderKey } : {}, fetcher)
      if (result.code === undefined || result.code === null || result.code === '' || Number(result.code) !== 0) return { id: 'alimtalk', status: 'error', message: failure('카카오 API 인증 실패', result, secrets) }
      if (!Array.isArray(result.list)) return { id: 'alimtalk', status: 'error', message: '카카오 API 인증은 성공했지만 발신프로필 목록의 응답 형식을 확인할 수 없습니다.' }
      if (!secrets.senderKey) return { id: 'alimtalk', status: 'warning', message: '카카오 API 인증 성공 · Senderkey를 입력하고 저장하세요.' }
      const row = result.list.find(row => row.senderKey === secrets.senderKey)
      if (!row) return { id: 'alimtalk', status: 'error', message: '저장된 발신프로필 키가 이 알리고 계정에 등록되어 있지 않습니다.' }
      if (row.status !== 'A') return { id: 'alimtalk', status: 'error', message: '발신프로필이 정상 상태가 아닙니다. 알리고에서 차단·삭제 여부를 확인하세요.' }
      if (row.profileStat !== 'A') return { id: 'alimtalk', status: 'error', message: '카카오채널이 활성 상태가 아닙니다. 채널의 비활성·차단·삭제 여부를 확인하세요.' }
      if ([false, 'N', 'false', '0', 0].includes(row.alimUseYn as boolean | string | number)) return { id: 'alimtalk', status: 'warning', message: '발신프로필과 카카오채널은 정상이지만 알림톡 사용이 활성화되어 있지 않습니다. 알리고에서 확인하세요.' }
      return { id: 'alimtalk', status: 'ok', message: '카카오 API 인증 성공 · 발신프로필 정상 · 카카오채널 활성 상태를 확인했습니다.' }
    } catch (error) { return { id: 'alimtalk', status: 'error', message: connectionFailure(error) } }
  }
  return Promise.all([sms(), profile()])
}
