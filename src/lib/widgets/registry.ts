import dynamic from 'next/dynamic'

export interface WidgetDefinition {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<{ settings?: Record<string, any> }>
  label: string
  description: string
  defaultZone: 'hero' | 'main' | 'sidebar' | 'bottom'
  defaultColSpan: number
  defaultRowSpan: number
  settingsSchema: Record<string, unknown> | null
}

const WelcomeBanner = dynamic(() => import('@/components/widgets/WelcomeBanner'), { ssr: false })
const SiteStats = dynamic(() => import('@/components/widgets/SiteStats'), { ssr: false })
const LatestPosts = dynamic(() => import('@/components/widgets/LatestPosts'), { ssr: false })
const PopularBoards = dynamic(() => import('@/components/widgets/PopularBoards'), { ssr: false })
const ShopShortcut = dynamic(() => import('@/components/widgets/ShopShortcut'), { ssr: false })
const AuctionLive = dynamic(() => import('@/components/widgets/AuctionLive'), { ssr: false })
const CommunityGuide = dynamic(() => import('@/components/widgets/CommunityGuide'), { ssr: false })
const BoardCards = dynamic(() => import('@/components/widgets/BoardCards'), { ssr: false })

export const widgetRegistry: Record<string, WidgetDefinition> = {
  'welcome-banner': {
    component: WelcomeBanner,
    label: '환영 배너',
    description: '로그인 사용자 환영 메시지와 CTA 버튼',
    defaultZone: 'hero',
    defaultColSpan: 2,
    defaultRowSpan: 2,
    settingsSchema: null,
  },
  'site-stats': {
    component: SiteStats,
    label: '사이트 통계',
    description: '회원, 게시글, 댓글, 게시판 통계 카드',
    defaultZone: 'hero',
    defaultColSpan: 2,
    defaultRowSpan: 1,
    settingsSchema: null,
  },
  'latest-posts': {
    component: LatestPosts,
    label: '최근 게시글',
    description: '최근 게시글 목록',
    defaultZone: 'main',
    defaultColSpan: 2,
    defaultRowSpan: 2,
    settingsSchema: { limit: { type: 'number', label: '표시 개수', default: 6 } },
  },
  'popular-boards': {
    component: PopularBoards,
    label: '인기 게시판',
    description: '인기 게시판 랭킹',
    defaultZone: 'sidebar',
    defaultColSpan: 1,
    defaultRowSpan: 2,
    settingsSchema: { limit: { type: 'number', label: '표시 개수', default: 5 } },
  },
  'shop-shortcut': {
    component: ShopShortcut,
    label: '쇼핑몰 바로가기',
    description: '쇼핑몰 링크 카드',
    defaultZone: 'main',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    settingsSchema: null,
  },
  'auction-live': {
    component: AuctionLive,
    label: '진행중 경매',
    description: '진행중인 경매 목록',
    defaultZone: 'main',
    defaultColSpan: 2,
    defaultRowSpan: 1,
    settingsSchema: { limit: { type: 'number', label: '표시 개수', default: 4 } },
  },
  'community-guide': {
    component: CommunityGuide,
    label: '커뮤니티 가이드',
    description: '커뮤니티 이용 가이드',
    defaultZone: 'sidebar',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    settingsSchema: null,
  },
  'board-cards': {
    component: BoardCards,
    label: '게시판 카드',
    description: '게시판 카드 그리드',
    defaultZone: 'bottom',
    defaultColSpan: 4,
    defaultRowSpan: 1,
    settingsSchema: { limit: { type: 'number', label: '표시 개수', default: 4 } },
  },
}
