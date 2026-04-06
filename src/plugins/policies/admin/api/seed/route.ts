import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// 기본 약관 데이터
const DEFAULT_POLICIES = [
  {
    slug: 'terms',
    version: '1.0',
    title: '이용약관',
    content: `<h2>서비스 이용약관</h2>
<p>본 약관은 NexiBase(이하 "회사")가 제공하는 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>

<h3>제1조 (목적)</h3>
<p>본 약관은 회사가 운영하는 웹사이트 및 관련 서비스(이하 "서비스")의 이용에 관한 조건 및 절차, 회사와 회원 간의 권리, 의무 및 기타 필요한 사항을 규정함을 목적으로 합니다.</p>

<h3>제2조 (정의)</h3>
<ol>
<li>"서비스"란 회사가 제공하는 모든 온라인 서비스를 의미합니다.</li>
<li>"회원"이란 본 약관에 동의하고 회사와 서비스 이용계약을 체결한 자를 의미합니다.</li>
<li>"아이디(ID)"란 회원 식별과 서비스 이용을 위하여 회원이 설정하고 회사가 승인한 이메일 주소를 의미합니다.</li>
</ol>

<h3>제3조 (약관의 효력 및 변경)</h3>
<ol>
<li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.</li>
<li>회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있습니다.</li>
</ol>

<h3>제4조 (서비스의 제공)</h3>
<p>회사는 다음과 같은 서비스를 제공합니다:</p>
<ul>
<li>게시판 서비스</li>
<li>커뮤니티 서비스</li>
<li>기타 회사가 정하는 서비스</li>
</ul>`,
    isActive: true,
  },
  {
    slug: 'privacy',
    version: '1.0',
    title: '개인정보처리방침',
    content: `<h2>개인정보처리방침</h2>
<p>NexiBase(이하 "회사")는 회원의 개인정보를 중요시하며, 「개인정보 보호법」을 준수하고 있습니다.</p>

<h3>제1조 (수집하는 개인정보 항목)</h3>
<p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다:</p>
<ul>
<li><strong>필수항목</strong>: 이메일 주소, 비밀번호</li>
<li><strong>선택항목</strong>: 닉네임, 프로필 이미지, 연락처</li>
<li><strong>자동수집</strong>: IP 주소, 접속 로그, 서비스 이용 기록</li>
</ul>

<h3>제2조 (개인정보의 수집 및 이용 목적)</h3>
<p>수집한 개인정보는 다음의 목적을 위해 활용합니다:</p>
<ul>
<li>회원 식별 및 서비스 제공</li>
<li>서비스 개선 및 신규 서비스 개발</li>
<li>불법 이용 방지 및 비인가 사용 방지</li>
</ul>

<h3>제3조 (개인정보의 보유 및 이용 기간)</h3>
<p>회원의 개인정보는 회원 탈퇴 시까지 보유하며, 탈퇴 즉시 파기합니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.</p>

<h3>제4조 (개인정보의 파기)</h3>
<p>회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>`,
    isActive: true,
  },
  {
    slug: 'marketing',
    version: '1.0',
    title: '마케팅 정보 수신 동의',
    content: `<h2>마케팅 정보 수신 동의</h2>

<h3>수집 및 이용 목적</h3>
<p>회사는 회원에게 다양한 혜택과 정보를 제공하기 위해 마케팅 정보를 발송합니다.</p>

<h3>수집 항목</h3>
<ul>
<li>이메일 주소</li>
<li>휴대전화 번호 (선택)</li>
</ul>

<h3>이용 및 보유 기간</h3>
<p>마케팅 정보 수신 동의일로부터 동의 철회 시까지</p>

<h3>동의 거부권 및 불이익</h3>
<p>마케팅 정보 수신 동의는 선택사항이며, 동의하지 않아도 서비스 이용에 제한이 없습니다. 다만, 각종 혜택 및 이벤트 정보 수신이 제한될 수 있습니다.</p>

<h3>수신 동의 철회</h3>
<p>마이페이지 > 설정에서 언제든지 수신 동의를 철회할 수 있습니다.</p>`,
    isActive: true,
  },
]

// 기본 약관 생성
export async function POST() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    // 이미 존재하는 약관 확인 (slug + version 조합)
    const existingPolicies = await prisma.policy.findMany({
      where: {
        OR: DEFAULT_POLICIES.map(p => ({
          slug: p.slug,
          version: p.version
        }))
      },
      select: { slug: true, version: true }
    })

    const existingSet = new Set(
      existingPolicies.map(p => `${p.slug}:${p.version}`)
    )

    // 존재하지 않는 약관만 생성
    const policiesToCreate = DEFAULT_POLICIES.filter(
      p => !existingSet.has(`${p.slug}:${p.version}`)
    )

    if (policiesToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 기본 약관이 이미 존재합니다.',
        created: 0
      })
    }

    // 약관 생성
    const result = await prisma.policy.createMany({
      data: policiesToCreate
    })

    return NextResponse.json({
      success: true,
      message: `${result.count}개의 기본 약관이 생성되었습니다.`,
      created: result.count,
      policies: policiesToCreate.map(p => `${p.title} (v${p.version})`)
    })

  } catch (error) {
    console.error('기본 약관 생성 에러:', error)
    return NextResponse.json(
      { error: '기본 약관 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
