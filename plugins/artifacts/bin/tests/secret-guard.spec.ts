// Tests for the pre-commit secret guard (Finding #3).
//
// Two layers:
//   - Filename denylist: blocks .env, *.pem, id_rsa, .aws/, etc.
//   - Content scan: blocks AWS access keys, GitHub PATs, OpenAI keys,
//     and PEM private-key headers.
//
// We also exercise the CLI end-to-end via `btrmnt publish` to confirm the
// guard fires before any git push happens.

import { describe, expect, it } from 'vitest'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { simpleGit } from 'simple-git'
import {
  assertNoSecrets,
  SecretFoundError,
  DEFAULT_GITIGNORE,
} from '../src/secret-guard.js'

/** Walk a directory tree and return POSIX-relative file paths. Stand-in for
 *  `git ls-files` in the unit tests (which don't bother with a real repo). */
function listAll(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(resolve(dir, entry.name), rel)
        continue
      }
      out.push(rel)
    }
  }
  walk(root, '')
  return out
}
import { freshTempDir, runCli } from './_helpers.js'

function seed(root: string, files: Record<string, string>): void {
  for (const [rel, contents] of Object.entries(files)) {
    const abs = resolve(root, rel)
    mkdirSync(resolve(abs, '..'), { recursive: true })
    writeFileSync(abs, contents)
  }
}

describe('assertNoSecrets — filename rules', () => {
  it('blocks .env', () => {
    const dir = freshTempDir('sg-')
    seed(dir, { '.env': 'SECRET=hunter2\n', 'index.html': '<h1>x</h1>\n' })
    try {
      assertNoSecrets(dir, listAll(dir))
      throw new Error('expected SecretFoundError')
    } catch (err) {
      expect(err).toBeInstanceOf(SecretFoundError)
      expect((err as SecretFoundError).matches[0]!.file).toBe('.env')
      expect((err as SecretFoundError).matches[0]!.rule).toBe('env-file')
    }
  })

  it('blocks .env.production but allows .env.example', () => {
    const dir = freshTempDir('sg-')
    seed(dir, {
      '.env.example': 'API_URL=https://example.com\n',
      '.env.production': 'DB_PASSWORD=hunter2\n',
    })
    try {
      assertNoSecrets(dir, listAll(dir))
      throw new Error('expected SecretFoundError')
    } catch (err) {
      expect(err).toBeInstanceOf(SecretFoundError)
      const files = (err as SecretFoundError).matches.map((m) => m.file)
      expect(files).toContain('.env.production')
      expect(files).not.toContain('.env.example')
    }
  })

  it('blocks id_rsa, .pem, and .aws/credentials', () => {
    const dir = freshTempDir('sg-')
    seed(dir, {
      'id_rsa': 'pretend-key\n',
      'cert.pem': 'pretend-pem\n',
      '.aws/credentials': '[default]\naws_access_key_id=x\n',
    })
    try {
      assertNoSecrets(dir, listAll(dir))
      throw new Error('expected SecretFoundError')
    } catch (err) {
      const rules = (err as SecretFoundError).matches.map((m) => m.rule)
      expect(rules).toContain('ssh-private-key')
      expect(rules).toContain('pem-key')
      expect(rules).toContain('aws-dir')
    }
  })

  it('passes a clean project', () => {
    const dir = freshTempDir('sg-')
    seed(dir, {
      'index.html': '<h1>hello</h1>\n',
      'styles.css': 'body{margin:0}\n',
      'README.md': '# Hi\n',
    })
    expect(() => assertNoSecrets(dir, listAll(dir))).not.toThrow()
  })
})

describe('assertNoSecrets — content rules', () => {
  it('catches an AWS access key embedded in a text file', () => {
    const dir = freshTempDir('sg-')
    seed(dir, { 'config.js': 'const k = "AKIA' + 'ABCDEFGHIJKLMNOP";\n' })
    try {
      assertNoSecrets(dir, listAll(dir))
      throw new Error('expected SecretFoundError')
    } catch (err) {
      expect((err as SecretFoundError).matches[0]!.rule).toBe('aws-access-key')
    }
  })

  it('catches a PEM private-key header in arbitrary files', () => {
    const dir = freshTempDir('sg-')
    const block = '-----BEGIN RSA PRIVATE KEY-----\nMIIEv...etc\n-----END RSA PRIVATE KEY-----\n'
    seed(dir, { 'notes.txt': block })
    try {
      assertNoSecrets(dir, listAll(dir))
      throw new Error('expected SecretFoundError')
    } catch (err) {
      expect((err as SecretFoundError).matches[0]!.rule).toBe('private-key-block')
    }
  })
})

describe('DEFAULT_GITIGNORE', () => {
  it('covers the same families the runtime guard blocks', () => {
    // Smoke test the scaffold rather than diffing line-by-line — the
    // assertNoSecrets unit tests above are the source of truth for which
    // patterns matter.
    expect(DEFAULT_GITIGNORE).toMatch(/\.env\b/)
    expect(DEFAULT_GITIGNORE).toMatch(/!\.env\.example/)
    expect(DEFAULT_GITIGNORE).toMatch(/id_rsa/)
    expect(DEFAULT_GITIGNORE).toMatch(/\.aws\//)
    expect(DEFAULT_GITIGNORE).toMatch(/\*\.pem/)
  })
})

describe('btrmnt publish — secret guard wiring', () => {
  it('refuses to publish a project with a .env in the working tree', async () => {
    // Build a minimal project with a `btrmnt` remote pointing at a local
    // bare repo, then drop a .env in. The guard must fire before any push.
    const credsDir = freshTempDir('creds-')
    const credsPath = resolve(credsDir, 'credentials.json')
    mkdirSync(credsDir, { recursive: true })
    writeFileSync(
      credsPath,
      JSON.stringify({ api_endpoint: 'http://127.0.0.1:1', token: 't', expires_at: null }),
      { mode: 0o600 },
    )

    const projectDir = freshTempDir('proj-')
    const bare = resolve(freshTempDir('bare-'), 'p.git')
    await simpleGit().init(['--bare', bare])
    await simpleGit(projectDir).init()
    await simpleGit(projectDir).addRemote('btrmnt', `file://${bare}`)
    writeFileSync(resolve(projectDir, 'index.html'), '<h1>v1</h1>\n')
    writeFileSync(resolve(projectDir, '.env'), 'DB_PASSWORD=hunter2\n')

    const r = await runCli(['publish'], {
      BTRMNT_TEST_CREDS_FILE: credsPath,
      BTRMNT_TEST_CWD: projectDir,
    })
    expect(r.code).not.toBe(0)
    const err = JSON.parse(r.stderr.trim().split('\n').pop()!) as { error: string }
    expect(err.error).toMatch(/secret|\.env/i)
  })

  it('--allow-secrets bypasses the guard with a warning', async () => {
    const credsDir = freshTempDir('creds-')
    const credsPath = resolve(credsDir, 'credentials.json')
    mkdirSync(credsDir, { recursive: true })
    writeFileSync(
      credsPath,
      JSON.stringify({ api_endpoint: 'http://127.0.0.1:1', token: 't', expires_at: null }),
      { mode: 0o600 },
    )

    const projectDir = freshTempDir('proj-')
    const bare = resolve(freshTempDir('bare-'), 'p.git')
    await simpleGit().init(['--bare', bare])
    await simpleGit(projectDir).init()
    await simpleGit(projectDir).addConfig('user.email', 'test@local')
    await simpleGit(projectDir).addConfig('user.name', 'test')
    await simpleGit(projectDir).addRemote('btrmnt', `file://${bare}`)
    writeFileSync(resolve(projectDir, 'index.html'), '<h1>v1</h1>\n')
    writeFileSync(resolve(projectDir, '.env'), 'DB_PASSWORD=hunter2\n')

    const r = await runCli(['publish', '--allow-secrets'], {
      BTRMNT_TEST_CREDS_FILE: credsPath,
      BTRMNT_TEST_CWD: projectDir,
    })
    // The publish itself may still succeed (we're using file:// so the JWT
    // header is irrelevant). The thing we care about is that the warning
    // landed on stderr and the run got past the guard.
    expect(r.stderr).toMatch(/secret-guard bypassed/i)
  })
})

