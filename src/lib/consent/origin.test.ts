import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCrossSiteWrite } from './origin'

/** 라우트가 넘기는 것과 같은 모양으로 헤더 + 요청 URL을 만든다. */
function req(headers: Record<string, string>, url: string) {
  return { headers: new Headers(headers), url: new URL(url) }
}

test('TLS를 끊는 프록시 뒤에서 온 같은 사이트 쓰기를 막지 않는다', () => {
  // 프로덕션 재현: Apache가 HTTPS를 받아 평문 HTTP로 앱에 넘기고
  // X-Forwarded-Proto는 붙이지 않는다. 앱이 보는 요청 URL은 http:// 인데
  // 브라우저가 보낸 Origin은 https:// 다.
  const { headers, url } = req(
    {
      'sec-fetch-site': 'same-origin',
      origin: 'https://nexibase.com',
      host: 'nexibase.com',
    },
    'http://nexibase.com/api/consent',
  )
  assert.equal(isCrossSiteWrite(headers, url), false)
})

test('프록시가 X-Forwarded-Proto를 붙여 주는 경우도 통과한다', () => {
  const { headers, url } = req(
    {
      'sec-fetch-site': 'same-origin',
      origin: 'https://nexibase.com',
      host: 'nexibase.com',
      'x-forwarded-proto': 'https',
    },
    'http://nexibase.com/api/consent',
  )
  assert.equal(isCrossSiteWrite(headers, url), false)
})

test('프록시가 내부 주소로 넘겨도 X-Forwarded-Host로 판정한다', () => {
  const { headers, url } = req(
    {
      origin: 'https://nexibase.com',
      'x-forwarded-host': 'nexibase.com',
      host: '127.0.0.1:9119',
    },
    'http://127.0.0.1:9119/api/consent',
  )
  assert.equal(isCrossSiteWrite(headers, url), false)
})

test('프록시 없는 로컬 개발은 그대로 통과한다', () => {
  const { headers, url } = req(
    {
      'sec-fetch-site': 'same-origin',
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    },
    'http://localhost:3000/api/consent',
  )
  assert.equal(isCrossSiteWrite(headers, url), false)
})

test('다른 호스트에서 온 쓰기는 막는다', () => {
  const { headers, url } = req(
    {
      origin: 'https://evil.example',
      host: 'nexibase.com',
    },
    'http://nexibase.com/api/consent',
  )
  assert.equal(isCrossSiteWrite(headers, url), true)
})

test('호스트가 같아 보여도 다른 포트면 막는다', () => {
  const { headers, url } = req(
    {
      origin: 'https://nexibase.com:8443',
      host: 'nexibase.com',
    },
    'http://nexibase.com/api/consent',
  )
  assert.equal(isCrossSiteWrite(headers, url), true)
})

test('Sec-Fetch-Site가 cross-site/same-site면 Origin과 무관하게 막는다', () => {
  for (const site of ['cross-site', 'same-site']) {
    const { headers, url } = req(
      {
        'sec-fetch-site': site,
        origin: 'https://nexibase.com',
        host: 'nexibase.com',
      },
      'http://nexibase.com/api/consent',
    )
    assert.equal(isCrossSiteWrite(headers, url), true, site)
  }
})

test('Origin이 없으면 브라우저가 아니므로 통과시킨다', () => {
  const { headers, url } = req({ host: 'nexibase.com' }, 'http://nexibase.com/api/consent')
  assert.equal(isCrossSiteWrite(headers, url), false)
})

test('파싱할 수 없는 Origin은 막는다', () => {
  for (const origin of ['null', 'not a url', '']) {
    const { headers, url } = req(
      { origin, host: 'nexibase.com' },
      'http://nexibase.com/api/consent',
    )
    assert.equal(isCrossSiteWrite(headers, url), origin === '' ? false : true, origin)
  }
})
