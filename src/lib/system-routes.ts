import coreFeatures from './core-features.json'
import coreRouteAliases from './core-route-aliases.json'

export const SYSTEM_SLUGS = [
  'admin', 'login', 'signup', 'mypage', 'api', 'install', 'setup-required',
  'verify-email', 'profile', 'search', 'new', ...coreFeatures, ...Object.keys(coreRouteAliases),
]
