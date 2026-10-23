import type { SeedData } from './types'

export const displayName = '한국어'

export const seedKo: SeedData = {
  boards: [
    {
      slug: 'free',
      name: '자유게시판',
      description: '무엇이든 자유롭게 이야기 나눌 수 있는 공간입니다.',
      category: null,
      isActive: true,
      useComment: true,
      useReaction: true,
    },
  ],
  menus: [
    { position: 'header', label: '홈', url: '/', sortOrder: 0 },
    { position: 'header', label: '게시판', url: '/boards/free', sortOrder: 1 },
    { position: 'header', label: '로그인', url: '/login', sortOrder: 2 },
    { position: 'footer', groupName: '정책', label: '이용약관', url: '/policies/terms', sortOrder: 0 },
    { position: 'footer', groupName: '정책', label: '개인정보처리방침', url: '/policies/privacy', sortOrder: 1 },
  ],
  widgets: [
    {
      widgetKey: 'welcome-banner',
      zone: 'top',
      title: '환영 배너',
      colSpan: 12,
      rowSpan: 1,
      sortOrder: 0,
    },
    {
      widgetKey: 'latest-posts',
      zone: 'center',
      title: '최근 게시글',
      colSpan: 12,
      rowSpan: 1,
      sortOrder: 0,
    },
  ],
  contents: [
    {
      slug: 'about',
      title: '사이트 소개',
      content: '<h2>사이트에 오신 것을 환영합니다</h2><p>이 페이지는 사이트 소개 샘플 페이지입니다. 관리자 패널에서 내용을 편집하여 사이트를 소개해 주세요.</p>',
      isPublic: true,
    },
  ],
  policies: [
    {
      slug: 'terms',
      version: '1.0',
      title: '이용약관',
      content: '<h2>이용약관</h2><p>이 내용은 임시 이용약관입니다. 서비스 오픈 전에 관리자 패널에서 실제 이용약관으로 교체해 주세요.</p>',
      isActive: true,
    },
    {
      slug: 'privacy',
      version: '1.0',
      title: '개인정보처리방침',
      content: '<h2>개인정보처리방침</h2><p>이 내용은 임시 개인정보처리방침입니다. 사용자 데이터를 수집하기 전에 관리자 패널에서 실제 개인정보처리방침으로 교체해 주세요.</p>',
      isActive: true,
    },
  ],
}
