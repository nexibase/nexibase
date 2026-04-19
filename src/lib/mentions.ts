import { prisma } from '@/lib/prisma'

// Matches @<nickname>. Nicknames: 2–20 chars, ASCII alphanumerics,
// underscore, and hangul syllables. Stops at whitespace or punctuation.
//
// Examples:
//   "hello @alice"            -> ["alice"]
//   "@alice @밥 @alice"       -> ["alice", "밥"]   (dedup preserved order)
//   "email foo@bar.com here"  -> []               (no space before @)
//   "@ab"                     -> ["ab"]           (min length 2)
//   "@a"                      -> []               (below min length)
const MENTION_RE = /(^|\s)@([A-Za-z0-9_\uAC00-\uD7A3]{2,20})/g

/** Extract mention nicknames from a content string (dedup, order preserved). */
export function parseMentions(content: string): string[] {
  if (!content) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const match of content.matchAll(MENTION_RE)) {
    const nick = match[2]
    if (!seen.has(nick)) {
      seen.add(nick)
      out.push(nick)
    }
  }
  return out
}

/** Look up users by nickname. Unknown nicknames are silently dropped. */
export async function resolveMentions(
  nicknames: string[],
): Promise<{ id: number; nickname: string }[]> {
  if (nicknames.length === 0) return []
  const users = await prisma.user.findMany({
    where: { nickname: { in: nicknames }, deletedAt: null },
    select: { id: true, nickname: true },
  })
  return users
}
