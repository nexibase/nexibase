import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 배송 라벨 HTML 생성
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: '잘못된 주문 ID입니다.' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: { name: true }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 사이트 설정 가져오기
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['siteName', 'senderName', 'senderPhone', 'senderZipCode', 'senderAddress', 'senderAddressDetail']
        }
      }
    })

    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value
      return acc
    }, {} as Record<string, string>)

    const siteName = settingsMap.siteName || 'NexiBase'
    const senderName = settingsMap.senderName || siteName
    const senderPhone = settingsMap.senderPhone || ''
    const senderZipCode = settingsMap.senderZipCode || ''
    const senderAddress = settingsMap.senderAddress || ''
    const senderAddressDetail = settingsMap.senderAddressDetail || ''

    // 상품 요약
    const itemSummary = order.items.length === 1
      ? order.items[0].productName
      : `${order.items[0].productName} 외 ${order.items.length - 1}건`

    const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0)

    // HTML 생성 (A6 사이즈 기준, 105mm x 148mm)
    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>배송 라벨 - ${order.orderNo}</title>
  <style>
    @page {
      size: 105mm 148mm;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 11px;
      line-height: 1.4;
      width: 105mm;
      height: 148mm;
      padding: 4mm;
    }
    .label {
      border: 2px solid #000;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: #000;
      color: #fff;
      padding: 3mm;
      text-align: center;
      font-size: 14px;
      font-weight: bold;
    }
    .section {
      padding: 3mm;
      border-bottom: 1px dashed #ccc;
    }
    .section:last-child {
      border-bottom: none;
      flex: 1;
    }
    .section-title {
      font-size: 9px;
      color: #666;
      margin-bottom: 2mm;
      font-weight: bold;
    }
    .recipient {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 2mm;
    }
    .phone {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 2mm;
    }
    .address {
      font-size: 12px;
      line-height: 1.5;
    }
    .zipcode {
      font-size: 10px;
      color: #666;
    }
    .sender-info {
      font-size: 10px;
      line-height: 1.5;
    }
    .sender-name {
      font-weight: bold;
    }
    .order-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .order-no {
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
    }
    .order-date {
      font-size: 9px;
      color: #666;
    }
    .product-info {
      font-size: 10px;
      margin-top: 2mm;
    }
    .memo {
      background: #f5f5f5;
      padding: 2mm;
      font-size: 10px;
      margin-top: 2mm;
      border-radius: 2mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
    }
    .print-btn {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 20px;
      background: #000;
      color: #fff;
      border: none;
      cursor: pointer;
      font-size: 14px;
      border-radius: 4px;
    }
    .print-btn:hover {
      background: #333;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">인쇄하기</button>

  <div class="label">
    <div class="header">배송표</div>

    <div class="section">
      <div class="section-title">받는 분</div>
      <div class="recipient">${order.recipientName}</div>
      <div class="phone">${formatPhone(order.recipientPhone)}</div>
      <div class="address">
        ${order.address}${order.addressDetail ? ' ' + order.addressDetail : ''}
      </div>
      <div class="zipcode">(${order.zipCode})</div>
    </div>

    <div class="section">
      <div class="section-title">보내는 분</div>
      <div class="sender-info">
        <span class="sender-name">${senderName}</span>
        ${senderPhone ? ` (${formatPhone(senderPhone)})` : ''}
        ${senderAddress ? `<br>${senderAddress}${senderAddressDetail ? ' ' + senderAddressDetail : ''}` : ''}
        ${senderZipCode ? `<br>(${senderZipCode})` : ''}
      </div>
    </div>

    <div class="section">
      <div class="order-info">
        <span class="order-no">${order.orderNo}</span>
        <span class="order-date">${formatDate(order.createdAt)}</span>
      </div>
      <div class="product-info">
        ${itemSummary} (${totalQuantity}개)
      </div>
      ${order.deliveryMemo ? `<div class="memo">📝 ${order.deliveryMemo}</div>` : ''}
    </div>
  </div>

  <script>
    // 자동 인쇄 대화상자 열기 (선택사항)
    // window.onload = () => window.print();
  </script>
</body>
</html>
`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('배송 라벨 생성 에러:', error)
    return NextResponse.json(
      { error: '배송 라벨 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 전화번호 포맷
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
  } else if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

// 날짜 포맷
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
