// Shared test helpers for the W2d bin/btrmnt CLI specs.
//
// Each spec spawns the actual CLI via `tsx src/cli.ts` so we exercise the same
// code path as the shipped binary. We expose a few env-var seams that
// production code recognises:
//
//   BTRMNT_TEST_DISABLE_BROWSER=1
//     During `btrmnt login` we MUST NOT actually open a browser. With this
//     flag set the CLI emits the auth-start URL on stderr and waits for the
//     test harness to drive the OAuth dance.
//
//   BTRMNT_TEST_CREDS_FILE=<path>
//     Overrides the credentials.json location used for read AND write. This
//     beats both `CLAUDE_PLUGIN_DATA` and `~/.btrmnt`. Tests use this to
//     keep state in a unique temp dir per case.
//
// The helpers below run the CLI as a child process and return its exit
// code + parsed stdout JSON. Tests treat the CLI as a black box.

import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const BIN_ROOT = resolve(__dirname, '..')
export const CLI_ENTRY = resolve(BIN_ROOT, 'src/cli.ts')
export const TSX_BIN = resolve(BIN_ROOT, 'node_modules/.bin/tsx')

export interface CliResult {
  code: number
  stdout: string
  stderr: string
  json: unknown
}

export interface CliRun extends Promise<CliResult> {
  child: ChildProcess
  stderrChunks: string[]
  stdoutChunks: string[]
  /** Wait until a stderr line matching `predicate` arrives, or reject after `timeoutMs`. */
  waitForStderr(predicate: (line: string) => boolean, timeoutMs?: number): Promise<string>
}

export function freshTempDir(prefix = 'btrmnt-test-'): string {
  return mkdtempSync(resolve(tmpdir(), prefix))
}

export function runCli(args: readonly string[], env: NodeJS.ProcessEnv = {}): CliRun {
  // Inherit a clean-ish env: drop any pre-existing BTRMNT_* / CLAUDE_PLUGIN_* so
  // tests don't accidentally pick up the developer's real creds.
  const baseEnv: NodeJS.ProcessEnv = { ...process.env }
  for (const k of Object.keys(baseEnv)) {
    if (k.startsWith('BTRMNT_') || k.startsWith('CLAUDE_PLUGIN_')) delete baseEnv[k]
  }

  const child = spawn(TSX_BIN, [CLI_ENTRY, ...args], {
    env: { ...baseEnv, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  const stderrWaiters: Array<{
    predicate: (line: string) => boolean
    resolve: (line: string) => void
    reject: (err: Error) => void
    timer: NodeJS.Timeout
  }> = []

  child.stdout!.setEncoding('utf-8')
  child.stderr!.setEncoding('utf-8')
  child.stdout!.on('data', (chunk: string) => {
    stdoutChunks.push(chunk)
  })
  child.stderr!.on('data', (chunk: string) => {
    stderrChunks.push(chunk)
    const text = stderrChunks.join('')
    const lines = text.split('\n')
    for (let i = stderrWaiters.length - 1; i >= 0; i--) {
      const waiter = stderrWaiters[i]!
      const hit = lines.find((l) => waiter.predicate(l))
      if (hit !== undefined) {
        clearTimeout(waiter.timer)
        stderrWaiters.splice(i, 1)
        waiter.resolve(hit)
      }
    }
  })

  const settled = new Promise<CliResult>((resolveDone) => {
    child.on('close', (code) => {
      const stdout = stdoutChunks.join('')
      const stderr = stderrChunks.join('')
      let json: unknown = undefined
      try {
        json = stdout.trim().length ? JSON.parse(stdout.trim().split('\n').pop()!) : undefined
      } catch {
        // leave undefined; the test asserts on raw stdout if needed
      }
      resolveDone({ code: code ?? -1, stdout, stderr, json })
    })
  }) as CliRun

  // attach side-channel hooks
  Object.defineProperty(settled, 'child', { value: child })
  Object.defineProperty(settled, 'stderrChunks', { value: stderrChunks })
  Object.defineProperty(settled, 'stdoutChunks', { value: stdoutChunks })
  settled.waitForStderr = (predicate, timeoutMs = 5000) =>
    new Promise<string>((res, rej) => {
      // First check what we've already got.
      const existing = stderrChunks.join('').split('\n').find((l) => predicate(l))
      if (existing !== undefined) {
        res(existing)
        return
      }
      const timer = setTimeout(() => {
        rej(new Error(`waitForStderr timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      stderrWaiters.push({ predicate, resolve: res, reject: rej, timer })
    })

  return settled
}
