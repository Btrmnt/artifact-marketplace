// Builds the environment variables used to authenticate `git push btrmnt main`
// without ever putting the CF Access JWT on argv.
//
// Why not `-c http.extraHeader=...`?
//   That works, but the value is visible to any other process on the box via
//   `ps` / `/proc/<pid>/cmdline`. The JWT is short-lived, but it's still a
//   bearer token — locally-readable bearer tokens are how lateral movement
//   happens on multi-user machines and CI runners.
//
// Why GIT_CONFIG_COUNT and friends?
//   Since git 2.31 (March 2021) you can inject arbitrary -c-equivalent
//   config via environment variables. The mechanism is:
//     GIT_CONFIG_COUNT=N
//     GIT_CONFIG_KEY_0=...   GIT_CONFIG_VALUE_0=...
//     GIT_CONFIG_KEY_1=...   GIT_CONFIG_VALUE_1=...
//   Process env is only readable by the same uid, never appears in `ps`
//   output, and isn't recorded in shell history. Same behaviour on macOS,
//   Linux, and Git for Windows.
//
// We still need BOTH headers (cookie + assertion) because the platform's
// CF Access apps run in mixed modes — see api.ts for the full rationale.
//
// Why a direct child_process spawn instead of simple-git?
//   simple-git defensively blocks GIT_CONFIG_COUNT and friends to stop
//   untrusted callers shell-injecting through it. Our caller is the CLI,
//   the values are ours, so we don't need that safety net — but we can't
//   opt out cleanly via the simple-git API, so we spawn git directly for
//   the push and let simple-git handle everything else.

import { spawn } from 'node:child_process'

export interface GitAuthEnv {
  GIT_CONFIG_COUNT: string
  GIT_CONFIG_KEY_0: string
  GIT_CONFIG_VALUE_0: string
  GIT_CONFIG_KEY_1: string
  GIT_CONFIG_VALUE_1: string
  GIT_TERMINAL_PROMPT: string
}

export function gitAuthEnv(token: string): GitAuthEnv {
  return {
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'http.extraHeader',
    GIT_CONFIG_VALUE_0: `Cookie: CF_Authorization=${token}`,
    GIT_CONFIG_KEY_1: 'http.extraHeader',
    GIT_CONFIG_VALUE_1: `Cf-Access-Jwt-Assertion: ${token}`,
    // If the helper-less push ever prompts (e.g. token rejected, server asks
    // for fresh creds), fail fast with a clear error rather than block on a
    // hidden terminal prompt.
    GIT_TERMINAL_PROMPT: '0',
  }
}

export class GitPushError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly signal: NodeJS.Signals | null,
    public readonly stderr: string,
  ) {
    super(message)
    this.name = 'GitPushError'
  }
}

/**
 * Run `git push <remote> <branch>` in `cwd` with the CF Access JWT supplied
 * via env-only config so the token never appears on argv. Streams stdout +
 * stderr into in-memory buffers and resolves on success or throws
 * GitPushError on non-zero exit / signal.
 *
 * We deliberately do NOT inherit the parent's stdout/stderr; a noisy push
 * with progress meters would break the CLI's strict JSON-only output
 * contract.
 */
export function authenticatedPush(opts: {
  cwd: string
  remote: string
  branch: string
  token: string
  /**
   * When true, push with `--force`. The git-server permits non-fast-forward
   * updates (it sets no receive.denyNonFastForwards and no hook rejects them),
   * so this is the self-serve escape hatch for republishing a divergent history
   * — e.g. after a delete+recreate left the remote with unrelated commits.
   */
  force?: boolean
}): Promise<void> {
  return new Promise((resolveDone, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env, ...gitAuthEnv(opts.token) }
    const args = ['push', ...(opts.force ? ['--force'] : []), opts.remote, opts.branch]
    const child = spawn('git', args, {
      cwd: opts.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr?.setEncoding('utf-8')
    child.stderr?.on('data', (c: string) => {
      stderr += c
    })
    child.on('error', (err) => {
      reject(new GitPushError(`failed to spawn git: ${err.message}`, null, null, stderr))
    })
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolveDone()
        return
      }
      reject(
        new GitPushError(
          `git push ${opts.force ? '--force ' : ''}${opts.remote} ${opts.branch} failed${
            code !== null ? ` (exit ${code})` : ` (signal ${signal})`
          }${stderr ? `: ${stderr.trim()}` : ''}`,
          code,
          signal,
          stderr,
        ),
      )
    })
  })
}
