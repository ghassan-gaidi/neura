import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

test('npm test script is defined', () => {
  const pkg = JSON.parse(execFileSync('npm', ['pkg', 'get'], { encoding: 'utf8' }))
  assert.ok(pkg.scripts.test, 'package.json must define a test script')
})
