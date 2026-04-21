import { NextResponse } from 'next/server'

const CACHE_TTL_MS = 10 * 60 * 1000
const GITHUB_REPO = 'nexibase/nexibase'
const UA = { 'User-Agent': 'nexibase.com' }

interface Release {
  tag_name?: string
  published_at?: string
  html_url?: string
}

interface Stats {
  stars: number | null
  release: Release | null
}

let cache: { data: Stats; expiresAt: number } | null = null

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: UA })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function buildStats(): Promise<Stats> {
  const [repo, release] = await Promise.all([
    fetchJson<{ stargazers_count?: number }>(`https://api.github.com/repos/${GITHUB_REPO}`),
    fetchJson<Release>(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`),
  ])

  const stars = typeof repo?.stargazers_count === 'number' ? repo.stargazers_count : null

  let pickedRelease: Release | null = null
  if (release?.tag_name) {
    pickedRelease = {
      tag_name: release.tag_name,
      published_at: release.published_at,
      html_url: release.html_url,
    }
  } else {
    const tags = await fetchJson<Array<{ name?: string }>>(
      `https://api.github.com/repos/${GITHUB_REPO}/tags`
    )
    if (tags?.[0]?.name) pickedRelease = { tag_name: tags[0].name }
  }

  return { stars, release: pickedRelease }
}

export async function GET() {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return NextResponse.json(cache.data)
  }
  const data = await buildStats()
  cache = { data, expiresAt: now + CACHE_TTL_MS }
  return NextResponse.json(data)
}
