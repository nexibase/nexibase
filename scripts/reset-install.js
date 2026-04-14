#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// 1. 프로덕션 가드
if (process.env.NODE_ENV === 'production') {
  console.error('❌ NODE_ENV=production 환경에서는 실행할 수 없습니다.')
  process.exit(1)
}

// 2. --confirm 플래그 필수
if (!process.argv.includes('--confirm')) {
  console.error('❌ 이 명령은 install 관련 데이터를 삭제합니다.')
  console.error('   실행하려면 --confirm 플래그를 붙이세요:')
  console.error('   npm run reset-install -- --confirm')
  process.exit(1)
}

async function main() {
  const [userCount, boardCount, menuCount, widgetCount, contentCount, policyCount, settingCount] = await Promise.all([
    prisma.user.count(),
    prisma.board.count(),
    prisma.menu.count(),
    prisma.homeWidget.count(),
    prisma.content.count(),
    prisma.policy.count(),
    prisma.setting.count(),
  ])

  console.log('')
  console.log('⚠️  INSTALL 리셋 경고')
  console.log('')
  console.log('현재 DB 상태:')
  console.log(`  - users:    ${userCount}명`)
  console.log(`  - boards:   ${boardCount}개`)
  console.log(`  - menus:    ${menuCount}개`)
  console.log(`  - widgets:  ${widgetCount}개`)
  console.log(`  - contents: ${contentCount}개`)
  console.log(`  - policies: ${policyCount}개`)
  console.log(`  - settings: ${settingCount}개`)
  console.log('')
  console.log('이 명령은 위 데이터를 모두 삭제합니다.')
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'} ✓`)
  console.log('')
  console.log('5초 후 진행... (Ctrl+C로 취소)')
  process.stdout.write('  ')
  for (let i = 5; i >= 1; i--) {
    process.stdout.write(`${i}... `)
    await new Promise(r => setTimeout(r, 1000))
  }
  console.log('\n시작\n')

  // 삭제 순서: FK 의존 역순
  await prisma.setting.deleteMany({})
  console.log('✓ settings 삭제')

  await prisma.content.deleteMany({})
  console.log('✓ contents 삭제')

  await prisma.policy.deleteMany({})
  console.log('✓ policies 삭제')

  await prisma.homeWidget.deleteMany({})
  console.log('✓ widgets 삭제')

  await prisma.menu.deleteMany({})
  console.log('✓ menus 삭제')

  await prisma.board.deleteMany({})
  console.log('✓ boards 삭제 (cascade로 posts·comments·reactions·attachments 포함)')

  // Shop 플러그인의 user-referencing 테이블 (Order는 cascade 없음)
  if (prisma.order) {
    await prisma.order.deleteMany({})
    console.log('✓ shop orders 삭제 (cascade로 order_items 포함)')
  }
  if (prisma.pendingOrder) {
    await prisma.pendingOrder.deleteMany({})
    console.log('✓ shop pending_orders 삭제')
  }

  await prisma.user.deleteMany({})
  console.log('✓ users 삭제 (cascade로 accounts·notifications·user_addresses·reviews·qnas·wishlists 포함)')

  console.log('')
  console.log('완료.')
  console.log('')
  console.log('⚠️  dev 서버가 실행 중이면 재시작해야 proxy.ts의 isInstalled 캐시와')
  console.log('   request.ts의 locale 캐시가 초기화됩니다.')
  console.log('')
  console.log('재시작 후 http://localhost:3001/ 접속 → install wizard로 리다이렉트됩니다.')

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('❌ 실행 중 오류:', e)
  process.exit(1)
})
