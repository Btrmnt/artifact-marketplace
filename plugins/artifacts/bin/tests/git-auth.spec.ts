// Unit test for the env-based git auth shim (Finding #2). The integration
// path is exercised via the publish/promote/project-new specs against a
// local bare repo (file:// URL), which doesn't actually consume the
// extraHeader. The defence here is process-listing isolation, so the test
// that matters is: token is in env, never on argv.

import { describe, expect, it } from 'vitest'
import { gitAuthEnv } from '../src/git-auth.js'

describe('gitAuthEnv', () => {
  const TOKEN = 'jwt.payload.sig'
  const env = gitAuthEnv(TOKEN)

  it('declares two http.extraHeader entries via GIT_CONFIG_*', () => {
    expect(env.GIT_CONFIG_COUNT).toBe('2')
    expect(env.GIT_CONFIG_KEY_0).toBe('http.extraHeader')
    expect(env.GIT_CONFIG_KEY_1).toBe('http.extraHeader')
  })

  it('carries both the cookie and the assertion variants of the JWT', () => {
    expect(env.GIT_CONFIG_VALUE_0).toBe(`Cookie: CF_Authorization=${TOKEN}`)
    expect(env.GIT_CONFIG_VALUE_1).toBe(`Cf-Access-Jwt-Assertion: ${TOKEN}`)
  })

  it('disables git terminal prompts so a rejected token fails fast', () => {
    expect(env.GIT_TERMINAL_PROMPT).toBe('0')
  })
})
