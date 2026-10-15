import type { Metadata } from 'next'

export function publicBaseUrl(configured: string, fallback: string): URL {
  for (const value of [configured, fallback]) {
    try {
      const url = new URL(value)
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
        return new URL(url.origin)
      }
    } catch { /* Try the request origin when the saved URL is invalid. */ }
  }
  return new URL('http://localhost:3000')
}

export function pageMetadata(title: string, description: string, path: string, options: { noIndex?: boolean; image?: string; article?: boolean } = {}): Metadata {
  const images = [{ url: options.image || '/opengraph-image', width: 1200, height: 630 }]
  return {
    title, description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: options.article ? 'article' : 'website', images },
    twitter: { card: 'summary_large_image', title, description, images: images.map(image => image.url) },
    ...(options.noIndex && { robots: { index: false, follow: false } }),
  }
}

export function plainDescription(html: string, max = 160): string {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

export function isNoIndexPath(path: string): boolean {
  return /^\/(?:api|admin|mypage|login|signup|forgot-password|reset-password|verify-email|email-certify|search)(?:\/|$)/.test(path)
    || /^\/boards\/[^/]+\/(?:create|[^/]+\/edit)(?:\/|$)/.test(path)
    || /^\/shop\/(?:cart|order|orders|mypage|wishlist)(?:\/|$)/.test(path)
}

export function isNexibaseProfile(profile: string, widgetKeys: string[]): boolean {
  if (profile === 'nexibase') return true
  if (profile === 'custom') return false
  return widgetKeys.some(key => ['nexibase-landing-hero', 'nexibase-home-hero', 'nexibase-hero'].includes(key))
}

export function nexibaseSeo(locale: string) {
  return locale === 'ko' ? {
    title: 'Next.js·JavaScript 게시판·쇼핑몰 CMS',
    description: 'NexiBase는 Next.js와 React, JavaScript·TypeScript 기반의 오픈소스 CMS입니다. 게시판과 커뮤니티, 쇼핑몰을 구축하고 플러그인·테마·위젯으로 확장하세요.',
    heading: 'Next.js로 만드는 게시판·쇼핑몰 CMS, NexiBase',
    intro: 'JavaScript와 TypeScript로 개발하는 NexiBase는 게시판, 콘텐츠 관리, 회원 관리와 쇼핑몰을 한 프로젝트에서 구성하는 오픈소스 CMS 솔루션입니다.',
    features: [
      { title: 'JavaScript 게시판과 커뮤니티', text: '게시글·댓글·답글, 파일 첨부, 비밀글, 회원 권한과 일일 작성 제한으로 커뮤니티를 운영할 수 있습니다.' },
      { title: 'Next.js 쇼핑몰 솔루션', text: '쇼핑몰 플러그인으로 상품·카테고리, 장바구니, 주문과 결제, 배송 관리 기능을 추가할 수 있습니다.' },
      { title: '확장 가능한 오픈소스 CMS', text: '관리자 화면에서 콘텐츠와 메뉴를 관리하고, 테마와 위젯으로 화면을 구성합니다. MIT 라이선스로 직접 설치하고 기능을 확장할 수 있습니다.' },
    ],
    sourceLabel: 'NexiBase 설치 방법과 소스 코드',
  } : {
    title: 'Next.js & JavaScript CMS for Forums and E-commerce',
    description: 'NexiBase is an open-source CMS built with Next.js, React, JavaScript and TypeScript. Build community forums and online stores with plugins, themes and widgets.',
    heading: 'NexiBase: a Next.js CMS for forums and online stores',
    intro: 'Build with JavaScript and TypeScript using NexiBase, an open-source CMS for community forums, content, members and e-commerce in one project.',
    features: [
      { title: 'JavaScript forums and communities', text: 'Run boards with posts, comments, replies, attachments, private posts, member permissions and daily writing limits.' },
      { title: 'Next.js e-commerce', text: 'Add the shop plugin for products, categories, carts, orders, payments and shipping management.' },
      { title: 'An extensible open-source CMS', text: 'Manage content and menus in the admin panel. Build layouts with themes and widgets, self-host under the MIT license and extend the source code.' },
    ],
    sourceLabel: 'NexiBase installation guide and source code',
  }
}
