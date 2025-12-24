import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 기본 콘텐츠 데이터
const DEFAULT_CONTENTS = [
  {
    slug: 'about',
    title: '회사소개',
    content: `<h2>NexiBase에 오신 것을 환영합니다</h2>
<p>NexiBase는 Next.js를 기반으로 한 차세대 웹 서비스 플랫폼입니다.</p>
<h3>우리의 비전</h3>
<p>개발자들이 더 쉽고 빠르게 웹 서비스를 구축할 수 있도록 돕는 것이 우리의 목표입니다.</p>
<h3>핵심 가치</h3>
<ul>
<li><strong>혁신</strong> - 최신 기술을 적극적으로 도입합니다</li>
<li><strong>신뢰</strong> - 안정적인 서비스를 제공합니다</li>
<li><strong>성장</strong> - 함께 성장하는 커뮤니티를 만듭니다</li>
</ul>`,
    isPublic: true,
  },
  {
    slug: 'contact',
    title: '문의하기',
    content: `<h2>문의 안내</h2>
<p>서비스 이용 중 궁금한 점이 있으시면 언제든지 문의해 주세요.</p>
<h3>연락처</h3>
<ul>
<li><strong>이메일</strong>: support@nexibase.com</li>
<li><strong>운영시간</strong>: 평일 09:00 - 18:00</li>
</ul>
<h3>자주 묻는 질문</h3>
<p>문의 전에 <a href="/contents/faq">자주 묻는 질문</a>을 확인해 주세요.</p>`,
    isPublic: true,
  },
  {
    slug: 'faq',
    title: '자주 묻는 질문',
    content: `<h2>자주 묻는 질문 (FAQ)</h2>
<h3>Q. 회원가입은 어떻게 하나요?</h3>
<p>A. 홈페이지 우측 상단의 '회원가입' 버튼을 클릭하여 가입할 수 있습니다.</p>
<h3>Q. 비밀번호를 잊어버렸어요.</h3>
<p>A. 로그인 페이지에서 '비밀번호 찾기'를 통해 재설정할 수 있습니다.</p>
<h3>Q. 게시글 작성은 어떻게 하나요?</h3>
<p>A. 로그인 후 원하는 게시판에서 '글쓰기' 버튼을 클릭하세요.</p>`,
    isPublic: true,
  },
]

// 기본 콘텐츠 생성
export async function POST() {
  try {
    // 이미 존재하는 콘텐츠 slug 확인
    const existingSlugs = await prisma.content.findMany({
      where: {
        slug: { in: DEFAULT_CONTENTS.map(c => c.slug) }
      },
      select: { slug: true }
    })

    const existingSlugSet = new Set(existingSlugs.map(c => c.slug))

    // 존재하지 않는 콘텐츠만 생성
    const contentsToCreate = DEFAULT_CONTENTS.filter(c => !existingSlugSet.has(c.slug))

    if (contentsToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 기본 콘텐츠가 이미 존재합니다.',
        created: 0
      })
    }

    // 콘텐츠 생성
    const result = await prisma.content.createMany({
      data: contentsToCreate
    })

    return NextResponse.json({
      success: true,
      message: `${result.count}개의 기본 콘텐츠가 생성되었습니다.`,
      created: result.count,
      contents: contentsToCreate.map(c => c.title)
    })

  } catch (error) {
    console.error('기본 콘텐츠 생성 에러:', error)
    return NextResponse.json(
      { error: '기본 콘텐츠 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
