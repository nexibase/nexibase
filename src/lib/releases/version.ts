interface Version {
  core: string[]
  prerelease: string[]
  normalized: string
}
const numeric = /^(0|[1-9]\d*)$/
function parseVersion(input: string): Version | null {
  const normalized = input.trim().replace(/^v/, '')
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(normalized)
  if (!match) return null
  const prerelease = match[4]?.split('.') ?? []
  if (prerelease.some(part => /^\d+$/.test(part) && !numeric.test(part))) return null
  return { core: match.slice(1, 4), prerelease, normalized }
}
export function normalizeVersion(input: unknown): string | null {
  return typeof input === 'string' ? parseVersion(input)?.normalized ?? null : null
}
// Compare numeric identifiers without rounding large values or sorting 10 before 9.
function compareNumber(a: string, b: string): number {
  return a.length === b.length ? (a === b ? 0 : a > b ? 1 : -1) : a.length > b.length ? 1 : -1
}
export function compareVersions(left: string, right: string): number | null {
  const a = parseVersion(left), b = parseVersion(right)
  if (!a || !b) return null
  for (let i = 0; i < 3; i++) {
    const order = compareNumber(a.core[i], b.core[i])
    if (order) return order
  }
  if (!a.prerelease.length || !b.prerelease.length) {
    return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length ? -1 : 1
  }
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const x = a.prerelease[i], y = b.prerelease[i]
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? -1 : 1
    if (x === y) continue
    const xn = numeric.test(x), yn = numeric.test(y)
    return xn && yn ? compareNumber(x, y) : xn !== yn ? (xn ? -1 : 1) : x > y ? 1 : -1
  }
  return 0
}
export function getVersionStatus(current: string, latest: string): 'unknown' | 'update' | 'current' | 'ahead' {
  const order = compareVersions(latest, current)
  return order === null ? 'unknown' : order > 0 ? 'update' : order < 0 ? 'ahead' : 'current'
}
