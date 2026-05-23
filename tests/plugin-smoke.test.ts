// W1b smoke tests for the artifact-marketplace plugin.
//
// These assert STRUCTURAL correctness of the plugin scaffold (manifests,
// skills, hooks, executable bits, JSON output convention). They must remain
// valid after W2d rewrites the bin/btrmnt implementation, so we only test the
// JSON-output contract, not the real behaviour of any (sub)command.

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const PLUGIN_DIR = resolve(REPO_ROOT, 'plugins/artifacts')
const BTRMNT_BIN = resolve(PLUGIN_DIR, 'bin/btrmnt')

// Single umbrella skill — users invoke /artifacts and describe intent in
// natural language; the skill markdown maps that to a btrmnt subcommand.
const SKILL_NAMES = ['artifacts'] as const

// Subcommands the bin tool must understand (matches the plan §W1b list).
// Each `--help` invocation must exit 0 with parseable JSON.
const SUBCOMMANDS: readonly string[][] = [
  ['login'],
  ['whoami'],
  ['project', 'new'],
  ['project', 'list'],
  ['project', 'delete'],
  ['publish'],
  ['promote'],
  ['grant'],
  ['revoke'],
  ['invite'],
  ['list'],
]

function readJsonFile<T = unknown>(path: string): T {
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw) as T
}

function runBin(args: readonly string[]): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(BTRMNT_BIN, args, { encoding: 'utf-8' })
  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

describe('marketplace.json', () => {
  it('is valid JSON and points at the artifacts plugin', () => {
    const manifest = readJsonFile<{
      name: string
      owner: { name?: string; email?: string }
      plugins: Array<{ name: string; source: string }>
    }>(resolve(REPO_ROOT, '.claude-plugin/marketplace.json'))

    expect(manifest.name).toBe('artifact-marketplace')
    expect(manifest.owner).toBeDefined()
    expect(typeof manifest.owner.name).toBe('string')
    expect(manifest.owner.name!.length).toBeGreaterThan(0)
    expect(Array.isArray(manifest.plugins)).toBe(true)
    expect(manifest.plugins).toHaveLength(1)
    expect(manifest.plugins[0]!.name).toBe('artifacts')
    expect(manifest.plugins[0]!.source).toBe('./plugins/artifacts')
  })
})

describe('plugin.json', () => {
  it('is valid JSON and has no version field', () => {
    const manifest = readJsonFile<Record<string, unknown>>(
      resolve(PLUGIN_DIR, '.claude-plugin/plugin.json'),
    )

    expect(manifest.name).toBe('artifacts')
    // Commit-SHA versioning: there must be NO `version` field. This is a hard
    // requirement of the platform's distribution model (plan §Decisions).
    expect('version' in manifest).toBe(false)
  })
})

describe('skill files', () => {
  for (const skill of SKILL_NAMES) {
    it(`skills/${skill}/SKILL.md exists with non-empty frontmatter description + body`, () => {
      const skillPath = resolve(PLUGIN_DIR, 'skills', skill, 'SKILL.md')
      expect(existsSync(skillPath)).toBe(true)

      const raw = readFileSync(skillPath, 'utf-8')
      // Anthropic plugin frontmatter is YAML between two `---` lines at top.
      const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      expect(match, `frontmatter delimiters missing in ${skillPath}`).not.toBeNull()
      const [, frontmatterYaml, body] = match!

      const frontmatter = yaml.load(frontmatterYaml!) as Record<string, unknown>
      expect(frontmatter, `frontmatter parsed to non-object in ${skillPath}`).toBeTypeOf('object')
      expect(typeof frontmatter.description).toBe('string')
      expect((frontmatter.description as string).trim().length).toBeGreaterThan(0)

      expect(body!.trim().length, `body empty in ${skillPath}`).toBeGreaterThan(0)
    })
  }
})

describe('bin/btrmnt', () => {
  it('is executable (user-execute bit set)', () => {
    expect(existsSync(BTRMNT_BIN)).toBe(true)
    const mode = statSync(BTRMNT_BIN).mode
    // POSIX user-execute bit.
    expect((mode & 0o100) !== 0).toBe(true)
  })

  it('`--help` exits 0 and emits JSON containing a `commands` array', () => {
    const { code, stdout } = runBin(['--help'])
    expect(code).toBe(0)
    const parsed = JSON.parse(stdout) as { commands?: unknown }
    expect(Array.isArray(parsed.commands)).toBe(true)
    expect((parsed.commands as unknown[]).length).toBeGreaterThan(0)
  })

  for (const sub of SUBCOMMANDS) {
    it(`\`${sub.join(' ')} --help\` exits 0 with parseable JSON`, () => {
      const { code, stdout } = runBin([...sub, '--help'])
      expect(code).toBe(0)
      // Should be parseable JSON. We don't care about the exact shape — only
      // that the JSON-output contract holds for every subcommand. W2d may
      // enrich the payload.
      expect(() => JSON.parse(stdout)).not.toThrow()
    })
  }

  // Regression guard: when Claude Code clones the marketplace repo into the
  // plugin cache, there is no `pnpm install` step — so the shipped bin must
  // run with ONLY `bin/btrmnt` + `bin/dist/cli.js` present, no node_modules
  // anywhere on the path. Copy those two files into a tmp dir that has no
  // ancestor `node_modules` and invoke `btrmnt --help`.
  describe('runs without node_modules (plugin-cache layout)', () => {
    let isolatedBin = ''
    let tmpRoot = ''

    beforeAll(() => {
      tmpRoot = mkdtempSync(resolve(tmpdir(), 'btrmnt-plugin-cache-'))
      cpSync(BTRMNT_BIN, resolve(tmpRoot, 'btrmnt'))
      cpSync(resolve(PLUGIN_DIR, 'bin/dist'), resolve(tmpRoot, 'dist'), {
        recursive: true,
      })
      isolatedBin = resolve(tmpRoot, 'btrmnt')
    })

    afterAll(() => {
      if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
    })

    it('`--help` exits 0 with parseable JSON', () => {
      const result = spawnSync(isolatedBin, ['--help'], { encoding: 'utf-8' })
      const stderr = result.stderr ?? ''
      // A non-bundled runtime import (e.g. simple-git) would surface as
      // `Cannot find package` on stderr — surface that loudly if it happens.
      expect(stderr, stderr).toBe('')
      expect(result.status).toBe(0)
      const parsed = JSON.parse(result.stdout ?? '') as { commands?: unknown }
      expect(Array.isArray(parsed.commands)).toBe(true)
    })
  })
})

describe('hooks/hooks.json', () => {
  it('is valid JSON with a `hooks.SessionStart` array containing at least one entry', () => {
    const manifest = readJsonFile<{ hooks?: Record<string, unknown[]> }>(
      resolve(PLUGIN_DIR, 'hooks/hooks.json'),
    )
    expect(manifest.hooks).toBeDefined()
    expect(Array.isArray(manifest.hooks!.SessionStart)).toBe(true)
    expect(manifest.hooks!.SessionStart!.length).toBeGreaterThan(0)
  })
})

describe('claude plugin validate', () => {
  it('passes (or is skipped if `claude` CLI not on PATH)', () => {
    const which = spawnSync('which', ['claude'], { encoding: 'utf-8' })
    if ((which.status ?? -1) !== 0 || !(which.stdout ?? '').trim()) {
      // eslint-disable-next-line no-console
      console.log('[claude plugin validate] skipped: `claude` not on PATH')
      return
    }
    const result = spawnSync('claude', ['plugin', 'validate', REPO_ROOT], { encoding: 'utf-8' })
    if ((result.status ?? -1) !== 0) {
      // Don't fail the suite for an unknown subcommand on the host — only fail
      // if `claude plugin validate` exists and actually reported a structural
      // problem. We detect "unknown command" style errors by checking stderr.
      const stderr = result.stderr ?? ''
      const looksUnsupported = /unknown command|unrecognized|no such command/i.test(stderr)
      if (looksUnsupported) {
        // eslint-disable-next-line no-console
        console.log('[claude plugin validate] skipped: subcommand not supported by host CLI')
        return
      }
    }
    expect(result.status, result.stderr ?? '').toBe(0)
  })
})

describe('@btrmnt/artifact-types', () => {
  it('builds and the generated .d.ts exports the expected names', () => {
    const build = spawnSync('pnpm', ['--filter', '@btrmnt/artifact-types', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    })
    expect(build.status, build.stderr ?? '').toBe(0)

    const dts = readFileSync(
      resolve(REPO_ROOT, 'packages/types/dist/index.d.ts'),
      'utf-8',
    )
    for (const name of [
      'Tenant',
      'User',
      'Project',
      'ProjectEnvironment',
      'Grant',
      'ApiError',
    ]) {
      expect(dts, `${name} missing from generated .d.ts`).toMatch(
        new RegExp(`export\\b[^\\n]*\\b${name}\\b`),
      )
    }
  })
})
