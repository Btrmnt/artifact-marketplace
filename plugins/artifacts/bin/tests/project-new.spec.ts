// W2d test: `btrmnt project new <slug> [--path <dir>]`
//
// The CLI must:
//   1. Validate slug against ^[a-z][a-z0-9-]{0,40}[a-z0-9]$.
//   2. POST /v1/projects {slug} -> Project with `git_remote_url`.
//   3. cd into --path (or stay in CWD).
//   4. git init if not a repo.
//   5. git remote add btrmnt <git_remote_url> (or set-url).
//   6. Stage everything, commit "Initial commit", push to btrmnt main.
//   7. Print the test URL.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { simpleGit } from 'simple-git'
import { freshTempDir, runCli } from './_helpers.js'

interface ApiCall {
  method: string
  url: string
  body: string
  headers: Record<string, string | string[] | undefined>
}

let mockApi: Server | null = null
let mockApiPort = 0
let calls: ApiCall[] = []
let bareRepoPath = ''

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => res(Buffer.concat(chunks).toString('utf-8')))
  })
}

beforeEach(async () => {
  calls = []
  // Set up a bare repo on disk so the CLI can actually push to it.
  bareRepoPath = resolve(freshTempDir('bare-repo-'), 'project.git')
  await simpleGit().init(['--bare', bareRepoPath])

  mockApi = createServer(async (req, res) => {
    const body = await readBody(req)
    calls.push({ method: req.method!, url: req.url!, body, headers: req.headers })
    if (req.url === '/v1/projects' && req.method === 'POST') {
      const parsed = JSON.parse(body) as { slug: string }
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
          git_remote_url: `file://${bareRepoPath}`,
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
      token: 'tok_project_new',
      expires_at: null,
    }),
    { mode: 0o600 },
  )
  return credsPath
}

describe('btrmnt project new', () => {
  it('rejects an invalid slug locally without hitting the api', async () => {
    const dir = freshTempDir('creds-')
    const credsPath = writeCreds(dir)
    const result = await runCli(['project', 'new', 'NOT-A-VALID-Slug'], {
      BTRMNT_TEST_CREDS_FILE: credsPath,
    })
    expect(result.code).not.toBe(0)
    const err = JSON.parse(result.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/slug/i)
    expect(calls).toHaveLength(0)
  })

  it('creates project, initialises repo, and pushes initial commit', async () => {
    const dir = freshTempDir('creds-')
    const credsPath = writeCreds(dir)
    const projectDir = freshTempDir('project-')
    writeFileSync(resolve(projectDir, 'index.html'), '<h1>hello</h1>\n')

    const result = await runCli(['project', 'new', 'q1-report', '--path', projectDir], {
      BTRMNT_TEST_CREDS_FILE: credsPath,
    })
    expect(result.code, result.stderr).toBe(0)

    // POST /v1/projects was hit.
    const post = calls.find((c) => c.url === '/v1/projects')!
    expect(post.method).toBe('POST')
    expect(JSON.parse(post.body)).toEqual({ slug: 'q1-report' })
    // CF Access cookie carries the JWT now; Bearer is gone.
    expect(post.headers.cookie).toBe('CF_Authorization=tok_project_new')
    expect(post.headers.authorization).toBeUndefined()

    // Local repo got created and a remote called `btrmnt` was added.
    expect(existsSync(resolve(projectDir, '.git'))).toBe(true)
    const git = simpleGit(projectDir)
    const remotes = await git.getRemotes(true)
    const remote = remotes.find((r) => r.name === 'btrmnt')!
    expect(remote).toBeDefined()
    expect(remote.refs.push).toBe(`file://${bareRepoPath}`)

    // Bare repo received a `main` branch with at least one commit.
    const bare = simpleGit(bareRepoPath)
    const branches = await bare.branchLocal()
    expect(branches.all).toContain('main')
    const log = await bare.log(['main'])
    expect(log.total).toBeGreaterThan(0)

    // Output includes the test URL.
    const out = result.json as {
      project: { slug: string }
      test_url: string
    }
    expect(out.project.slug).toBe('q1-report')
    expect(out.test_url).toBe('https://parc-q1-report-test.btrmntlab.com')
  })

  it('uses an existing git repo if .git already exists', async () => {
    const dir = freshTempDir('creds-')
    const credsPath = writeCreds(dir)
    const projectDir = freshTempDir('project-existing-')
    const git = simpleGit(projectDir)
    await git.init()
    await git.addConfig('user.email', 'pre@existing.example')
    await git.addConfig('user.name', 'pre-existing')
    writeFileSync(resolve(projectDir, 'README.md'), '# pre-existing\n')
    await git.add('.')
    await git.commit('pre-existing commit')

    const result = await runCli(['project', 'new', 'reuse-repo', '--path', projectDir], {
      BTRMNT_TEST_CREDS_FILE: credsPath,
    })
    expect(result.code, result.stderr).toBe(0)

    const remotes = await git.getRemotes(true)
    const remote = remotes.find((r) => r.name === 'btrmnt')!
    expect(remote).toBeDefined()
  })
})
