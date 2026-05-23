// W2d test: `btrmnt whoami`
//
// With creds pre-written, the CLI must:
//   - read the credentials file (mode 0600 enforced)
//   - call GET /v1/users/me with Cookie: CF_Authorization=<jwt>
//   - print {email, role, tenant, expires_at} as JSON
//   - User-Agent header is `btrmnt-plugin/<version>`

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { freshTempDir, runCli } from './_helpers.js'

interface ApiCall {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  body: string
}

let mockApi: Server | null = null
let mockApiPort = 0
let calls: ApiCall[] = []

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  })
}

beforeEach(async () => {
  calls = []
  mockApi = createServer(async (req, res) => {
    const body = await readBody(req)
    calls.push({ method: req.method!, url: req.url!, headers: req.headers, body })
    if (req.url === '/v1/users/me' && req.method === 'GET') {
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            email: 'alice@parc.example',
            created_at: '2026-05-01T00:00:00Z',
          },
          memberships: [
            {
              user_id: '11111111-1111-1111-1111-111111111111',
              tenant_id: '22222222-2222-2222-2222-222222222222',
              tenant_slug: 'parc',
              role: 'tenant_admin',
            },
          ],
        }),
      )
      return
    }
    res.statusCode = 404
    res.end('not found')
  })
  await new Promise<void>((r) => mockApi!.listen(0, '127.0.0.1', () => r()))
  mockApiPort = (mockApi!.address() as { port: number }).port
})

afterEach(async () => {
  if (mockApi) await new Promise<void>((r) => mockApi!.close(() => r()))
  mockApi = null
})

function writeCreds(dir: string, token: string): string {
  mkdirSync(dir, { recursive: true })
  const credsPath = resolve(dir, 'credentials.json')
  writeFileSync(
    credsPath,
    JSON.stringify({
      api_endpoint: `http://127.0.0.1:${mockApiPort}`,
      token,
      expires_at: '2099-01-01T00:00:00Z',
    }),
    { mode: 0o600 },
  )
  return credsPath
}

describe('btrmnt whoami', () => {
  it('prints {email, role, tenant, expires_at} from /v1/users/me', async () => {
    const dir = freshTempDir('creds-')
    const credsPath = writeCreds(dir, 'tok_whoami')
    const result = await runCli(['whoami'], { BTRMNT_TEST_CREDS_FILE: credsPath })
    expect(result.code).toBe(0)
    const out = result.json as { email: string; role: string; tenant: string; expires_at: string }
    expect(out.email).toBe('alice@parc.example')
    expect(out.role).toBe('tenant_admin')
    expect(out.tenant).toBe('parc')
    expect(out.expires_at).toBe('2099-01-01T00:00:00Z')
  })

  it('sends the CF_Authorization cookie and the User-Agent header', async () => {
    const dir = freshTempDir('creds-')
    const credsPath = writeCreds(dir, 'tok_whoami_2')
    const result = await runCli(['whoami'], { BTRMNT_TEST_CREDS_FILE: credsPath })
    expect(result.code).toBe(0)
    const call = calls.find((c) => c.url === '/v1/users/me')!
    expect(call.headers.cookie).toBe('CF_Authorization=tok_whoami_2')
    // The legacy Authorization header must not be present.
    expect(call.headers.authorization).toBeUndefined()
    expect(String(call.headers['user-agent'] ?? '')).toMatch(/^btrmnt-plugin\//)
  })

  it('errors cleanly when no credentials are present', async () => {
    const dir = freshTempDir('creds-')
    const credsPath = resolve(dir, 'credentials.json')
    const result = await runCli(['whoami'], { BTRMNT_TEST_CREDS_FILE: credsPath })
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/not.*logged in|no credentials|please.*login/i)
  })

  it('surfaces a 401 with a `btrmnt login` hint', async () => {
    // Point at a server URL that responds 401 to /v1/users/me. We reuse the
    // mock by writing creds whose api_endpoint targets a path we don't handle
    // — but since the default mock returns 404, we install a one-off 401
    // handler by closing the existing server and re-opening.
    await new Promise<void>((r) => mockApi!.close(() => r()))
    mockApi = createServer((req, res) => {
      if (req.url === '/v1/users/me') {
        res.statusCode = 401
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'unauthenticated' }))
        return
      }
      res.statusCode = 404
      res.end()
    })
    await new Promise<void>((r) => mockApi!.listen(0, '127.0.0.1', () => r()))
    mockApiPort = (mockApi!.address() as { port: number }).port

    const dir = freshTempDir('creds-')
    const credsPath = writeCreds(dir, 'tok_expired')
    const result = await runCli(['whoami'], { BTRMNT_TEST_CREDS_FILE: credsPath })
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/btrmnt login/i)
  })
})
