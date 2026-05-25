// btrmnt CLI entrypoint (W2d).
//
// Output convention (preserved from W1b for backward compatibility with the
// marketplace smoke tests):
//
//   - `btrmnt --help` -> exit 0 with `{name, description, commands: [...]}`
//   - `btrmnt <cmd> --help` -> exit 0 with `{command, description}`
//   - any other invocation -> success JSON on stdout (exit 0) or error JSON
//     on stderr (non-zero). Every line on stdout is parseable JSON.
//
// We use a hand-rolled arg parser instead of commander because commander's
// `--help` is human-readable and our tests + skills depend on JSON. Each
// subcommand has a tiny option parser that recognises its flags.

import { writeStderrJson, writeStdout } from './output.js'
import { resolveApiEndpoint } from './config.js'
import type { EnvScope, Role } from '@btrmnt/artifact-types'

interface CommandSpec {
  name: string
  description: string
}

const COMMANDS: CommandSpec[] = [
  { name: 'login', description: 'Sign in to the btrmnt artifact platform.' },
  { name: 'whoami', description: 'Print the currently signed-in user + tenant.' },
  { name: 'project new', description: 'Create a new project from a local folder.' },
  { name: 'project list', description: 'List projects in the current tenant.' },
  { name: 'project delete', description: 'Delete a project (and its environments).' },
  { name: 'publish', description: "Push the current project's main branch and deploy to test." },
  { name: 'promote', description: "Fast-forward a project's prod branch to main and deploy." },
  { name: 'rollback', description: "Roll a project's prod branch back to an explicit historical commit." },
  { name: 'grant', description: 'Grant a user access to a project (test, prod, or both).' },
  { name: 'grants', description: 'List who has direct viewer access to a project, grouped by email.' },
  { name: 'revoke', description: "Revoke a user's access to a project." },
  { name: 'invite', description: 'Invite a new user into the current tenant.' },
  { name: 'list', description: 'List projects (alias of `project list`).' },
]

function topLevelHelp(): void {
  writeStdout({
    name: 'btrmnt',
    description: 'btrmnt artifact platform client.',
    commands: COMMANDS,
  })
}

function commandHelp(name: string): void {
  const spec = COMMANDS.find((c) => c.name === name)!
  writeStdout({ command: spec.name, description: spec.description })
}

function matchCommand(argv: readonly string[]): { name: string; rest: string[] } | null {
  if (argv.length === 0) return null
  const twoWord = `${argv[0]} ${argv[1] ?? ''}`.trim()
  const two = COMMANDS.find((c) => c.name === twoWord)
  if (two) return { name: two.name, rest: argv.slice(2) }
  const one = COMMANDS.find((c) => c.name === argv[0])
  if (one) return { name: one.name, rest: argv.slice(1) }
  return null
}

interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | boolean>
}

/**
 * Minimal flag parser. Supports:
 *   --foo bar
 *   --foo=bar
 *   --foo            (boolean true)
 *
 * Positional args are anything not consumed by a flag. We don't try to be
 * clever about short flags — none of our subcommands need them.
 */
function parseFlags(rest: readonly string[], boolFlags: Set<string> = new Set()): ParsedArgs {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      let key: string
      let value: string | boolean
      if (eq >= 0) {
        key = arg.slice(2, eq)
        value = arg.slice(eq + 1)
      } else {
        key = arg.slice(2)
        if (boolFlags.has(key)) {
          value = true
        } else {
          const next = rest[i + 1]
          if (next === undefined || next.startsWith('--')) {
            value = true
          } else {
            value = next
            i += 1
          }
        }
      }
      flags[key] = value
    } else {
      positional.push(arg)
    }
  }
  return { positional, flags }
}

function asEnvScope(value: string | boolean | undefined, fallback: EnvScope): EnvScope {
  if (typeof value !== 'string') return fallback
  if (value === 'test' || value === 'prod' || value === 'both') return value
  throw new Error(`invalid --env ${JSON.stringify(value)}: must be test, prod, or both`)
}

function asRole(value: string | boolean | undefined, fallback: Role): Role {
  if (typeof value !== 'string') return fallback
  if (value === 'tenant_admin' || value === 'tenant_user') return value
  throw new Error(`invalid --role ${JSON.stringify(value)}: must be tenant_admin or tenant_user`)
}

/**
 * Extract an optional string flag. Returns an object with the key omitted
 * entirely (not set to `undefined`) when the flag is absent — needed because
 * the project's tsconfig has `exactOptionalPropertyTypes` enabled.
 */
function optStr<K extends string>(
  flags: Record<string, string | boolean>,
  key: string,
  asKey: K,
): Record<K, string> | Record<K, never> {
  const v = flags[key]
  if (typeof v === 'string') return { [asKey]: v } as Record<K, string>
  return {} as Record<K, never>
}

async function dispatch(name: string, rest: readonly string[]): Promise<number> {
  switch (name) {
    case 'login': {
      const { flags } = parseFlags(rest)
      const { login } = await import('./commands/login.js')
      const loginOpts: {
        apiEndpoint?: string
        timeoutMs?: number
        pollIntervalMs?: number
      } = {}
      if (typeof flags['api-endpoint'] === 'string') loginOpts.apiEndpoint = flags['api-endpoint']
      if (typeof flags['timeout-ms'] === 'string')
        loginOpts.timeoutMs = Number.parseInt(flags['timeout-ms'], 10)
      if (typeof flags['poll-interval-ms'] === 'string')
        loginOpts.pollIntervalMs = Number.parseInt(flags['poll-interval-ms'], 10)
      await login(loginOpts)
      return 0
    }
    case 'whoami': {
      const { flags } = parseFlags(rest)
      try {
        const { whoami } = await import('./commands/whoami.js')
        await whoami({ ...optStr(flags, 'api-endpoint', 'apiEndpoint') })
        return 0
      } catch (err) {
        // Surface the resolved api endpoint so the config-resolution spec can
        // probe it without needing creds. The error envelope is JSON.
        const endpoint = resolveApiEndpoint(
          typeof flags['api-endpoint'] === 'string' ? flags['api-endpoint'] : undefined,
        )
        writeStderrJson({
          error: (err as Error).message,
          api_endpoint: endpoint,
        })
        return 1
      }
    }
    case 'project new': {
      const { positional, flags } = parseFlags(rest, new Set(['allow-secrets']))
      const slug = positional[0]
      if (!slug) throw new Error('project new: missing required <slug> argument')
      const { projectNew } = await import('./commands/project.js')
      await projectNew({
        slug,
        allowSecrets: flags['allow-secrets'] === true,
        ...optStr(flags, 'path', 'path'),
        ...optStr(flags, 'api-endpoint', 'apiEndpoint'),
      })
      return 0
    }
    case 'project list':
    case 'list': {
      const { flags } = parseFlags(rest)
      const { projectList } = await import('./commands/project.js')
      await projectList({ ...optStr(flags, 'api-endpoint', 'apiEndpoint') })
      return 0
    }
    case 'project delete': {
      const { positional, flags } = parseFlags(rest, new Set(['yes']))
      const slug = positional[0]
      if (!slug) throw new Error('project delete: missing required <slug> argument')
      const { projectDelete } = await import('./commands/project.js')
      await projectDelete({
        slug,
        yes: flags.yes === true,
        ...optStr(flags, 'api-endpoint', 'apiEndpoint'),
      })
      return 0
    }
    case 'publish': {
      const { flags } = parseFlags(rest, new Set(['allow-secrets']))
      const { publish } = await import('./commands/publish-promote.js')
      await publish({
        allowSecrets: flags['allow-secrets'] === true,
        ...optStr(flags, 'message', 'message'),
        ...optStr(flags, 'api-endpoint', 'apiEndpoint'),
      })
      return 0
    }
    case 'promote': {
      const { flags } = parseFlags(rest)
      const { promote } = await import('./commands/publish-promote.js')
      await promote({
        ...optStr(flags, 'project', 'project'),
        ...optStr(flags, 'api-endpoint', 'apiEndpoint'),
      })
      return 0
    }
    case 'rollback': {
      const { positional, flags } = parseFlags(rest)
      // Slug may come from the first positional (matches `promote <slug>`
      // ergonomics) or --project; either is fine.
      const slugArg = positional[0]
      const to = typeof flags.to === 'string' ? flags.to : undefined
      if (!to) throw new Error('rollback: --to <sha> is required')
      const { rollback } = await import('./commands/publish-promote.js')
      await rollback({
        ...(slugArg !== undefined ? { project: slugArg } : optStr(flags, 'project', 'project')),
        to,
        ...optStr(flags, 'api-endpoint', 'apiEndpoint'),
      })
      return 0
    }
    case 'grant': {
      const { positional, flags } = parseFlags(rest)
      const email = positional[0]
      const slugArg = positional[1]
      if (!email) throw new Error('grant: missing required <email> argument')
      const env = asEnvScope(flags.env, 'both')
      const { grant } = await import('./commands/grants.js')
      await grant({
        email,
        ...(slugArg !== undefined ? { slug: slugArg } : {}),
        env,
        ...optStr(flags, 'api-endpoint', 'apiEndpoint'),
      })
      return 0
    }
    case 'grants': {
      const { positional, flags } = parseFlags(rest)
      const slugArg = positional[0]
      const { listGrants } = await import('./commands/grants.js')
      await listGrants({
        ...(slugArg !== undefined ? { slug: slugArg } : {}),
        ...optStr(flags, 'api-endpoint', 'apiEndpoint'),
      })
      return 0
    }
    case 'revoke': {
      const { positional, flags } = parseFlags(rest)
      const email = positional[0]
      const slugArg = positional[1]
      if (!email) throw new Error('revoke: missing required <email> argument')
      const env = asEnvScope(flags.env, 'both')
      const { revoke } = await import('./commands/grants.js')
      await revoke({
        email,
        ...(slugArg !== undefined ? { slug: slugArg } : {}),
        env,
        ...optStr(flags, 'api-endpoint', 'apiEndpoint'),
      })
      return 0
    }
    case 'invite': {
      const { positional, flags } = parseFlags(rest)
      const email = positional[0]
      if (!email) throw new Error('invite: missing required <email> argument')
      const role = asRole(flags.role, 'tenant_user')
      const { invite } = await import('./commands/grants.js')
      await invite({
        email,
        role,
        ...optStr(flags, 'api-endpoint', 'apiEndpoint'),
      })
      return 0
    }
    default: {
      writeStderrJson({ error: 'unknown command', command: name })
      return 1
    }
  }
}

export async function run(argv: readonly string[]): Promise<number> {
  // Top-level `--help` / `-h` / no args -> list commands as JSON.
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    topLevelHelp()
    return 0
  }

  const matched = matchCommand(argv)
  if (!matched) {
    writeStderrJson({ error: 'unknown command', argv: [...argv] })
    return 1
  }

  if (matched.rest.includes('--help') || matched.rest.includes('-h')) {
    commandHelp(matched.name)
    return 0
  }

  try {
    return await dispatch(matched.name, matched.rest)
  } catch (err) {
    writeStderrJson({ error: (err as Error).message })
    return 1
  }
}

const argv = process.argv.slice(2)
run(argv).then((code) => {
  if (code !== 0) process.exit(code)
})
