// W2d test: `btrmnt grant`, `btrmnt revoke`, `btrmnt invite`, `btrmnt list`,
// `btrmnt project delete`.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { simpleGit } from 'simple-git'
import { freshTempDir, runCli } from './_helpers.js'

interface ApiCall {
  method: string
  url: string
  body: string
}

let mockApi: Server | null = null
let mockApiPort = 0
let calls: ApiCall[] = []
let bareRepoRoot = ''

async function bareRepoForSlug(slug: string): Promise<string> {
  const path = resolve(bareRepoRoot, `${slug}.git`)
  await simpleGit().init(['--bare', path])
  return path
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => res(Buffer.concat(chunks).toString('utf-8')))
  })
}

beforeEach(async () => {
  calls = []
  bareRepoRoot = freshTempDir('bare-')

  mockApi = createServer(async (req, res) => {
    const body = await readBody(req)
    calls.push({ method: req.method!, url: req.url!, body })
    res.setHeader('content-type', 'application/json')
    if (req.method === 'POST' && req.url === '/v1/projects') {
      const parsed = JSON.parse(body) as { slug: string }
      const bare = await bareRepoForSlug(parsed.slug)
      res.statusCode = 201
      res.end(
        JSON.stringify({
          id: '33333333-3333-3333-3333-333333333333',
          tenant_id: '22222222-2222-2222-2222-222222222222',
          slug: parsed.slug,
          owner_user_id: '11111111-1111-1111-1111-111111111111',
          created_at: '2026-05-21T00:00:00Z',
          environments: [
            { project_id: 'p', env: 'test', url: 'https://x-test.btrmntlab.com' },
            { project_id: 'p', env: 'prod', url: 'https://x.btrmntlab.com' },
          ],
          git_remote_url: `file://${bare}`,
        }),
      )
      return
    }
    if (req.method === 'GET' && req.url === '/v1/projects') {
      res.statusCode = 200
      res.end(JSON.stringify([{ slug: 'p1' }, { slug: 'p2' }]))
      return
    }
    if (req.method === 'DELETE' && /^\/v1\/projects\/[^/]+$/.test(req.url!)) {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method === 'POST' && /\/grants$/.test(req.url!)) {
      res.statusCode = 201
      res.end(JSON.stringify([{ project_id: 'p', env: 'test', email: 'b@x.com' }]))
      return
    }
    if (req.method === 'GET' && /\/grants$/.test(req.url!)) {
      res.statusCode = 200
      res.end(
        JSON.stringify([
          { project_id: 'p', email: 'alice@x.com', env: 'prod' },
          { project_id: 'p', email: 'alice@x.com', env: 'test' },
          { project_id: 'p', email: 'bob@x.com', env: 'test' },
        ]),
      )
      return
    }
    if (req.method === 'DELETE' && /\/grants\/[^/]+/.test(req.url!)) {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method === 'POST' && req.url === '/v1/invites') {
      res.statusCode = 201
      res.end(
        JSON.stringify({
          user: {
            id: '44444444-4444-4444-4444-444444444444',
            email: 'new@x.com',
            created_at: '2026-05-21T00:00:00Z',
          },
          membership: {
            user_id: '44444444-4444-4444-4444-444444444444',
            tenant_id: '22222222-2222-2222-2222-222222222222',
            tenant_slug: 'parc',
            role: 'tenant_user',
          },
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

function writeCreds(dir: string): string {
  mkdirSync(dir, { recursive: true })
  const credsPath = resolve(dir, 'credentials.json')
  writeFileSync(
    credsPath,
    JSON.stringify({
      api_endpoint: `http://127.0.0.1:${mockApiPort}`,
      token: 'tok_grants',
      expires_at: null,
    }),
    { mode: 0o600 },
  )
  return credsPath
}

async function bootstrapProject(slug: string, credsFile: string): Promise<string> {
  const projectDir = freshTempDir('project-')
  writeFileSync(resolve(projectDir, 'index.html'), '<h1>x</h1>\n')
  const r = await runCli(['project', 'new', slug, '--path', projectDir], {
    BTRMNT_TEST_CREDS_FILE: credsFile,
  })
  if (r.code !== 0) throw new Error(r.stderr)
  return projectDir
}

describe('btrmnt grant', () => {
  it('defaults to --env prod (least privilege — does not silently share test)', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const projectDir = await bootstrapProject('grantslug', credsFile)
    const r = await runCli(['grant', 'b@x.com'], {
      BTRMNT_TEST_CREDS_FILE: credsFile,
      BTRMNT_TEST_CWD: projectDir,
    })
    expect(r.code, r.stderr).toBe(0)
    const grant = calls.find((c) => c.url.endsWith('/grants') && c.method === 'POST')!
    expect(grant.url).toBe('/v1/projects/grantslug/grants')
    expect(JSON.parse(grant.body)).toEqual({ email: 'b@x.com', env: 'prod' })
  })

  it('passes --env both through to widen to test + prod', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const r = await runCli(['grant', 'd@x.com', 'slug-arg', '--env', 'both'], {
      BTRMNT_TEST_CREDS_FILE: credsFile,
    })
    expect(r.code, r.stderr).toBe(0)
    const grant = calls.find((c) => c.url.endsWith('/grants'))!
    expect(JSON.parse(grant.body)).toEqual({ email: 'd@x.com', env: 'both' })
  })

  it('passes --env prod through', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const r = await runCli(['grant', 'c@x.com', 'slug-arg', '--env', 'prod'], {
      BTRMNT_TEST_CREDS_FILE: credsFile,
    })
    expect(r.code, r.stderr).toBe(0)
    const grant = calls.find((c) => c.url.endsWith('/grants'))!
    expect(grant.url).toBe('/v1/projects/slug-arg/grants')
    expect(JSON.parse(grant.body)).toEqual({ email: 'c@x.com', env: 'prod' })
  })
})

describe('btrmnt revoke', () => {
  it('uses DELETE with env query param and URL-encodes the email', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const projectDir = await bootstrapProject('revokeslug', credsFile)
    const r = await runCli(['revoke', 'b+v1@x.com', '--env', 'test'], {
      BTRMNT_TEST_CREDS_FILE: credsFile,
      BTRMNT_TEST_CWD: projectDir,
    })
    expect(r.code, r.stderr).toBe(0)
    const del = calls.find((c) => c.method === 'DELETE' && c.url.includes('/grants/'))!
    // `@` becomes `%40`, `+` becomes `%2B`. Any `/`/`?`/`#` in a malformed
    // email would now also be encoded, so it can't smuggle path segments.
    expect(del.url).toBe('/v1/projects/revokeslug/grants/b%2Bv1%40x.com?env=test')
  })

  it('defaults to --env both so a plain revoke removes every grant', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const projectDir = await bootstrapProject('revokeall', credsFile)
    const r = await runCli(['revoke', 'b@x.com'], {
      BTRMNT_TEST_CREDS_FILE: credsFile,
      BTRMNT_TEST_CWD: projectDir,
    })
    expect(r.code, r.stderr).toBe(0)
    const del = calls.find((c) => c.method === 'DELETE' && c.url.includes('/grants/'))!
    expect(del.url).toBe('/v1/projects/revokeall/grants/b%40x.com?env=both')
  })

  it('rejects an email with characters that could break the URL path', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const r = await runCli(['revoke', 'foo/../bar@x.com', 'someslug', '--env', 'test'], {
      BTRMNT_TEST_CREDS_FILE: credsFile,
    })
    expect(r.code).not.toBe(0)
    const err = JSON.parse(r.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/invalid email/i)
    // And no DELETE call should have hit the server.
    expect(calls.find((c) => c.url.includes('/grants/'))).toBeUndefined()
  })
})

describe('btrmnt grants', () => {
  it('GETs /v1/projects/<slug>/grants and groups by email', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const projectDir = await bootstrapProject('viewslug', credsFile)
    const r = await runCli(['grants'], {
      BTRMNT_TEST_CREDS_FILE: credsFile,
      BTRMNT_TEST_CWD: projectDir,
    })
    expect(r.code, r.stderr).toBe(0)
    const list = calls.find((c) => c.method === 'GET' && c.url.endsWith('/grants'))!
    expect(list.url).toBe('/v1/projects/viewslug/grants')
    const out = r.json as { slug: string; viewers: { email: string; envs: string[] }[] }
    expect(out.slug).toBe('viewslug')
    expect(out.viewers).toEqual([
      { email: 'alice@x.com', envs: ['test', 'prod'] },
      { email: 'bob@x.com', envs: ['test'] },
    ])
  })

  it('accepts an explicit slug positional', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const r = await runCli(['grants', 'someproj'], { BTRMNT_TEST_CREDS_FILE: credsFile })
    expect(r.code, r.stderr).toBe(0)
    const list = calls.find((c) => c.method === 'GET' && c.url.endsWith('/grants'))!
    expect(list.url).toBe('/v1/projects/someproj/grants')
  })
})

describe('btrmnt invite', () => {
  it('POSTs to /v1/invites and prints the new user + membership', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const r = await runCli(['invite', 'new@x.com', '--role', 'tenant_user'], {
      BTRMNT_TEST_CREDS_FILE: credsFile,
    })
    expect(r.code, r.stderr).toBe(0)
    const invite = calls.find((c) => c.url === '/v1/invites')!
    expect(JSON.parse(invite.body)).toEqual({ email: 'new@x.com', role: 'tenant_user' })
    const out = r.json as { user: { email: string }; membership: { role: string } }
    expect(out.user.email).toBe('new@x.com')
    expect(out.membership.role).toBe('tenant_user')
  })
})

describe('btrmnt list', () => {
  it('GETs /v1/projects', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const r = await runCli(['list'], { BTRMNT_TEST_CREDS_FILE: credsFile })
    expect(r.code, r.stderr).toBe(0)
    const list = calls.find((c) => c.method === 'GET' && c.url === '/v1/projects')!
    expect(list).toBeDefined()
    expect(r.json).toEqual([{ slug: 'p1' }, { slug: 'p2' }])
  })
})

describe('btrmnt project delete', () => {
  it('requires --yes', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const r = await runCli(['project', 'delete', 'doomed'], { BTRMNT_TEST_CREDS_FILE: credsFile })
    expect(r.code).not.toBe(0)
    const err = JSON.parse(r.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/--yes/i)
  })

  it('calls DELETE /v1/projects/<slug> with --yes', async () => {
    const credsDir = freshTempDir('cpd-')
    const credsFile = writeCreds(credsDir)
    const r = await runCli(['project', 'delete', 'doomed', '--yes'], {
      BTRMNT_TEST_CREDS_FILE: credsFile,
    })
    expect(r.code, r.stderr).toBe(0)
    const del = calls.find((c) => c.method === 'DELETE' && c.url === '/v1/projects/doomed')!
    expect(del).toBeDefined()
  })
})
