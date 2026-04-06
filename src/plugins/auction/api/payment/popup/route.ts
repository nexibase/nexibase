import { NextRequest, NextResponse } from 'next/server'

// 이니시스 팝업 URL (overlay 모드에서 결제창 표시용)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // request에서 호스트 정보를 가져와 baseUrl 생성
  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const baseUrl = process.env.NEXT_PUBLIC_URL || `${protocol}://${host}`

  // 결과 파라미터 확인
  const resultCode = searchParams.get('resultCode')
  const resultMsg = searchParams.get('resultMsg')
  const orderNo = searchParams.get('orderNumber') || searchParams.get('MOID')

  // 결제 결과에 따라 부모 창 리다이렉트
  let redirectUrl = ''

  if (resultCode === '0000' && orderNo) {
    redirectUrl = `${baseUrl}/auction?paid=true`
  } else if (resultCode) {
    redirectUrl = `${baseUrl}/auction?error=payment_failed&message=${encodeURIComponent(resultMsg || '결제에 실패했습니다.')}`
  }

  // 결과가 있으면 부모 창 리다이렉트
  if (redirectUrl) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>결제 처리중...</title>
  <script>
    try {
      if (window.parent && window.parent !== window) {
        window.parent.location.href = '${redirectUrl}';
      } else if (window.opener) {
        window.opener.location.href = '${redirectUrl}';
        window.close();
      } else {
        window.location.href = '${redirectUrl}';
      }
    } catch (e) {
      window.location.href = '${redirectUrl}';
    }
  </script>
</head>
<body>
  <p>결제 처리중입니다...</p>
</body>
</html>
`
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  // 결과가 없으면 이니시스 popup 스크립트 로드 (overlay 모드에서 결제창 표시용)
  // 테스트/운영 환경 구분
  const isTest = process.env.PG_TEST_MODE !== 'false'
  const popupScriptUrl = isTest
    ? 'https://stgstdpay.inicis.com/stdjs/INIStdPay_popup.js'
    : 'https://stdpay.inicis.com/stdjs/INIStdPay_popup.js'

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { background-color: transparent; margin: 0; padding: 0; overflow: hidden; }
    </style>
</head>
<body style="background-color: transparent;">
    <script language="javascript" type="text/javascript" src="${popupScriptUrl}" charset="UTF-8"></script>
</body>
</html>
`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

export async function POST(request: NextRequest) {
  // POST 요청도 GET과 동일하게 처리
  return GET(request)
}
