import test from 'node:test'
import assert from 'node:assert/strict'
import { sendViaProvider, parseFinalResult, networkFailure, safeProviderReason, smtpFailure } from './providers'
import { DEFAULT_SETTINGS } from './config'

const settings = { ...DEFAULT_SETTINGS, aligoUserId: 'test-user', sender: '0212345678' }
const secrets = { aligoKey: 'key-private', senderKey: 'profile-private' }
const payload = { to: '01000000000', subject: '제목', text: '본문', templateCode: 'TPL_TEST' }

test('SMTP failures explain authentication, DNS, TLS and uncertain outcomes without revealing raw errors', () => {
  const auth = smtpFailure({ code: 'EAUTH', responseCode: 535, message: 'private-password member@example.invalid' })
  assert.equal(auth.status, 'failed'); assert.equal(auth.code, 'EAUTH/535')
  assert.ok(auth.reason?.includes('앱 비밀번호'))
  assert.ok(!auth.reason?.includes('private-password') && !auth.reason?.includes('example.invalid'))
  assert.equal(smtpFailure({ code: 'ENOTFOUND' }).status, 'retry')
  assert.ok(smtpFailure({ code: 'ENOTFOUND' }).reason?.includes('DNS'))
  assert.ok(smtpFailure({ code: 'ETLS' }, false).reason?.includes('포트·TLS'))
  assert.ok(!smtpFailure({ code: 'ETLS' }, false).reason?.includes('자동 재발송'))
  assert.equal(smtpFailure({ code: 'ETIMEDOUT' }).status, 'unknown')
  assert.ok(smtpFailure({ code: 'ETIMEDOUT' }).reason?.includes('자동 재발송하지 않습니다'))
})
test('SMS uses SMS credentials and the documented non-billing test flag', async () => {
  let called = false
  const fetcher: typeof fetch = async (input, init) => {
    called = true; assert.equal(String(input), 'https://apis.aligo.in/send/')
    const body = init!.body as URLSearchParams
    assert.equal(body.get('key'), secrets.aligoKey); assert.equal(body.get('user_id'), settings.aligoUserId)
    assert.equal(body.get('testmode_yn'), 'Y'); assert.equal(body.has('msg_type'), false)
    return Response.json({ result_code: 1, msg_id: 101, success_cnt: 1, error_cnt: 0 })
  }
  assert.equal((await sendViaProvider('sms', payload, settings, secrets, false, fetcher)).status, 'tested')
  assert.ok(called)
})
test('Alimtalk uses its own credentials, testMode and disables provider-side fallback', async () => {
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(String(input), 'https://kakaoapi.aligo.in/akv10/alimtalk/send/')
    const body = init!.body as URLSearchParams
    assert.equal(body.get('apikey'), secrets.aligoKey); assert.equal(body.get('userid'), settings.aligoUserId)
    assert.equal(body.get('testMode'), 'Y'); assert.equal(body.get('failover'), 'N')
    assert.equal(body.get('tpl_code'), 'TPL_TEST')
    return Response.json({ code: 0, info: { mid: 202, scnt: 1, fcnt: 0 } })
  }
  assert.equal((await sendViaProvider('alimtalk', payload, settings, secrets, false, fetcher)).status, 'tested')
})
test('API acceptance is not delivery; timeouts/malformed responses never cause automatic retry', async () => {
  assert.equal((await sendViaProvider('sms', payload, settings, secrets, true, async () => Response.json({ result_code: 1, msg_id: 3 }))).status, 'accepted')
  assert.equal((await sendViaProvider('alimtalk', payload, settings, secrets, true, async () => Response.json({ code: -99, message: '잔액 부족' }))).status, 'failed')
  assert.equal((await sendViaProvider('sms', payload, settings, secrets, true, async () => { throw new DOMException('timeout', 'TimeoutError') })).status, 'unknown')
  assert.equal((await sendViaProvider('sms', payload, settings, secrets, true, async () => new Response('not json'))).status, 'unknown')
  assert.equal(networkFailure({ cause: { code: 'ECONNREFUSED' } }).status, 'retry')
  assert.equal(networkFailure({ code: 'ETIMEDOUT' }).status, 'unknown')
  assert.equal((await sendViaProvider('sms', payload, settings, secrets, true, async () => Response.json({ result_code: 1, success_cnt: 0, error_cnt: 1 }))).status, 'failed')
  assert.equal((await sendViaProvider('alimtalk', payload, settings, secrets, true, async () => Response.json({ code: 0, info: { mid: 3, scnt: 0, fcnt: 1 } }))).status, 'failed')
  const masked = safeProviderReason('010-1234-5678 01012345678 +82 10-1234-5678 member@example.invalid key-private', secrets)
  assert.ok(!masked.includes('1234') && !masked.includes('example.invalid') && !masked.includes('key-private'))
})
test('final results are matched to the recipient and not inferred from Kakao number status=3', () => {
  assert.equal(parseFinalResult('alimtalk', [{ phone: payload.to, msgid: 'Q123', status: 3 }], payload.to), null)
  assert.equal(parseFinalResult('alimtalk', [{ phone: payload.to, msgid: '123', status: 3, rslt: 'U', rsltdate: '2026-10-15', rslt_message: '메시지가 템플릿과 일치하지않음' }], payload.to)?.status, 'failed')
  assert.equal(parseFinalResult('sms', [{ receiver: payload.to, sms_state: '발송완료' }], payload.to)?.status, 'delivered')
  assert.equal(parseFinalResult('sms', [{ receiver: '01099999999', sms_state: '발송완료' }], payload.to), null)
  assert.equal(parseFinalResult('alimtalk', [{ phone: payload.to, msgid: '123', rslt: 'provider-code', rsltdate: '2026-10-15', rslt_message: '정상' }], payload.to)?.status, 'delivered')
  assert.equal(parseFinalResult('alimtalk', [{ phone: payload.to, msgid: '123', rslt: 'U', rsltdate: '2026-10-15', rslt_message: '미가입 사용자' }], payload.to)?.status, 'failed')
  assert.equal(parseFinalResult('alimtalk', [{ phone: payload.to, msgid: '123', rslt: 'U', rsltdate: '2026-10-15', rslt_message: '템플릿 불일치', smid: 1234 }], payload.to)?.status, 'unknown')
})
