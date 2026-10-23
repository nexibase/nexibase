import test from 'node:test'
import assert from 'node:assert/strict'
import { isRetiredSetting } from './settings-keys'

test('retired cookie settings and old form values cannot be restored', () => {
  for (const key of ['consent_enabled', 'consent_banner_version', 'consent_policy_slug', 'consent_future_flag']) {
    assert.equal(isRetiredSetting(key), true, key)
  }
})

test('site, analytics, and unrelated member settings remain available', () => {
  for (const key of ['site_name', 'google_analytics_id', 'ga4_property_id', 'signup_enabled']) {
    assert.equal(isRetiredSetting(key), false, key)
  }
})
