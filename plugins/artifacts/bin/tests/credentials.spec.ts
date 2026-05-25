// W2d test: credentials file location & permissions.
//
//   1. BTRMNT_TEST_CREDS_FILE set -> that exact path.
//   2. Otherwise -> ~/.btrmnt/credentials.json (we override HOME for the test
//      to a temp dir).
//   3. File mode is 0600 after `btrmnt login`. The credentials file is
//      written using fs.writeFile + chmod 0600.
//
// The login flow is the OAuth 2.0 Device Authorization Grant. We stand up a
// tiny mock api that immediately approves the device on the first poll, so
// the suite reaches the credentials-write path quickly.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { freshTempDir, runCli } from './_helpers.js'
import { createServer, type Server } from 'node:http'

let mockApi: Server | null = null
let mockApiPort = 0
let mockApiToken = 'tok_credentials_spec'

beforeEach(async () => {
  mockApi = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${mockApiPort}`)
    if (req.method === 'POST' && url.pathname === '/auth/device') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          device_code: 'dc_creds_spec',
          user_code: 'ABCD-EFGH',
          verification_uri: `http://127.0.0.1:${mockApiPort}/device`,
          verification_uri_complete: `http://127.0.0.1:${mockApiPort}/device?user_code=ABCD-EFGH`,
          expires_in: 600,
          interval: 1,
        }),
      )
      return
    }
    if (req.method === 'POST' && url.pathname === '/auth/token') {
      // Always approve immediately — these specs care about the
      // credentials-write path, not the polling state machine.
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          token: mockApiToken,
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
  mockApiToken = 'tok_credentials_spec'
})

afterEach(async () => {
  if (mockApi) await new Promise<void>((r) => mockApi!.close(() => r()))
  mockApi = null
})

async function driveLogin(env: NodeJS.ProcessEnv): Promise<{ code: number; credsPath: string }> {
  const result = await runCli(
    [
      'login',
      '--api-endpoint',
      `http://127.0.0.1:${mockApiPort}`,
      '--poll-interval-ms',
      '20',
      '--timeout-ms',
      '5000',
    ],
    { ...env, BTRMNT_TEST_DISABLE_BROWSER: '1' },
  )
  return {
    code: result.code,
    credsPath: result.json && (result.json as { credentials_path?: string }).credentials_path!,
  }
}

describe('credentials file location', () => {
  it('writes to BTRMNT_TEST_CREDS_FILE when set', async () => {
    const dir = freshTempDir('creds-')
    const credsPath = resolve(dir, 'credentials.json')
    const { code, credsPath: written } = await driveLogin({ BTRMNT_TEST_CREDS_FILE: credsPath })
    expect(code).toBe(0)
    expect(written).toBe(credsPath)
    expect(existsSync(credsPath)).toBe(true)
  })

  it('falls back to $HOME/.btrmnt/credentials.json when no override is set', async () => {
    const home = freshTempDir('fake-home-')
    const { code, credsPath } = await driveLogin({ HOME: home })
    expect(code).toBe(0)
    expect(credsPath).toBe(resolve(home, '.btrmnt', 'credentials.json'))
    expect(existsSync(credsPath)).toBe(true)
  })

  it('writes the credentials file with mode 0600', async () => {
    const dir = freshTempDir('creds-')
    const credsPath = resolve(dir, 'credentials.json')
    const { code, credsPath: written } = await driveLogin({ BTRMNT_TEST_CREDS_FILE: credsPath })
    expect(code).toBe(0)
    const mode = statSync(written).mode & 0o777
    expect(mode).toBe(0o600)
    const contents = JSON.parse(readFileSync(written, 'utf-8')) as {
      api_endpoint?: string
      token?: string
    }
    expect(contents.api_endpoint).toBe(`http://127.0.0.1:${mockApiPort}`)
    expect(contents.token).toBe(mockApiToken)
  })

  it('overwrites a pre-existing 0o644 file atomically, ending mode 0600', async () => {
    // Pre-seed a credentials file with loose perms (simulating a $HOME with
    // a permissive umask). After login the file must be 0600, the contents
    // must be the freshly-issued ones, and no `.tmp.*` litter must remain.
    const dir = freshTempDir('creds-')
    mkdirSync(dir, { recursive: true })
    const credsPath = resolve(dir, 'credentials.json')
    writeFileSync(
      credsPath,
      JSON.stringify({ api_endpoint: 'http://stale', token: 'stale', expires_at: null }),
      { mode: 0o644 },
    )

    const { code, credsPath: written } = await driveLogin({
      BTRMNT_TEST_CREDS_FILE: credsPath,
    })
    expect(code).toBe(0)
    expect(written).toBe(credsPath)
    const mode = statSync(credsPath).mode & 0o777
    expect(mode).toBe(0o600)
    const contents = JSON.parse(readFileSync(credsPath, 'utf-8')) as { token: string }
    expect(contents.token).toBe(mockApiToken)

    // No leftover .tmp.* files in the same directory.
    const leftovers = readdirSync(dir).filter((f) => f.includes('.tmp.'))
    expect(leftovers).toEqual([])
  })

  it('whoami refuses to read a credentials file with overly permissive mode', async () => {
    const dir = freshTempDir('creds-')
    mkdirSync(dir, { recursive: true })
    const credsPath = resolve(dir, 'credentials.json')
    writeFileSync(
      credsPath,
      JSON.stringify({ api_endpoint: 'http://x', token: 't', expires_at: null }),
      { mode: 0o644 },
    )
    const result = await runCli(['whoami'], { BTRMNT_TEST_CREDS_FILE: credsPath })
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/permissions|mode|0600/i)
    rmSync(dir, { recursive: true, force: true })
  })
})
