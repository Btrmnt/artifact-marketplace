// W2d test: `btrmnt login`
//
// We spin up a tiny in-memory mock api that:
//   - returns a 302 from /auth/start to <cb>?token=...  (the value is the
//     raw CF Access JWT — CF Access has already authenticated the user)
//
// The CLI must:
//   - bring up a local HTTP listener on a random ephemeral port
//   - "open" a browser to <api>/auth/start?cb=http://127.0.0.1:<port>/callback
//     (in tests we set BTRMNT_TEST_DISABLE_BROWSER=1 so it prints AUTH_URL=<url>
//     to stderr instead, and the test fetches the URL to drive the dance)
//   - receive GET /callback?token=... on the local listener
//   - persist the token to the resolved credentials path mode 0600
//   - decode the JWT `exp` claim into expires_at when present
//   - print success JSON to stdout, exit 0
//
// A timeout (passed as a flag for the test) should produce a clean JSON error.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, type Server } from 'node:http'
import { freshTempDir, runCli } from './_helpers.js'

let mockApi: Server | null = null
let mockApiPort = 0
let mockToken = 'tok_login_spec_abc'
let lastCallback = ''

beforeEach(async () => {
  mockApi = createServer((req, res) => {
    const url = new URL(req.url!, `http://127.0.0.1:${mockApiPort}`)
    if (url.pathname === '/auth/start') {
      const cb = url.searchParams.get('cb')!
      const state = url.searchParams.get('state') ?? ''
      lastCallback = cb
      res.statusCode = 302
      res.setHeader(
        'Location',
        `${cb}?token=${encodeURIComponent(mockToken)}&state=${encodeURIComponent(state)}`,
      )
      res.end()
      return
    }
    res.statusCode = 404
    res.end()
  })
  await new Promise<void>((r) => mockApi!.listen(0, '127.0.0.1', () => r()))
  mockApiPort = (mockApi!.address() as { port: number }).port
  lastCallback = ''
  mockToken = 'tok_login_spec_abc'
})

afterEach(async () => {
  if (mockApi) await new Promise<void>((r) => mockApi!.close(() => r()))
  mockApi = null
})

/** Build a minimal unsigned JWT with the given `exp` claim (seconds since epoch). */
function fakeJwt(exp: number): string {
  const b64url = (s: string) =>
    Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ exp }))
  return `${header}.${payload}.`
}

describe('btrmnt login', () => {
  it('happy path: persists token, exits 0, mode 0600', async () => {
    const credsPath = resolve(freshTempDir('creds-'), 'credentials.json')
    const run = runCli(
      ['login', '--api-endpoint', `http://127.0.0.1:${mockApiPort}`],
      { BTRMNT_TEST_CREDS_FILE: credsPath, BTRMNT_TEST_DISABLE_BROWSER: '1' },
    )
    const line = await run.waitForStderr((l) => l.includes('AUTH_URL='))
    const authUrl = line.split('AUTH_URL=')[1]!.trim()
    // start URL carries an opaque base64url-ish state nonce (CSRF protection).
    expect(authUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/auth\/start\?cb=http%3A%2F%2F127\.0\.0\.1%3A\d+%2Fcallback&state=[A-Za-z0-9_-]+$/,
    )
    // simulate browser
    const startResp = await fetch(authUrl, { redirect: 'manual' })
    expect(startResp.status).toBe(302)
    const cbUrl = startResp.headers.get('location')!
    const cbResp = await fetch(cbUrl)
    expect(cbResp.status).toBe(200)
    const body = await cbResp.text()
    // The success page should contain a hint that the tab can be closed.
    expect(body).toMatch(/close.*tab|close.*window|authenticated/i)

    const result = await run
    expect(result.code).toBe(0)
    expect(existsSync(credsPath)).toBe(true)
    const mode = statSync(credsPath).mode & 0o777
    expect(mode).toBe(0o600)
    const contents = JSON.parse(readFileSync(credsPath, 'utf-8')) as {
      api_endpoint: string
      token: string
      expires_at: string | null
    }
    expect(contents.api_endpoint).toBe(`http://127.0.0.1:${mockApiPort}`)
    expect(contents.token).toBe('tok_login_spec_abc')
    // Opaque token (not a JWT) -> expires_at is null, not a crash.
    expect(contents.expires_at).toBeNull()
    // success JSON to stdout
    const out = result.json as { ok?: boolean; credentials_path?: string }
    expect(out.ok).toBe(true)
    expect(out.credentials_path).toBe(credsPath)
  })

  it('decodes expires_at from the JWT exp claim when present', async () => {
    const exp = Math.floor(Date.UTC(2099, 0, 1) / 1000)
    mockToken = fakeJwt(exp)
    const credsPath = resolve(freshTempDir('creds-'), 'credentials.json')
    const run = runCli(
      ['login', '--api-endpoint', `http://127.0.0.1:${mockApiPort}`],
      { BTRMNT_TEST_CREDS_FILE: credsPath, BTRMNT_TEST_DISABLE_BROWSER: '1' },
    )
    const line = await run.waitForStderr((l) => l.includes('AUTH_URL='))
    const authUrl = line.split('AUTH_URL=')[1]!.trim()
    const startResp = await fetch(authUrl, { redirect: 'manual' })
    const cbUrl = startResp.headers.get('location')!
    await fetch(cbUrl)
    const result = await run
    expect(result.code).toBe(0)
    const contents = JSON.parse(readFileSync(credsPath, 'utf-8')) as {
      token: string
      expires_at: string | null
    }
    expect(contents.token).toBe(mockToken)
    expect(contents.expires_at).toBe(new Date(exp * 1000).toISOString())
  })

  it('rejects a callback whose state does not match', async () => {
    const credsPath = resolve(freshTempDir('creds-'), 'credentials.json')
    const run = runCli(
      ['login', '--api-endpoint', `http://127.0.0.1:${mockApiPort}`, '--timeout-ms', '2000'],
      { BTRMNT_TEST_CREDS_FILE: credsPath, BTRMNT_TEST_DISABLE_BROWSER: '1' },
    )
    const line = await run.waitForStderr((l) => l.includes('AUTH_URL='))
    const authUrl = line.split('AUTH_URL=')[1]!.trim()
    // Bypass /auth/start — hit the loopback callback directly with a token
    // and a state value that has nothing to do with the one the CLI minted.
    // This simulates a malicious local-origin (e.g. a tab the user happens
    // to have open) trying to inject its own JWT into the credentials file.
    const cbBase = new URL(authUrl).searchParams.get('cb')!
    const forged = new URL(cbBase)
    forged.searchParams.set('token', 'attacker_jwt')
    forged.searchParams.set('state', 'wrong-state-value')
    const cbResp = await fetch(forged.toString())
    expect(cbResp.status).toBe(400)

    const result = await run
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/state/i)
    // Credentials file must NOT have been written.
    expect(existsSync(credsPath)).toBe(false)
  })

  it('times out cleanly when no callback arrives', async () => {
    const credsPath = resolve(freshTempDir('creds-'), 'credentials.json')
    const result = await runCli(
      ['login', '--api-endpoint', `http://127.0.0.1:${mockApiPort}`, '--timeout-ms', '300'],
      { BTRMNT_TEST_CREDS_FILE: credsPath, BTRMNT_TEST_DISABLE_BROWSER: '1' },
    )
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/timeout|timed out/i)
  })
})
