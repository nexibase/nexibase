import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

function daysAgo(days: number): Date {
  return daysFromNow(-days)
}

// ─── 상품 데이터 (50개) ───────────────────────────────────────────────────────

const AUCTION_ITEMS = [
  // 전자제품 (12개)
  { title: '삼성 갤럭시 S25 울트라 256GB 티타늄 블랙', starting: 800000, buyNow: 1200000 },
  { title: '애플 맥북 프로 14인치 M4 Pro 512GB', starting: 1800000, buyNow: 2500000 },
  { title: '소니 WH-1000XM5 무선 노이즈캔슬링 헤드폰', starting: 180000, buyNow: 350000 },
  { title: '삼성 65인치 Neo QLED 8K TV QN65QN900D', starting: 1500000, buyNow: null },
  { title: '애플 아이패드 프로 13인치 M4 Wi-Fi 256GB', starting: 900000, buyNow: 1300000 },
  { title: 'LG 그램 17 17Z90S 노트북 i7 32GB', starting: 1200000, buyNow: 1800000 },
  { title: '소니 알파 A7RV 풀프레임 미러리스 바디', starting: 2800000, buyNow: null },
  { title: '애플 에어팟 프로 2세대 USB-C', starting: 180000, buyNow: 330000 },
  { title: '삼성 갤럭시 워치 Ultra 47mm 화이트', starting: 300000, buyNow: 550000 },
  { title: 'DJI Mini 4 Pro 드론 플라이 모어 콤보', starting: 700000, buyNow: 1100000 },
  { title: '닌텐도 스위치 OLED 화이트 + 포케몬 번들', starting: 280000, buyNow: 430000 },
  { title: '플레이스테이션 5 슬림 디지털 에디션', starting: 350000, buyNow: 520000 },

  // 패션 & 명품 (10개)
  { title: '구찌 마몬트 GG 미디엄 숄더백 블랙', starting: 1200000, buyNow: null },
  { title: '루이비통 네버풀 MM 다미에 에벤', starting: 1500000, buyNow: 2100000 },
  { title: '롤렉스 서브마리너 데이트 41mm 블랙 다이얼', starting: 8000000, buyNow: null },
  { title: '나이키 에어조던 1 레트로 하이 시카고 2022', starting: 350000, buyNow: 600000 },
  { title: '발렌시아가 트리플 S 스니커즈 화이트 42사이즈', starting: 400000, buyNow: 700000 },
  { title: '샤넬 클래식 플랩 미디엄 블랙 캐비어 골드', starting: 5500000, buyNow: null },
  { title: '버버리 체크 캐시미어 머플러 클래식 베이지', starting: 250000, buyNow: 450000 },
  { title: '몽클레르 마야 다운재킷 블랙 3사이즈', starting: 900000, buyNow: 1400000 },
  { title: '에르메스 카레 90 실크 스카프 플로럴', starting: 400000, buyNow: null },
  { title: '프라다 사피아노 남성 지갑 블랙', starting: 350000, buyNow: 600000 },

  // 카메라 & 취미 (8개)
  { title: '캐논 EOS R5 Mark II 바디 단품', starting: 3200000, buyNow: null },
  { title: '라이카 M11 디지털 레인지파인더 블랙', starting: 7000000, buyNow: null },
  { title: '레고 스타워즈 밀레니엄 팔콘 75192 미개봉', starting: 700000, buyNow: 1000000 },
  { title: '레고 테크닉 부가티 키론 42083 미개봉', starting: 350000, buyNow: 550000 },
  { title: '깁슨 레스폴 스탠다드 50s 허니버스트', starting: 1800000, buyNow: null },
  { title: '펜더 스트라토캐스터 USA 아메리칸 프로페셔널 II', starting: 1500000, buyNow: 2200000 },
  { title: '니콘 Z8 바디 + 24-120mm f/4 렌즈 세트', starting: 3000000, buyNow: null },
  { title: '포르자 호라이즌 5 리미티드 에디션 박스셋', starting: 80000, buyNow: 150000 },

  // 생활가전 (8개)
  { title: '다이슨 V15 디텍트 앱솔루트 무선청소기', starting: 500000, buyNow: 800000 },
  { title: '발뮤다 더 토스터 프로 화이트 K11A', starting: 180000, buyNow: 300000 },
  { title: '일리 X9.2 에스프레소 커피머신 블랙', starting: 350000, buyNow: 600000 },
  { title: '삼성 비스포크 큐커 오브젝트 셰프 에어프라이어', starting: 120000, buyNow: 220000 },
  { title: '르크루제 20cm 코코트 론드 체리 레드', starting: 200000, buyNow: 380000 },
  { title: '드롱기 마그니피카 에보 전자동 커피머신', starting: 450000, buyNow: 750000 },
  { title: '다이슨 에어랩 컴플리트 롱 헤어케어 기기', starting: 400000, buyNow: 650000 },
  { title: '브레빌 바리스타 익스프레스 임프레스 블랙 세서미', starting: 550000, buyNow: null },

  // 예술 & 수집품 (7개)
  { title: '초판본 해리포터 전집 영국판 블룸즈버리 7권 세트', starting: 300000, buyNow: 600000 },
  { title: '뱅크시 Girl with Balloon 리미티드 프린트 10/150', starting: 1500000, buyNow: null },
  { title: '빈티지 LP 레코드 비틀즈 애비로드 UK 오리지널', starting: 250000, buyNow: 500000 },
  { title: '포켓몬 카드 피카츄 초판 PSA 10 홀로그램', starting: 800000, buyNow: null },
  { title: '한정판 조던 x 트래비스 스캇 나이키 아트프린트 1/500', starting: 200000, buyNow: 400000 },
  { title: '빈티지 오메가 씨마스터 1968 데드스탁 케이스', starting: 600000, buyNow: null },
  { title: '조선 백자 청화 매화문 호리병 (감정서 포함)', starting: 1200000, buyNow: null },

  // 기타 (5개)
  { title: '테슬라 모델 3 하이랜드 스탠다드 레인지 2024년형', starting: 35000000, buyNow: 42000000 },
  { title: '파텍필립 노틸러스 5711 스테인리스 블루 다이얼', starting: 50000000, buyNow: null },
  { title: '에르메스 버킨 30 타우프 그레이 트리용 팔라듐', starting: 8000000, buyNow: null },
  { title: '스위스 알파인 이글 챌렛 NFT + 실물 아트워크', starting: 500000, buyNow: 900000 },
  { title: '빈티지 아케이드 머신 팩맨 오리지널 1980 캐비닛', starting: 1500000, buyNow: null },
]

// ─── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 경매 시드 스크립트 시작...\n')

  // 1. 기존 경매 데이터 삭제
  console.log('🗑️  기존 경매 데이터 삭제 중...')
  await prisma.autoBid.deleteMany()
  await prisma.bid.deleteMany()
  await prisma.auction.deleteMany()
  console.log('   완료\n')

  // 2. 유저 확인 / 생성
  console.log('👤 유저 확인 중...')
  const userCount = await prisma.user.count()

  let seller: { id: number; nickname: string }
  let bidder: { id: number; nickname: string }

  if (userCount < 1) {
    console.log('   유저 없음 → 테스트 유저 2명 생성')
    const hashedPw = await bcrypt.hash('password123!', 10)

    seller = await prisma.user.upsert({
      where: { email: 'seller@test.com' },
      update: {},
      create: {
        email: 'seller@test.com',
        nickname: '경매판매자',
        password: hashedPw,
        role: 'user',
        status: 'active',
        name: '테스트판매자',
      },
      select: { id: true, nickname: true },
    })

    bidder = await prisma.user.upsert({
      where: { email: 'bidder@test.com' },
      update: {},
      create: {
        email: 'bidder@test.com',
        nickname: '경매입찰자',
        password: hashedPw,
        role: 'user',
        status: 'active',
        name: '테스트입찰자',
      },
      select: { id: true, nickname: true },
    })

    console.log(`   판매자 생성: ${seller.nickname} (id: ${seller.id})`)
    console.log(`   입찰자 생성: ${bidder.nickname} (id: ${bidder.id})`)
  } else {
    // 기존 유저 재활용 (첫 번째 = 판매자, 두 번째 이후 = 입찰자)
    const users = await prisma.user.findMany({
      take: 2,
      orderBy: { id: 'asc' },
      select: { id: true, nickname: true },
    })
    seller = users[0]
    bidder = users.length > 1 ? users[1] : users[0]
    console.log(`   기존 유저 사용 — 판매자: ${seller.nickname}, 입찰자: ${bidder.nickname}`)
  }
  console.log()

  // 3. 경매 생성
  console.log('🏷️  경매 50개 생성 중...')

  const bidIncrements = [1000, 5000, 10000]

  // 상태별 분포: active 15, pending 15, ended 20
  const statuses: Array<'active' | 'pending' | 'ended'> = [
    ...Array(15).fill('active'),
    ...Array(15).fill('pending'),
    ...Array(20).fill('ended'),
  ]

  let activeCount = 0
  let pendingCount = 0
  let endedCount = 0

  for (let i = 0; i < AUCTION_ITEMS.length; i++) {
    const item = AUCTION_ITEMS[i]
    const status = statuses[i]
    const increment = pick(bidIncrements)
    const imageUrl = `https://picsum.photos/seed/auction${i + 1}/800/600`

    // 날짜 설정
    let startsAt: Date
    let endsAt: Date

    if (status === 'active') {
      startsAt = daysAgo(rand(1, 5))
      endsAt = daysFromNow(rand(1, 7))
    } else if (status === 'pending') {
      startsAt = daysFromNow(rand(1, 7))
      endsAt = daysFromNow(rand(8, 14))
    } else {
      // ended
      startsAt = daysAgo(rand(8, 30))
      endsAt = daysAgo(rand(1, 7))
    }

    // 가격 스케일: 아이템 기준가 사용, 너무 크면 축소 (시드용)
    const startingPrice = item.starting
    const buyNowPrice = item.buyNow ?? null

    const auction = await prisma.auction.create({
      data: {
        sellerId: seller.id,
        title: item.title,
        description: `${item.title}을(를) 경매에 올립니다. 상태 양호하며 직거래 또는 택배 거래 가능합니다. 문의 환영합니다.`,
        image: imageUrl,
        startingPrice,
        currentPrice: startingPrice,
        buyNowPrice,
        bidIncrement: increment,
        bidCount: 0,
        startsAt,
        endsAt,
        status,
        winnerId: null,
      },
    })

    // 4. 입찰 생성
    if (status === 'active') {
      const bidCount = rand(3, 10)
      let price = startingPrice

      for (let b = 0; b < bidCount; b++) {
        price += increment * rand(1, 3)
        await prisma.bid.create({
          data: {
            auctionId: auction.id,
            userId: bidder.id,
            amount: price,
            isAutoBid: false,
            createdAt: new Date(startsAt.getTime() + (b + 1) * rand(300_000, 3_600_000)),
          },
        })
      }

      await prisma.auction.update({
        where: { id: auction.id },
        data: { currentPrice: price, bidCount },
      })

      activeCount++
    } else if (status === 'ended') {
      const bidCount = rand(5, 15)
      let price = startingPrice

      for (let b = 0; b < bidCount; b++) {
        price += increment * rand(1, 3)
        await prisma.bid.create({
          data: {
            auctionId: auction.id,
            userId: bidder.id,
            amount: price,
            isAutoBid: false,
            createdAt: new Date(startsAt.getTime() + (b + 1) * rand(300_000, 7_200_000)),
          },
        })
      }

      await prisma.auction.update({
        where: { id: auction.id },
        data: {
          currentPrice: price,
          bidCount,
          winnerId: bidder.id,
        },
      })

      endedCount++
    } else {
      pendingCount++
    }

    if ((i + 1) % 10 === 0) {
      console.log(`   ${i + 1}/50 완료...`)
    }
  }

  console.log()
  console.log('✅ 시드 완료!')
  console.log(`   활성 경매  : ${activeCount}개`)
  console.log(`   예정 경매  : ${pendingCount}개`)
  console.log(`   종료 경매  : ${endedCount}개`)
  console.log(`   합계       : ${activeCount + pendingCount + endedCount}개`)
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
