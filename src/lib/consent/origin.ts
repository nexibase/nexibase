/**
 * 이 요청을 같은 사이트에서 온 것으로 볼 수 없는지 판정한다.
 *
 * `/api/consent`가 만드는 것은 "이 사람이 이렇게 결정했다"는 증빙 레코드다.
 * 제3자 페이지가 방문자의 브라우저를 시켜 쓸 수 있으면, 본인이 한 적 없는
 * 결정이 증빙 테이블에 남는다 — 동의의 유효성을 입증하려고 만든 테이블이
 * 무효한 동의로 채워진다.
 *
 * `Origin`이 없으면 통과시킨다. 브라우저는 cross-site POST에 반드시 이 헤더를
 * 붙이므로, 없는 경우는 브라우저가 아닌 클라이언트(운영자 스크립트, curl 등)다.
 * `Sec-Fetch-Site`는 `Origin`을 보강한다 — 값을 보내는 브라우저라면
 * cross-site/same-site를 여기서 걸러낸다.
 *
 * 기대 호스트는 요청에서 끌어낸다. 자체 호스팅 소프트웨어라 운영자가 고른
 * 도메인이 무엇인지 코드가 알 수 없기 때문에 하드코딩하지 않는다.
 *
 * 비교 대상은 **호스트(+포트)이지 스킴이 아니다.** TLS를 끊는 리버스 프록시
 * 뒤에서는 앱이 평문 HTTP 요청을 받으므로, 프록시가 `X-Forwarded-Proto`를
 * 붙여 주지 않으면 앱이 계산한 스킴(`http`)과 브라우저가 보낸 `Origin`의
 * 스킴(`https`)이 어긋난다 — 정상적인 같은 사이트 쓰기가 전부 막힌다.
 * 스킴을 빼도 CSRF 방어는 유지된다: 막아야 할 대상은 다른 호스트에서 온
 * 쓰기이고, 공격자는 운영자 호스트가 내려 주는 문서를 만들 수 없다.
 * (같은 호스트의 평문 HTTP를 가로챌 수 있는 공격자라면 이미 연결 전체를
 * 장악한 상태라 이 검사로 막을 수 있는 범위 밖이다.)
 */
export function isCrossSiteWrite(headers: Headers, requestUrl: URL): boolean {
  const fetchSite = headers.get('sec-fetch-site')?.trim().toLowerCase()
  if (fetchSite === 'cross-site' || fetchSite === 'same-site') return true

  const origin = headers.get('origin')
  if (!origin) return false

  // 파싱되지 않는 Origin은 신뢰하지 않는다. 샌드박스 iframe 등이 보내는
  // 불투명 출처(`null`)도 여기서 걸린다.
  let originHost: string
  try {
    originHost = new URL(origin.trim()).host.toLowerCase()
  } catch {
    return true
  }
  if (!originHost) return true

  const expected = new Set<string>()
  expected.add(requestUrl.host.toLowerCase())

  // 리버스 프록시 뒤에서는 요청 URL이 내부 주소(127.0.0.1:9119 등)를 가리킬 수
  // 있어 브라우저가 본 호스트와 어긋난다. 프록시가 전달한 호스트도 인정한다.
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  const forwarded = host?.split(',')[0]?.trim().toLowerCase()
  if (forwarded) expected.add(forwarded)

  return !expected.has(originHost)
}
