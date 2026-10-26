import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canRegister, resolveAuthPolicy } from './auth-policy'

test('upgrades preserve email registration and existing email login by default', () => {
  const policy = resolveAuthPolicy({})
  assert.equal(canRegister(policy, 'email'), true)
  assert.equal(canRegister(policy, 'social'), true)
  assert.equal(policy.emailLoginEnabled, true)
})

test('registration method and existing email login are independent across all toggle combinations', () => {
  for (const signup of [true, false]) {
    for (const socialOnly of [true, false]) {
      for (const emailLogin of [true, false]) {
        const policy = resolveAuthPolicy({
          signup_enabled: String(signup),
          social_signup_only: String(socialOnly),
          email_login_enabled: String(emailLogin),
        })
        assert.equal(canRegister(policy, 'email'), signup && !socialOnly)
        assert.equal(canRegister(policy, 'social'), signup)
        assert.equal(policy.emailLoginEnabled, emailLogin)
      }
    }
  }
})
