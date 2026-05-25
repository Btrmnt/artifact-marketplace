// W2d test: `btrmnt login` (OAuth 2.0 Device Authorization Grant).
//
// We stand up a small in-memory mock api that implements RFC 8628:
//
//   POST /auth/device  -> { device_code, user_code, verification_uri, ...,
//                           expires_in, interval }
//   POST /auth/token   -> repeats `authorization_pending` until the test
//                         flips the record to approved; then 200 with the
//                         JWT.
//
// The CLI must:
//   - print an `awaiting_authorization` JSON line on stderr containing the
//     verification URI + user_code (so headless callers can read it)
//   - try to open the system browser (we set BTRMNT_TEST_DISABLE_BROWSER=1
//     so the shell-out is a no-op)
//   - poll /auth/token until success or terminal error
//   - persist {api_endpoint, token, expires_at} to credentials mode 0600
//   - print success JSON to stdout, exit 0
//
// A timeout (--timeout-ms) and a poll interval (--poll-interval-ms) are
// honoured so the test runs in <1s rather than waiting for the real 2s
// interval.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, type Server } from 'node:http'
import { freshTempDir, runCli } from './_helpers.js'

let mockApi: Server | null = null
let mockApiPort = 0

interface MockState {
  /** Persisted device-auth records, keyed by device_code. */
  records: Map<
    string,
    {
      user_code: string
      status: 'pending' | 'approved'
      token: string | null
      pollsSeen: number
      slowDownNextPoll: boolean
    }
  >
  /** Token handed out on the next approval. */
  nextToken: string
  /** Override returned by POST /auth/device. Useful per-test. */
  nextInit: Partial<{
    expires_in: number
    interval: number
    user_code: string
  }>
}

let state: MockState

function resetState() {
  state = {
    records: new Map(),
    nextToken: 'tok_device_spec_abc',
    nextInit: {},
  }
}

function randomBase64Url(n: number): string {
  let out = ''
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

beforeEach(async () => {
  resetState()
  mockApi = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${mockApiPort}`)
    if (req.method === 'POST' && url.pathname === '/auth/device') {
      const deviceCode = `dc_${randomBase64Url(24)}`
      const userCode = state.nextInit.user_code ?? 'ABCD-EFGH'
      state.records.set(deviceCode, {
        user_code: userCode,
        status: 'pending',
        token: null,
        pollsSeen: 0,
        slowDownNextPoll: false,
      })
      const expiresIn = state.nextInit.expires_in ?? 600
      const interval = state.nextInit.interval ?? 2
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          device_code: deviceCode,
          user_code: userCode,
          verification_uri: `http://127.0.0.1:${mockApiPort}/device`,
          verification_uri_complete: `http://127.0.0.1:${mockApiPort}/device?user_code=${encodeURIComponent(userCode)}`,
          expires_in: expiresIn,
          interval,
        }),
      )
      return
    }
    if (req.method === 'POST' && url.pathname === '/auth/token') {
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(c as Buffer)
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as { device_code?: string }
      const rec = body.device_code ? state.records.get(body.device_code) : undefined
      if (!rec) {
        res.statusCode = 400
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'expired_token' }))
        return
      }
      rec.pollsSeen += 1
      if (rec.slowDownNextPoll) {
        rec.slowDownNextPoll = false
        res.statusCode = 400
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'slow_down', interval: 1 }))
        return
      }
      if (rec.status === 'pending') {
        res.statusCode = 400
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'authorization_pending' }))
        return
      }
      // Approved.
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          token: rec.token,
          expires_at: '2099-01-01T00:00:00.000Z',
          api_endpoint: `http://127.0.0.1:${mockApiPort}`,
        }),
      )
      return
    }
    res.statusCode = 404
    res.end()
  })
  await new Promise<void>((r) => mockApi!.listen(0, '127.0.0.1', () => r()))
  mockApiPort = (mockApi!.address() as { port: number }).port
})

afterEach(async () => {
  if (mockApi) await new Promise<void>((r) => mockApi!.close(() => r()))
  mockApi = null
})

/**
 * Wait for the mock api to see at least one device_code and approve it with
 * `state.nextToken`. Polls every 5ms with a short ceiling so the test
 * doesn't hang if the CLI hasn't actually started yet.
 */
async function approveWhenSeen(): Promise<void> {
  const deadline = Date.now() + 2000
  while (Date.now() < deadline) {
    const entries = [...state.records.entries()]
    if (entries.length > 0) {
      const [, rec] = entries[0]!
      rec.status = 'approved'
      rec.token = state.nextToken
      return
    }
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error('mock api never saw a /auth/device request')
}

describe('btrmnt login (device flow)', () => {
  // Regression: in sandboxed Linux environments (Cowork, CI runners) the
  // browser opener (`xdg-open`) is absent. The async `error` event from
  // `child_process.spawn` used to become an uncaught exception that killed
  // the CLI right after the `awaiting_authorization` line was flushed —
  // before any poll happened. The user's only signal was an empty stdout
  // and a process that vanished. We force the spawn target to a missing
  // binary via BTRMNT_TEST_BROWSER_CMD; the CLI must still poll, get the
  // approval, and write credentials.
  it('survives a missing browser opener (ENOENT on spawn)', async () => {
    const credsPath = resolve(freshTempDir('creds-'), 'credentials.json')
    const run = runCli(
      [
        'login',
        '--api-endpoint',
        `http://127.0.0.1:${mockApiPort}`,
        '--poll-interval-ms',
        '20',
        '--timeout-ms',
        '5000',
      ],
      {
        BTRMNT_TEST_CREDS_FILE: credsPath,
        BTRMNT_TEST_BROWSER_CMD: '/__btrmnt_no_such_binary__',
      },
    )
    await run.waitForStderr((l) => l.includes('awaiting_authorization'))
    await approveWhenSeen()
    const result = await run
    expect(result.code).toBe(0)
    expect(existsSync(credsPath)).toBe(true)
  })

  it('happy path: prints user_code+URL on stderr, persists token, exits 0, mode 0600', async () => {
    const credsPath = resolve(freshTempDir('creds-'), 'credentials.json')
    state.nextToken = 'tok_device_spec_abc'
    const run = runCli(
      [
        'login',
        '--api-endpoint',
        `http://127.0.0.1:${mockApiPort}`,
        '--poll-interval-ms',
        '20',
        '--timeout-ms',
        '5000',
      ],
      { BTRMNT_TEST_CREDS_FILE: credsPath, BTRMNT_TEST_DISABLE_BROWSER: '1' },
    )

    // The CLI emits an `awaiting_authorization` JSON line on stderr right
    // after /auth/device. Wait for it before flipping the record to
    // approved — that proves the CLI got far enough to display the code.
    const awaitingLine = await run.waitForStderr((l) => l.includes('awaiting_authorization'))
    const awaiting = JSON.parse(awaitingLine) as {
      status: string
      verification_uri: string
      user_code: string
      hint: string
    }
    expect(awaiting.status).toBe('awaiting_authorization')
    expect(awaiting.user_code).toBe('ABCD-EFGH')
    expect(awaiting.verification_uri).toBe(`http://127.0.0.1:${mockApiPort}/device`)
    expect(awaiting.hint).toContain('ABCD-EFGH')

    // Simulate the user approving in the browser.
    await approveWhenSeen()

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
    expect(contents.token).toBe('tok_device_spec_abc')
    expect(contents.expires_at).toBeNull() // opaque token, not a real JWT
    const out = result.json as { ok?: boolean; credentials_path?: string }
    expect(out.ok).toBe(true)
    expect(out.credentials_path).toBe(credsPath)
  })

  it('decodes expires_at from the JWT exp claim when the token is a real JWT', async () => {
    const exp = Math.floor(Date.UTC(2099, 0, 1) / 1000)
    const b64url = (s: string) =>
      Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    const payload = b64url(JSON.stringify({ exp }))
    state.nextToken = `${header}.${payload}.`
    const credsPath = resolve(freshTempDir('creds-'), 'credentials.json')
    const run = runCli(
      [
        'login',
        '--api-endpoint',
        `http://127.0.0.1:${mockApiPort}`,
        '--poll-interval-ms',
        '20',
        '--timeout-ms',
        '5000',
      ],
      { BTRMNT_TEST_CREDS_FILE: credsPath, BTRMNT_TEST_DISABLE_BROWSER: '1' },
    )
    await run.waitForStderr((l) => l.includes('awaiting_authorization'))
    await approveWhenSeen()
    const result = await run
    expect(result.code).toBe(0)
    const contents = JSON.parse(readFileSync(credsPath, 'utf-8')) as {
      token: string
      expires_at: string | null
    }
    expect(contents.token).toBe(state.nextToken)
    expect(contents.expires_at).toBe(new Date(exp * 1000).toISOString())
  })

  it('backs off on slow_down then succeeds when approved', async () => {
    state.nextInit = { interval: 1 }
    const credsPath = resolve(freshTempDir('creds-'), 'credentials.json')
    const run = runCli(
      [
        'login',
        '--api-endpoint',
        `http://127.0.0.1:${mockApiPort}`,
        '--poll-interval-ms',
        '20',
        '--timeout-ms',
        '5000',
      ],
      { BTRMNT_TEST_CREDS_FILE: credsPath, BTRMNT_TEST_DISABLE_BROWSER: '1' },
    )
    await run.waitForStderr((l) => l.includes('awaiting_authorization'))
    // Trip slow_down on the *first* poll the CLI makes.
    const deadline = Date.now() + 1000
    while (Date.now() < deadline) {
      const entries = [...state.records.entries()]
      if (entries.length) {
        entries[0]![1].slowDownNextPoll = true
        break
      }
      await new Promise((r) => setTimeout(r, 5))
    }
    await approveWhenSeen()
    const result = await run
    expect(result.code).toBe(0)
    expect(existsSync(credsPath)).toBe(true)
  })

  it('fails fast on terminal errors (expired_token) without writing credentials', async () => {
    const credsPath = resolve(freshTempDir('creds-'), 'credentials.json')
    const run = runCli(
      [
        'login',
        '--api-endpoint',
        `http://127.0.0.1:${mockApiPort}`,
        '--poll-interval-ms',
        '20',
        '--timeout-ms',
        '5000',
      ],
      { BTRMNT_TEST_CREDS_FILE: credsPath, BTRMNT_TEST_DISABLE_BROWSER: '1' },
    )
    // Wait for the CLI to print the awaiting line — proves it called
    // /auth/device successfully. Then wipe the record so the first poll
    // gets `expired_token`. The mock returns that for any unknown
    // device_code, which simulates the server having garbage-collected
    // the record between the call and the first poll.
    await run.waitForStderr((l) => l.includes('awaiting_authorization'))
    state.records.clear()
    const result = await run
    expect(result.code).not.toBe(0)
    expect(existsSync(credsPath)).toBe(false)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/expired_token/)
  })

  it('times out cleanly when the user never approves', async () => {
    const credsPath = resolve(freshTempDir('creds-'), 'credentials.json')
    const result = await runCli(
      [
        'login',
        '--api-endpoint',
        `http://127.0.0.1:${mockApiPort}`,
        '--poll-interval-ms',
        '20',
        '--timeout-ms',
        '300',
      ],
      { BTRMNT_TEST_CREDS_FILE: credsPath, BTRMNT_TEST_DISABLE_BROWSER: '1' },
    )
    expect(result.code).not.toBe(0)
    expect(existsSync(credsPath)).toBe(false)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/timed out|timeout/i)
  })
})
