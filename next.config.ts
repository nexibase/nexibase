import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from 'next-intl/plugin';
import pkg from "./package.json" with { type: "json" };

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  env: {
    // package.json 버전을 빌드 시점에 클라이언트에 주입
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  // Pin Turbopack's workspace root to this directory so sibling lockfiles
  // (e.g. in a git worktree alongside main) don't confuse module resolution.
  turbopack: {
    root: path.resolve('.'),
  },
  // next dev를 https://dev.nexibase.com (Apache 프록시)으로 열 때 dev 리소스/HMR 허용
  allowedDevOrigins: ['dev.nexibase.com'],
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Keep HMR in memory; /home has limited free space.
    turbopackFileSystemCacheForDev: false,
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'k.kakaocdn.net' },
      { protocol: 'http', hostname: 'k.kakaocdn.net' },
      { protocol: 'https', hostname: 'phinf.pstatic.net' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    // Uploaded banners use the built-in responsive image optimizer.
    // External avatars retain their existing URLs below.
    unoptimized: false,
  },
};

export default withNextIntl(nextConfig);
