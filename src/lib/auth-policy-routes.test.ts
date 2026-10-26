import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import ts from 'typescript'
import { resolveAuthPolicy, canRegister } from './auth-policy'
import { nicknamePolicyError } from './nickname-policy'

const require = createRequire(import.meta.url)

function fixture() {
  let settings: Record<string, string> = {}
  let existing = true
  let writes = 0
  const user = { id: 1, email: 'member@example.invalid', nickname: '회원', password: 'hash', status: 'active', deletedAt: null }
  const prisma = {
    user: {
      findUnique: async () => existing ? user : null,
      findFirst: async () => null,
      count: async () => 1,
      update: async () => user,
      create: async () => { writes++; return user },
    },
    account: { findUnique: async () => null },
    loginAttempt: { findFirst: async () => null, count: async () => 0, create: async () => ({}) },
  }
  const dependencies: Record<string, unknown> = {
    'next/server': require('next/server'),
    '@/lib/prisma': { prisma },
    '@/lib/auth-policy-server': { getAuthPolicy: async () => resolveAuthPolicy(settings) },
    '@/lib/auth-policy': { canRegister },
    '@/lib/nickname-policy': { nicknamePolicyError },
    '@/lib/auth-adapter': { CustomPrismaAdapter: () => ({}) },
    'bcryptjs': { compare: async () => true, hash: async () => 'hash' },
    'next-auth/jwt': { encode: async () => 'test-session' },
    '@/lib/auth-options': { authOptions: {} },
  }
  function load(file: string) {
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    // These tests exercise real handlers with only external boundaries replaced.
    const module = { exports: {} as any }
    new Function('require', 'module', 'exports', source)((id: string) => {
      if (id in dependencies) return dependencies[id]
      if (id.startsWith('next-auth/providers/')) return require(id)
      throw new Error(`Unexpected dependency: ${id}`)
    }, module, module.exports)
    return module.exports
  }
  const signup = load('src/app/api/members/route.ts').POST
  const login = load('src/app/api/auth/login/route.ts').POST
  const options = load('src/lib/auth-options.ts').authOptions
  const credentials = options.providers.find((p: { id: string }) => p.id === 'credentials').options.authorize
  const request = () => new Request('https://example.invalid/api/members', {
    method: 'POST', body: JSON.stringify({ email: user.email, password: 'test-password', nickname: '새회원' }),
    headers: { 'Content-Type': 'application/json' },
  })
  return {
    settings: (value: Record<string, string>) => { settings = value },
    existing: (value: boolean) => { existing = value },
    signup: () => signup(request()), login: () => login(request()),
    credentials: () => credentials({ email: user.email, password: 'test-password' }),
    social: () => options.callbacks.signIn({ user: { email: user.email }, account: { provider: 'google', providerAccountId: 'social-member' } }),
    writes: () => writes,
  }
}

test('direct email signup is blocked before writing while social signup and existing email login work', async () => {
  const f = fixture()
  f.settings({ social_signup_only: 'true', email_login_enabled: 'true' })
  f.existing(false)
  assert.equal((await f.signup()).status, 403)
  assert.equal(f.writes(), 0)
  assert.equal(await f.social(), true)
  f.existing(true)
  const response = await f.login()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie')!, /next-auth.session-token/)
  assert.equal((await f.credentials()).email, 'member@example.invalid')
})

test('turning off email login blocks both password endpoints without blocking social login', async () => {
  const f = fixture()
  f.settings({ email_login_enabled: 'false' })
  assert.equal((await f.login()).status, 403)
  await assert.rejects(f.credentials(), /이메일 로그인이 비활성화/)
  assert.equal(await f.social(), true)
})

test('closing signup blocks new email and OAuth members but allows existing OAuth members', async () => {
  const f = fixture()
  f.settings({ signup_enabled: 'false' })
  f.existing(false)
  assert.equal((await f.signup()).status, 403)
  assert.equal(await f.social(), '/login?error=SignupDisabled')
  assert.equal(f.writes(), 0)
  f.existing(true)
  assert.equal(await f.social(), true)
})

test('turning social-only off reopens the email signup handler', async () => {
  const f = fixture()
  f.existing(false)
  f.settings({ social_signup_only: 'true' })
  assert.equal((await f.signup()).status, 403)
  f.settings({ social_signup_only: 'false' })
  assert.equal((await f.signup()).status, 201)
  assert.equal(f.writes(), 1)
})
