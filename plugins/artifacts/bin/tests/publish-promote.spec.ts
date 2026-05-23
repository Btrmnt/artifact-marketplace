// W2d test: `btrmnt publish` and `btrmnt promote`.
//
//   publish:
//     1. Verify CWD has a `btrmnt` remote.
//     2. git add -A && git commit -m "<msg>"
//     3. git push btrmnt main
//     4. Print deployed test URL + sha.
//
//   promote:
//     1. Resolve slug from --project arg or `btrmnt` remote URL.
//     2. POST /v1/projects/<slug>/promote {} -> ProjectEnvironment for prod.
//     3. Print prod URL + sha.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
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
let bareReposBySlug: Record<string, string> = {}

async function bareRepoForSlug(slug: string): Promise<string> {
  if (bareReposBySlug[slug]) return bareReposBySlug[slug]!
  const path = resolve(bareRepoRoot, `${slug}.git`)
  await simpleGit().init(['--bare', path])
  bareReposBySlug[slug] = path
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
  bareReposBySlug = {}

  mockApi = createServer(async (req, res) => {
    const body = await readBody(req)
    calls.push({ method: req.method!, url: req.url!, body })
    if (req.method === 'POST' && req.url === '/v1/projects') {
      const parsed = JSON.parse(body) as { slug: string }
      const bare = await bareRepoForSlug(parsed.slug)
      res.statusCode = 201
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          id: '33333333-3333-3333-3333-333333333333',
          tenant_id: '22222222-2222-2222-2222-222222222222',
          slug: parsed.slug,
          owner_user_id: '11111111-1111-1111-1111-111111111111',
          created_at: '2026-05-21T00:00:00Z',
          environments: [
            {
              project_id: '33333333-3333-3333-3333-333333333333',
              env: 'test',
              url: `https://parc-${parsed.slug}-test.btrmntlab.com`,
            },
            {
              project_id: '33333333-3333-3333-3333-333333333333',
              env: 'prod',
              url: `https://parc-${parsed.slug}.btrmntlab.com`,
            },
          ],
          git_remote_url: `file://${bare}`,
        }),
      )
      return
    }
    if (req.method === 'POST' && /^\/v1\/projects\/[^/]+\/promote$/.test(req.url!)) {
      const slug = req.url!.split('/')[3]!
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          project_id: '33333333-3333-3333-3333-333333333333',
          env: 'prod',
          deployed_sha: 'a'.repeat(40),
          deployed_at: '2026-05-21T12:00:00Z',
          url: `https://parc-${slug}.btrmntlab.com`,
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
      token: 'tok_pub_promo',
      expires_at: null,
    }),
    { mode: 0o600 },
  )
  return credsPath
}

async function bootstrapProject(slug: string, credsPath: string): Promise<string> {
  const projectDir = freshTempDir('project-')
  writeFileSync(resolve(projectDir, 'index.html'), '<h1>v1</h1>\n')
  const result = await runCli(['project', 'new', slug, '--path', projectDir], {
    BTRMNT_TEST_CREDS_FILE: credsPath,
  })
  if (result.code !== 0) throw new Error(`project new failed: ${result.stderr}`)
  return projectDir
}

describe('btrmnt publish', () => {
  it('commits + pushes to btrmnt main', async () => {
    const credsDir = freshTempDir('creds-')
    const credsPath = writeCreds(credsDir)
    const projectDir = await bootstrapProject('pub-test', credsPath)
    // Mutate a file so there is something to commit.
    appendFileSync(resolve(projectDir, 'index.html'), '<p>v2</p>\n')

    const result = await runCli(
      ['publish', '--message', 'second commit'],
      { BTRMNT_TEST_CREDS_FILE: credsPath, BTRMNT_TEST_CWD: projectDir },
    )
    expect(result.code, result.stderr).toBe(0)

    // Bare repo's main branch now has 2 commits.
    const bare = simpleGit(bareReposBySlug['pub-test']!)
    const log = await bare.log(['main'])
    expect(log.total).toBeGreaterThanOrEqual(2)
    expect(log.latest!.message).toContain('second commit')

    const out = result.json as { sha: string }
    expect(out.sha).toMatch(/^[0-9a-f]{40}$/)
  })

  it('errors when CWD has no btrmnt remote', async () => {
    const credsDir = freshTempDir('creds-')
    const credsPath = writeCreds(credsDir)
    const projectDir = freshTempDir('no-remote-')
    await simpleGit(projectDir).init()
    const result = await runCli(['publish'], {
      BTRMNT_TEST_CREDS_FILE: credsPath,
      BTRMNT_TEST_CWD: projectDir,
    })
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/remote/i)
  })
})

describe('btrmnt promote', () => {
  it('calls /promote with slug resolved from the btrmnt remote', async () => {
    const credsDir = freshTempDir('creds-')
    const credsPath = writeCreds(credsDir)
    const projectDir = await bootstrapProject('promo-test', credsPath)

    const result = await runCli(['promote'], {
      BTRMNT_TEST_CREDS_FILE: credsPath,
      BTRMNT_TEST_CWD: projectDir,
    })
    expect(result.code, result.stderr).toBe(0)
    const out = result.json as { url: string; deployed_sha: string }
    expect(out.url).toBe('https://parc-promo-test.btrmntlab.com')
    expect(out.deployed_sha).toMatch(/^[0-9a-f]{40}$/)

    const promote = calls.find((c) => c.url.endsWith('/promote'))!
    expect(promote.method).toBe('POST')
    expect(promote.url).toBe('/v1/projects/promo-test/promote')
  })

  it('accepts --project to override slug', async () => {
    const credsDir = freshTempDir('creds-')
    const credsPath = writeCreds(credsDir)
    const projectDir = freshTempDir('not-a-repo-')
    const result = await runCli(['promote', '--project', 'override-slug'], {
      BTRMNT_TEST_CREDS_FILE: credsPath,
      BTRMNT_TEST_CWD: projectDir,
    })
    expect(result.code, result.stderr).toBe(0)
    const promote = calls.find((c) => c.url.endsWith('/promote'))!
    expect(promote.url).toBe('/v1/projects/override-slug/promote')
  })
})
