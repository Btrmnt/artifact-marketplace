// W2d test: API endpoint resolution order.
//
// Order from highest to lowest precedence:
//   1. --api-endpoint flag
//   2. BTRMNT_API_ENDPOINT env var
//   3. CLAUDE_PLUGIN_OPTION_API_ENDPOINT env var (Claude Code injects this
//      from the plugin's userConfig.api_endpoint)
//   4. Hard default https://api.btrmntlab.com
//
// We probe via `btrmnt whoami`, which prints the resolved endpoint as part of
// its error envelope when no creds are present (auth check happens AFTER
// config resolution).

import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runCli, freshTempDir } from './_helpers.js'

function emptyCredsEnv(): NodeJS.ProcessEnv {
  return { BTRMNT_TEST_CREDS_FILE: resolve(freshTempDir(), 'creds.json') }
}

function writeCredsFile(endpoint: string): string {
  const dir = freshTempDir('creds-')
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, 'credentials.json')
  writeFileSync(
    path,
    JSON.stringify({ api_endpoint: endpoint, token: 't', expires_at: null }),
    { mode: 0o600 },
  )
  return path
}

describe('api endpoint resolution', () => {
  it('uses the hard default when nothing is set', async () => {
    const result = await runCli(['whoami'], emptyCredsEnv())
    expect(result.code).not.toBe(0)
    const parsed = JSON.parse(result.stderr.trim().split('\n').pop()!) as {
      api_endpoint?: string
    }
    expect(parsed.api_endpoint).toBe('https://api.btrmntlab.com')
  })

  it('CLAUDE_PLUGIN_OPTION_API_ENDPOINT overrides the default', async () => {
    const result = await runCli(['whoami'], {
      ...emptyCredsEnv(),
      CLAUDE_PLUGIN_OPTION_API_ENDPOINT: 'http://plugin-option:1234',
    })
    expect(result.code).not.toBe(0)
    const parsed = JSON.parse(result.stderr.trim().split('\n').pop()!) as {
      api_endpoint?: string
    }
    expect(parsed.api_endpoint).toBe('http://plugin-option:1234')
  })

  it('BTRMNT_API_ENDPOINT overrides CLAUDE_PLUGIN_OPTION_API_ENDPOINT', async () => {
    const result = await runCli(['whoami'], {
      ...emptyCredsEnv(),
      CLAUDE_PLUGIN_OPTION_API_ENDPOINT: 'http://plugin-option:1234',
      BTRMNT_API_ENDPOINT: 'http://env-var:5678',
    })
    expect(result.code).not.toBe(0)
    const parsed = JSON.parse(result.stderr.trim().split('\n').pop()!) as {
      api_endpoint?: string
    }
    expect(parsed.api_endpoint).toBe('http://env-var:5678')
  })

  it('--api-endpoint flag wins over everything', async () => {
    const result = await runCli(['whoami', '--api-endpoint', 'http://flag:9999'], {
      ...emptyCredsEnv(),
      CLAUDE_PLUGIN_OPTION_API_ENDPOINT: 'http://plugin-option:1234',
      BTRMNT_API_ENDPOINT: 'http://env-var:5678',
    })
    expect(result.code).not.toBe(0)
    const parsed = JSON.parse(result.stderr.trim().split('\n').pop()!) as {
      api_endpoint?: string
    }
    expect(parsed.api_endpoint).toBe('http://flag:9999')
  })
})

describe('api endpoint validation', () => {
  it('refuses http:// against a non-loopback host', async () => {
    // A stored, valid creds file means the validator now matters — without
    // it the CLI would error on missing creds before reaching ApiClient.
    const credsPath = writeCredsFile('http://attacker.example')
    const result = await runCli(['whoami'], { BTRMNT_TEST_CREDS_FILE: credsPath })
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/api_endpoint|endpoint|https/i)
  })

  it('refuses a host outside the allowlist even on https', async () => {
    const credsPath = writeCredsFile('https://attacker.example')
    const result = await runCli(['whoami'], { BTRMNT_TEST_CREDS_FILE: credsPath })
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/allowlist|allow/i)
  })

  it('accepts http://127.0.0.1 (loopback bypass for tests/dev)', async () => {
    // We hit a port that nothing listens on — the validator must allow the
    // URL through, and the failure should be a connection/fetch error,
    // not a config-validation error.
    const credsPath = writeCredsFile('http://127.0.0.1:1')
    const result = await runCli(['whoami'], { BTRMNT_TEST_CREDS_FILE: credsPath })
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).not.toMatch(/allowlist|https/i)
  })

  it('BTRMNT_ALLOW_UNKNOWN_HOST opt-in lets a self-hosted host through', async () => {
    const credsPath = writeCredsFile('https://api.self-hosted.internal')
    const result = await runCli(['whoami'], {
      BTRMNT_TEST_CREDS_FILE: credsPath,
      BTRMNT_ALLOW_UNKNOWN_HOST: '1',
    })
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    // Should now fail on something other than the allowlist rule (DNS,
    // connection refused, etc).
    expect(err.error).not.toMatch(/allowlist/i)
  })
})
