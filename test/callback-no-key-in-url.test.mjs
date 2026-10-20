import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcCallback = readFileSync(
  join(import.meta.dirname, '..', 'src', 'app', 'auth', 'callback', 'page.tsx'),
  'utf8'
)

const srcDashboard = readFileSync(
  join(import.meta.dirname, '..', 'src', 'app', 'dashboard', 'DashboardContent.tsx'),
  'utf8'
)

test('the callback never puts the API key in the redirect URL', () => {
  assert.doesNotMatch(srcCallback, /router\.push\([^)]*\?key=/)
  assert.doesNotMatch(srcCallback, /encodeURIComponent\(apiKey\)/)
})

test('the dashboard does not read the API key from the URL query string', () => {
  assert.doesNotMatch(srcDashboard, /searchParams\.get\(\s*['"]key['"]\s*\)/)
  assert.doesNotMatch(srcDashboard, /get\(\s*['"]key['"]\s*\)/)
})
