export const NICKNAME_POLICY_MESSAGE = '닉네임에는 ‘관리’, ‘운영’, ‘admin’을 포함할 수 없습니다.'

/** Normalize only for inspection; never use this value as the stored nickname. */
export function normalizeNicknameForInspection(nickname: string): string {
  // A second normalization composes Hangul jamo separated by invisible characters.
  return nickname.normalize('NFKC')
    .replace(/[\s\p{Default_Ignorable_Code_Point}\p{Cc}]/gu, '')
    .normalize('NFKC').toLowerCase()
}

export function hasReservedNickname(nickname: unknown): boolean {
  if (typeof nickname !== 'string') return false
  const inspected = normalizeNicknameForInspection(nickname)
  return ['관리', '운영', 'admin'].some(word => inspected.includes(word))
}

export function nicknamePolicyError(nickname: unknown): string | null {
  if (typeof nickname !== 'string' || !nickname.trim()) return '닉네임을 입력해주세요.'
  return hasReservedNickname(nickname) ? NICKNAME_POLICY_MESSAGE : null
}

/** OAuth provider display names are untrusted, but must not break sign-in. */
export function safeSocialNickname(name: unknown, fallback: string): string {
  return nicknamePolicyError(name) ? fallback : (name as string)
}
