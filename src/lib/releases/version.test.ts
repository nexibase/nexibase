import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareVersions, getVersionStatus, normalizeVersion } from './version'

test('an older cached release never announces an available update', () => {
  assert.equal(getVersionStatus('0.33.1', '0.33.0'), 'ahead')
  assert.equal(getVersionStatus('0.33.1', '0.33.1'), 'current')
  assert.equal(getVersionStatus('0.33.1', '0.33.2'), 'update')
})
test('core version numbers use numeric rather than text ordering', () => {
  for (const [higher, lower] of [['0.33.10', '0.33.9'], ['0.34.0', '0.33.99'], ['1.0.0', '0.99.99'],
    ['9007199254740993.0.0', '9007199254740992.0.0']]) {
    assert.equal(compareVersions(higher, lower), 1)
    assert.equal(compareVersions(lower, higher), -1)
  }
})
test('stable and prerelease versions follow identifier precedence', () => {
  const versions = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta',
    '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0']
  for (let i = 1; i < versions.length; i++) assert.equal(compareVersions(versions[i], versions[i - 1]), 1)
})
test('v prefixes and build metadata do not turn the same version into an update', () => {
  assert.equal(getVersionStatus('v0.33.1+local', '0.33.1+release'), 'current')
  assert.equal(normalizeVersion('  v0.33.1  '), '0.33.1')
})
test('malformed or unavailable versions cannot produce an update notification', () => {
  for (const invalid of ['', 'latest', '0.33', '01.2.3', '1.02.3', '1.2.3-01', '1.2.3-', '1.2.3+', '1.2.3.4']) {
    assert.equal(normalizeVersion(invalid), null)
    assert.equal(getVersionStatus('0.33.1', invalid), 'unknown')
    assert.equal(getVersionStatus(invalid, '0.33.2'), 'unknown')
  }
  assert.equal(normalizeVersion(null), null)
})
