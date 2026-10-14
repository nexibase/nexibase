export function isOfficialAdmin(user: { role: string; status: string; deletedAt: Date | string | null }): boolean {
  return user.role === 'admin' && user.status === 'active' && user.deletedAt === null
}
