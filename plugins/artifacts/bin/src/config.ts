// Resolves runtime configuration for the btrmnt CLI.
//
// API endpoint precedence (highest to lowest):
//   1. --api-endpoint <url> flag
//   2. BTRMNT_API_ENDPOINT env var
//   3. CLAUDE_PLUGIN_OPTION_API_ENDPOINT env var (Claude Code injects this
//      from the plugin manifest's userConfig.api_endpoint default/value)
//   4. Hard default: https://api.btrmntlab.com
//
// Credentials file path precedence:
//   1. BTRMNT_TEST_CREDS_FILE — test override only.
//   2. ${HOME}/.btrmnt/credentials.json — canonical location, shared with
//      the admin-cli so both tools read the same file.

import { homedir } from 'node:os'
import { resolve } from 'node:path'

export const DEFAULT_API_ENDPOINT = 'https://api.btrmntlab.com'

/**
 * Suffix-matched allowlist for API hosts. A bare host equal to one of these
 * is allowed; `*.<suffix>` is allowed too. Anything else requires the
 * `--allow-unknown-host` flag / `BTRMNT_ALLOW_UNKNOWN_HOST=1` opt-in.
 */
export const ALLOWED_HOST_SUFFIXES = ['btrmntlab.com']

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export interface ValidateOptions {
  /** Allow plain `http://` for hosts that aren't loopback. Off by default. */
  allowInsecure?: boolean
  /** Allow hosts outside ALLOWED_HOST_SUFFIXES. Off by default. */
  allowUnknownHost?: boolean
}

function envFlag(name: string): boolean {
  const v = process.env[name]
  return v === '1' || v?.toLowerCase() === 'true'
}

function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]'
}

function isAllowedHost(host: string): boolean {
  for (const suffix of ALLOWED_HOST_SUFFIXES) {
    if (host === suffix) return true
    if (host.endsWith(`.${suffix}`)) return true
  }
  return false
}

/**
 * Parse + validate an API endpoint string. Returns the trimmed value on
 * success; throws ConfigError otherwise. Loopback hosts skip both the
 * https and allowlist checks (those are for tests and self-hosted dev).
 *
 * The two opt-in flags (`allowInsecure`, `allowUnknownHost`) are also
 * honoured from env (`BTRMNT_ALLOW_INSECURE=1`, `BTRMNT_ALLOW_UNKNOWN_HOST=1`)
 * so users with self-hosted deployments can set them once in their shell
 * rather than thread them through every CLI invocation.
 */
export function validateApiEndpoint(
  candidate: string,
  opts: ValidateOptions = {},
): string {
  const trimmed = candidate.trim()
  if (!trimmed) {
    throw new ConfigError('api endpoint is empty')
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new ConfigError(`api endpoint ${JSON.stringify(trimmed)} is not a valid URL`)
  }
  const host = parsed.hostname
  const isLoopback = isLoopbackHost(host)
  const allowInsecure = opts.allowInsecure || envFlag('BTRMNT_ALLOW_INSECURE')
  const allowUnknownHost = opts.allowUnknownHost || envFlag('BTRMNT_ALLOW_UNKNOWN_HOST')

  if (parsed.protocol !== 'https:' && !isLoopback && !allowInsecure) {
    throw new ConfigError(
      `api endpoint ${JSON.stringify(trimmed)} uses ${parsed.protocol}; ` +
        `only https:// is permitted (set BTRMNT_ALLOW_INSECURE=1 to override for self-hosted/test).`,
    )
  }
  if (!isLoopback && !isAllowedHost(host) && !allowUnknownHost) {
    throw new ConfigError(
      `api endpoint host ${JSON.stringify(host)} is not in the allowlist ` +
        `(${ALLOWED_HOST_SUFFIXES.join(', ')}); ` +
        `set BTRMNT_ALLOW_UNKNOWN_HOST=1 to allow it (do this only if you trust the host).`,
    )
  }
  return trimmed
}

export function resolveApiEndpoint(flag?: string): string {
  if (flag && flag.trim().length > 0) return flag
  const envOverride = process.env.BTRMNT_API_ENDPOINT
  if (envOverride && envOverride.trim().length > 0) return envOverride
  const pluginOption = process.env.CLAUDE_PLUGIN_OPTION_API_ENDPOINT
  if (pluginOption && pluginOption.trim().length > 0) return pluginOption
  return DEFAULT_API_ENDPOINT
}

export function resolveCredentialsPath(): string {
  const override = process.env.BTRMNT_TEST_CREDS_FILE
  if (override && override.trim().length > 0) return override
  const home = process.env.HOME ?? homedir()
  return resolve(home, '.btrmnt', 'credentials.json')
}

/**
 * Returns the dir under which the credentials file should live. Useful for
 * mkdirSync recursive before writing.
 */
export function credentialsDir(path: string): string {
  return resolve(path, '..')
}

/**
 * Working directory the CLI should treat as "the project". Tests can override
 * via BTRMNT_TEST_CWD so we don't have to chdir() the test runner.
 */
export function resolveCwd(): string {
  const override = process.env.BTRMNT_TEST_CWD
  if (override && override.trim().length > 0) return override
  return process.cwd()
}
