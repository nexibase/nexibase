import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CustomPrismaAdapter } from './auth-adapter'
import { hasReservedNickname } from './nickname-policy'

test('OAuth adapter creates safe names and preserves existing names during reserved provider updates', async () => {
  let writtenNickname: unknown
  const client = { user: {
    findFirst: async () => null,
    create: async (args: { data: { nickname: string; email: string } }) => {
    writtenNickname = args.data.nickname
    return { id: 1, email: args.data.email, nickname: args.data.nickname, emailVerified: null, image: null }
    },
    update: async (args: { data: { nickname?: string } }) => {
    writtenNickname = args.data.nickname
    return { id: 1, email: 'qa@example.invalid', nickname: args.data.nickname ?? '기존회원', emailVerified: null, image: null }
    },
  }, account: {} } as unknown as NonNullable<Parameters<typeof CustomPrismaAdapter>[0]>
  const adapter = CustomPrismaAdapter(client)
  const user = { email: 'qa@example.invalid', name: 'SuperADMIN', emailVerified: null, image: null }
  const created = await adapter.createUser!(user)
  assert.equal(hasReservedNickname(writtenNickname), false)
  assert.match(created.name!, /^회원\d+$/)
  const updated = await adapter.updateUser!({ id: '1', name: '운 영자' })
  assert.equal(writtenNickname, undefined)
  assert.equal(updated.name, '기존회원')
  const normal = await adapter.createUser!({ ...user, name: '구공탄' })
  assert.equal(normal.name, '구공탄')
})
