import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveAuthFromWindow } from './authSession.js'

function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    }
  }
}

test('reads the token from the URL fragment when the module opens directly', () => {
  const fakeWindow = {
    location: { href: 'https://reportes.example.com/dashboard#token=abc123' },
    parent: null,
    sessionStorage: createStorage(),
    localStorage: createStorage()
  }

  const result = resolveAuthFromWindow(fakeWindow)

  assert.equal(result.token, 'abc123')
  assert.equal(result.shouldCleanupUrl, true)
})

test('reads the token from the parent session when embedded inside the main app', () => {
  const parentSession = createStorage({ hostJwt: 'parent-token' })
  const parentLocal = createStorage({ userEmail: 'admin@empresa.com' })

  const fakeWindow = {
    location: { href: 'https://reportes.example.com/dashboard' },
    parent: {
      sessionStorage: parentSession,
      localStorage: parentLocal
    },
    sessionStorage: createStorage(),
    localStorage: createStorage()
  }

  const result = resolveAuthFromWindow(fakeWindow)

  assert.equal(result.token, 'parent-token')
  assert.equal(result.email, 'admin@empresa.com')
  assert.equal(result.shouldCleanupUrl, false)
})
