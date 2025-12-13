import { customAlphabet } from 'nanoid'

// 소문자 + 숫자만 사용 (36자)
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21)

/**
 * NanoID 생성 (소문자 + 숫자)
 *
 * 특징:
 * - 21자 URL-safe 문자열 (a-z0-9)
 * - cuid보다 작고 빠름
 * - 충돌 확률 매우 낮음
 *
 * 사용법:
 * const id = generateId()
 * await prisma.user.create({ data: { id, email: '...' } })
 */
export function generateId(): string {
  return nanoid()
}
