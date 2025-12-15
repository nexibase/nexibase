import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 다중 배송 라벨 HTML 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { orderIds } = body as { orderIds: number[] }

    if (!orderIds || orderIds.length === 0) {
      return NextResponse.json(
        { error: '출력할 주문을 선택해주세요.' },
        { status: 400 }
      )
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        items: {
          include: {
            product: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (orders.length === 0) {
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

    // 라벨 HTML 생성
    const labelsHtml = orders.map(order => {
      const itemSummary = order.items.length === 1
        ? order.items[0].productName
        : `${order.items[0].productName} 외 ${order.items.length - 1}건`
      const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0)

      return `
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
`
    }).join('\n')

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>배송 라벨 (${orders.length}건)</title>
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
    }
    .label {
      width: 105mm;
      height: 148mm;
      padding: 4mm;
      page-break-after: always;
      border: 2px solid #000;
      display: flex;
      flex-direction: column;
    }
    .label:last-child {
      page-break-after: auto;
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
    .controls {
      position: fixed;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 10px;
      z-index: 1000;
    }
    .btn {
      padding: 10px 20px;
      background: #000;
      color: #fff;
      border: none;
      cursor: pointer;
      font-size: 14px;
      border-radius: 4px;
    }
    .btn:hover {
      background: #333;
    }
    .info {
      position: fixed;
      top: 10px;
      left: 10px;
      background: #f5f5f5;
      padding: 10px 15px;
      border-radius: 4px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="controls no-print">
    <button class="btn" onclick="window.print()">인쇄하기</button>
    <button class="btn" onclick="window.close()">닫기</button>
  </div>
  <div class="info no-print">총 ${orders.length}건의 배송 라벨</div>

  ${labelsHtml}

</body>
</html>
`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('다중 배송 라벨 생성 에러:', error)
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
