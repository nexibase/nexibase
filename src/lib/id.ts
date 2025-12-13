import { customAlphabet } from 'nanoid'

// 소문자 + 숫자 (36자 알파벳)
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24)

/**
 * NanoID 생성 (소문자 + 숫자, 24자)
 *
 * 특징:
 * - 24자 URL-safe 문자열 (a-z0-9)
 * - UUID보다 짧고 가독성 좋음
 * - 충돌 확률: 36^24 ≈ 2.2 × 10^37
 *
 * 사용법:
 * const id = generateId()
 * await prisma.user.create({ data: { id, email: '...' } })
 */
export function generateId(): string {
  return nanoid()
}
