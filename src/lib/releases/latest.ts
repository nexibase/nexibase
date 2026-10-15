import { normalizeVersion } from './version'

export interface LatestRelease { version: string; url: string }
interface LoaderOptions { fetcher?: typeof fetch; now?: () => number; ttlMs?: number }
const API_URL = 'https://api.github.com/repos/nexibase/nexibase/releases/latest'

// One server-side cache protects the GitHub API; browsers never cache release status.
export function createLatestReleaseLoader({ fetcher = fetch, now = Date.now, ttlMs = 300_000 }: LoaderOptions = {}) {
  let cached: { release: LatestRelease | null; expiresAt: number } | undefined
  let inFlight: Promise<LatestRelease | null> | undefined
  return async (): Promise<LatestRelease | null> => {
    if (cached && cached.expiresAt > now()) return cached.release
    if (inFlight) return inFlight
    inFlight = (async () => {
      let release: LatestRelease | null = null
      try {
        const response = await fetcher(API_URL, {
          cache: 'no-store', signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'nexibase', Accept: 'application/vnd.github+json' },
        })
        if (response.ok) {
          const data: unknown = await response.json()
          if (data && typeof data === 'object') {
            const value = data as Record<string, unknown>
            const version = normalizeVersion(value.tag_name)
            // Do not mistake draft/prerelease tags or malformed API data for an update.
            if (value.draft === false && value.prerelease === false && version && !version.split('+')[0].includes('-')) {
              release = { version, url: `https://github.com/nexibase/nexibase/releases/tag/${encodeURIComponent(String(value.tag_name))}` }
            }
          }
        }
      } catch { /* An unavailable release is not an available update. */ }
      cached = { release, expiresAt: now() + (release ? ttlMs : 30_000) }
      return release
    })()
    try { return await inFlight } finally { inFlight = undefined }
  }
}
export const getLatestRelease = createLatestReleaseLoader()
