import { escapeHtml } from './policy'

export function smtpTestTemplate(site: { name: string; url: string; development: boolean }, requestedAt = new Date()) {
  const name = site.name.replace(/[\r\n]+/g, ' ').trim().slice(0, 100) || 'NexiBase'
  let url = ''
  try {
    const parsed = new URL(site.url)
    if (['http:', 'https:'].includes(parsed.protocol)) url = parsed.origin
  } catch { /* Missing site addresses are identified explicitly in the message. */ }
  const environment = site.development ? '개발(dev)' : '운영'
  const timestamp = `${requestedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)`
  const details = [['보낸 사이트', name], ['사이트 주소', url || '미설정'], ['환경', environment], ['요청 시각', timestamp]]
  const introduction = '사이트 관리자가 SMTP 설정을 확인하기 위해 보낸 테스트 메일입니다.'
  const conclusion = '이 메일을 받았다면 테스트 메일이 정상 도착한 것입니다.'
  return {
    subject: `[${name}] ${site.development ? '[dev] ' : ''}SMTP 테스트 메일`,
    text: `${introduction}\n\n${details.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${conclusion}`,
    html: `<h2>${escapeHtml(name)} · SMTP 테스트 메일</h2><p>${introduction}</p><table>${details.map(([label, value]) => `<tr><th align="left" style="padding:6px 16px 6px 0">${label}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table><p>${conclusion}</p>${url ? `<p><a href="${escapeHtml(url)}">사이트 방문하기</a></p>` : ''}`,
  }
}
