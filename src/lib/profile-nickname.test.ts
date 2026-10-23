import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { isOfficialAdmin } from './admin-identity'
import { nicknamePolicyError } from './nickname-policy'

const require = createRequire(import.meta.url)
type User = {
  id: number; email: string; nickname: string; role: string; status: string
  deletedAt: Date | null; password: string | null
}

function fixture(overrides: Partial<User> = {}, duplicate = false) {
  let user: User = {
    id: 1, email: 'profile@example.invalid', nickname: '기존회원',
    role: 'admin', status: 'active', deletedAt: null, password: 'private-hash', ...overrides,
  }
  let writes = 0
  const prisma = { user: {
    findUnique: async () => ({ ...user }),
    findFirst: async () => duplicate ? { id: 2 } : null,
    update: async ({ data }: { data: Partial<User> }) => {
      writes++
      user = { ...user, ...data }
      const { password, ...updated } = user
      void password
      return updated
    },
  } }
  const dependencies: Record<string, unknown> = {
    'next/server': require('next/server'), '@/lib/prisma': { prisma },
    'bcryptjs': {}, 'next-auth': { getServerSession: async () => ({ user: { email: user.email } }) },
    '@/app/api/auth/[...nextauth]/route': { authOptions: {} },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/nickname-policy': { nicknamePolicyError }, '@/lib/admin-identity': { isOfficialAdmin },
    fs: require('node:fs'), path: require('node:path'),
  }
  const source = ts.transpileModule(fs.readFileSync(path.join(process.cwd(), 'src/app/api/me/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const module = { exports: {} as {
    GET: () => Promise<Response>; PUT: (request: Request) => Promise<Response>
  } }
  new Function('require', 'module', 'exports', source)((id: string) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return {
    get: module.exports.GET,
    put: (body: Record<string, unknown>) => module.exports.PUT(new Request('https://example.invalid/api/me', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })),
    setIdentity: (identity: Partial<User>) => { user = { ...user, ...identity } },
    writes: () => writes,
  }
}

test('profile API permits reserved nicknames for an active official admin and returns the capability after save', async () => {
  const f = fixture()
  const data = await (await f.get()).json()
  assert.equal(data.user.isOfficialAdmin, true)
  assert.equal('password' in data.user, false)
  assert.equal('deletedAt' in data.user, false)
  for (const nickname of ['관리자', '운영진', 'SuperAdmin']) {
    const response = await f.put({ nickname })
    assert.equal(response.status, 200)
    const saved = await response.json()
    assert.equal(saved.user.nickname, nickname)
    assert.equal(saved.user.isOfficialAdmin, true)
    assert.equal('deletedAt' in saved.user, false)
  }
  assert.equal(f.writes(), 3)
})

test('profile API rejects reserved words for users, inactive admins and deleted admins despite forged capabilities', async () => {
  for (const identity of [
    { role: 'user' }, { role: 'manager' }, { status: 'inactive' }, { status: 'banned' },
    { status: 'withdrawn' }, { deletedAt: new Date() },
  ]) {
    const f = fixture(identity)
    assert.equal((await (await f.get()).json()).user.isOfficialAdmin, false)
    for (const nickname of ['관리자', '운영진', 'SuperAdmin']) {
      const response = await f.put({ nickname, isOfficialAdmin: true, role: 'admin', status: 'active', deletedAt: null })
      assert.equal(response.status, 400)
    }
    assert.equal(f.writes(), 0)
  }
})

test('profile save checks current database identity after administrator privileges change', async () => {
  const f = fixture()
  assert.equal((await (await f.get()).json()).user.isOfficialAdmin, true)
  f.setIdentity({ role: 'user' })
  assert.equal((await f.put({ nickname: '관리자', isOfficialAdmin: true })).status, 400)
  assert.equal(f.writes(), 0)
})

test('admin exception keeps required input, length, character and uniqueness validation', async () => {
  const f = fixture()
  for (const nickname of [null, {}, 42, '', '   ', 'a', 'admin!', '관 리자']) {
    assert.equal((await f.put({ nickname })).status, 400)
  }
  assert.equal(f.writes(), 0)
  const duplicate = fixture({}, true)
  assert.equal((await duplicate.put({ nickname: '관리자' })).status, 400)
  assert.equal(duplicate.writes(), 0)
  assert.equal((await fixture({ role: 'user' }).put({ nickname: '일반회원' })).status, 200)
})
