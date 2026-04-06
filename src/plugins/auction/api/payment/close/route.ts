import { NextResponse } from 'next/server'

// 이니시스 결제창 닫기 처리
// 결제창에서 닫기 버튼을 누르면 이 URL이 호출됨
export async function GET() {
  // 이니시스 공식 close 스크립트 반환
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>결제 취소</title>
  <script language="javascript" type="text/javascript" src="https://stdpay.inicis.com/stdjs/INIStdPay_close.js" charset="UTF-8"></script>
</head>
<body>
</body>
</html>
`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  })
}
