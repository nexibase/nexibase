import test from 'node:test'
import assert from 'node:assert/strict'
import { getMobileShowcaseMenu } from './showcase-navigation'

const menu = { url: '/boards/showcase', label: '사이트 사례', target: '_blank', isActive: true, visibility: 'all' }

test('the mobile shortcut retains the configured label and target', () => {
  assert.equal(getMobileShowcaseMenu([menu], null), menu)
})

test('an absent or disabled menu does not create a mobile shortcut', () => {
  assert.equal(getMobileShowcaseMenu([], null), undefined)
  assert.equal(getMobileShowcaseMenu([{ ...menu, isActive: false }], null), undefined)
  assert.equal(getMobileShowcaseMenu([{ ...menu, url: '/boards/free' }], null), undefined)
})

test('a member-only menu is hidden from guests', () => {
  const memberMenu = { ...menu, visibility: 'member' }
  assert.equal(getMobileShowcaseMenu([memberMenu], null), undefined)
  assert.equal(getMobileShowcaseMenu([memberMenu], { role: 'user' }), memberMenu)
})

test('an administrator-only menu is restricted to administrators', () => {
  const adminMenu = { ...menu, visibility: 'admin' }
  assert.equal(getMobileShowcaseMenu([adminMenu], null), undefined)
  assert.equal(getMobileShowcaseMenu([adminMenu], { role: 'user' }), undefined)
  assert.equal(getMobileShowcaseMenu([adminMenu], { role: 'admin' }), adminMenu)
})
