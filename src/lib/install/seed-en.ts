import type { SeedData } from './types'

export const displayName = 'English'

export const seedEn: SeedData = {
  boards: [
    {
      slug: 'free',
      name: 'Free Board',
      description: 'A place to chat freely about anything.',
      category: null,
      isActive: true,
      useComment: true,
      useReaction: true,
    },
  ],
  menus: [
    { position: 'header', label: 'Home', url: '/', sortOrder: 0 },
    { position: 'header', label: 'Board', url: '/boards/free', sortOrder: 1 },
    { position: 'header', label: 'Login', url: '/login', sortOrder: 2 },
    { position: 'footer', label: 'Terms of Service', url: '/policies/terms', sortOrder: 0 },
    { position: 'footer', label: 'Privacy Policy', url: '/policies/privacy', sortOrder: 1 },
  ],
  widgets: [
    {
      widgetKey: 'welcome-banner',
      zone: 'top',
      title: 'Welcome Banner',
      colSpan: 12,
      rowSpan: 1,
      sortOrder: 0,
    },
    {
      widgetKey: 'latest-posts',
      zone: 'center',
      title: 'Latest Posts',
      colSpan: 12,
      rowSpan: 1,
      sortOrder: 0,
    },
  ],
  contents: [
    {
      slug: 'about',
      title: 'About Us',
      content: '<h2>Welcome to our site</h2><p>This is a sample About Us page. Edit it in the admin panel to introduce your site.</p>',
      isPublic: true,
    },
  ],
  policies: [
    {
      slug: 'terms',
      version: '1.0',
      title: 'Terms of Service',
      content: '<h2>Terms of Service</h2><p>These are placeholder terms. Please replace with your own terms of service in the admin panel before going live.</p>',
      isActive: true,
    },
    {
      slug: 'privacy',
      version: '1.0',
      title: 'Privacy Policy',
      content: '<h2>Privacy Policy</h2><p>This is a placeholder privacy policy. Please replace it with your own privacy policy in the admin panel before collecting user data.</p>',
      isActive: true,
    },
  ],
}
