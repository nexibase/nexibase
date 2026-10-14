import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasReservedNickname, nicknamePolicyError, normalizeNicknameForInspection, safeSocialNickname } from './nickname-policy'
import { isOfficialAdmin } from './admin-identity'

test('blocks reserved substrings including Unicode and spacing evasions', () => {
  for (const name of ['관리자', '관리팀', '사이트운영', '운영진', 'admin', 'Admin', 'ADMIN', 'SuperAdmin', 'administrator', '관 리자', '운\u200b영', 'a d m i n', 'ＡＤＭＩＮ', 'a\u2060d\u200bm\uFEFFin', '관\u200b리', 'a\nd\tm\ri\nn']) {
    assert.equal(hasReservedNickname(name), true, name)
    assert.ok(nicknamePolicyError(name), name)
  }
})

test('preserves normal nicknames and rejects malformed input without throwing', () => {
  for (const name of ['구공탄', '홍길동', 'Alice123', '회원42', 'Jane Doe', 'Ｆｒｅｄ']) {
    assert.equal(nicknamePolicyError(name), null, name)
    assert.equal(safeSocialNickname(name, '회원42'), name)
  }
  for (const value of [null, undefined, {}, 42, '', '   ']) assert.ok(nicknamePolicyError(value))
  assert.equal(normalizeNicknameForInspection('ＡＤＭＩＮ'), 'admin')
})

test('OAuth gets a neutral nickname instead of a reserved provider display name', () => {
  assert.equal(safeSocialNickname('Administrator', '회원42'), '회원42')
  assert.equal(safeSocialNickname('구공탄', '회원42'), '구공탄')
})

test('only active, non-deleted admin role earns the official badge', () => {
  const base = { role: 'admin', status: 'active', deletedAt: null }
  assert.equal(isOfficialAdmin(base), true)
  for (const role of ['user', 'manager', 'moderator', 'ADMIN']) assert.equal(isOfficialAdmin({ ...base, role }), false)
  for (const status of ['inactive', 'banned', 'withdrawn']) assert.equal(isOfficialAdmin({ ...base, status }), false)
  assert.equal(isOfficialAdmin({ ...base, deletedAt: new Date() }), false)
})
