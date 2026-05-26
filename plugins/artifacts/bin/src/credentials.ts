// Read + write the CF Access JWT to the credentials file.
//
// Schema: { api_endpoint: string, token: string, expires_at: string | null }
//   - `token` is the raw Cloudflare Access JWT (the same value CF stamps as
//     `cf-access-jwt-assertion`). The CLI replays it as a `CF_Authorization`
//     cookie on every api/git call.
//   - `expires_at` is the JWT's `exp` claim rendered as ISO-8601, or null if
//     decoding fails. Purely informational — CF Access itself enforces expiry.
//
// File mode: 0600. We enforce mode 0600 on READ too — if the file ends up with
// looser perms we refuse to use it and emit a clear error. This is defence in
// depth in case a user's $HOME has a permissive umask.
//
// Windows note: Node maps NTFS ACLs to Unix mode bits very coarsely — regular
// files always report 0o666 (or 0o444 if the readonly attribute is set), and
// `chmodSync(path, 0o600)` is silently a no-op. Mode 0o600 is therefore
// unreachable on Windows regardless of the actual ACL. We skip the mode
// dance there and rely on the default ACL of %USERPROFILE%\.btrmnt\, which
// is inherited from the user's profile directory (locked to the user +
// Administrators by default).

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { randomBytes } from 'node:crypto'
import { credentialsDir, ConfigError, resolveCredentialsPath, validateApiEndpoint } from './config.js'

const isWindows = process.platform === 'win32'

export interface Credentials {
  api_endpoint: string
  token: string
  expires_at: string | null
}

export class CredentialsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CredentialsError'
  }
}

export function writeCredentials(creds: Credentials): string {
  const path = resolveCredentialsPath()
  mkdirSync(credentialsDir(path), { recursive: true, mode: 0o700 })
  // Atomic write: create a private temp file with O_EXCL+0600, then
  // rename() it over the target. Closes the brief window where
  // writeFileSync would truncate an existing world-readable file and
  // leave it readable until the chmod landed.
  const tmpPath = `${path}.tmp.${process.pid}.${randomBytes(6).toString('hex')}`
  try {
    writeFileSync(tmpPath, JSON.stringify(creds), { mode: 0o600, flag: 'wx' })
    if (!isWindows) {
      // Defence in depth — `mode` is honoured only on create, and on some
      // platforms `flag: 'wx'` may interact with umask in unexpected ways.
      chmodSync(tmpPath, 0o600)
    }
    renameSync(tmpPath, path)
    if (!isWindows) {
      // Re-chmod the final path on the off-chance the target's prior mode
      // got applied somehow during rename. Cheap insurance.
      chmodSync(path, 0o600)
    }
  } catch (err) {
    // Best-effort cleanup so we don't leave .tmp.* litter behind.
    try {
      unlinkSync(tmpPath)
    } catch {
      // already gone — fine.
    }
    throw err
  }
  return path
}

export function readCredentials(): Credentials {
  const path = resolveCredentialsPath()
  if (!existsSync(path)) {
    throw new CredentialsError(
      `Not logged in. No credentials file at ${path}. Run \`btrmnt login\` first.`,
    )
  }
  if (!isWindows) {
    const mode = statSync(path).mode & 0o777
    if (mode !== 0o600) {
      throw new CredentialsError(
        `Refusing to read credentials at ${path}: file mode is 0${mode.toString(
          8,
        )}, expected 0600. Run \`chmod 600 ${path}\`.`,
      )
    }
  }
  const raw = readFileSync(path, 'utf-8')
  let parsed: Credentials
  try {
    parsed = JSON.parse(raw) as Credentials
  } catch (err) {
    throw new CredentialsError(`Corrupt credentials file at ${path}: ${(err as Error).message}`)
  }
  if (!parsed.token || !parsed.api_endpoint) {
    throw new CredentialsError(`Credentials file at ${path} is missing token or api_endpoint.`)
  }
  // Re-validate the stored endpoint. A plugin upgrade may have tightened
  // the rules (or the file may have been tampered with) — better to fail
  // fast than to keep sending the JWT to a host we'd no longer allow.
  try {
    validateApiEndpoint(parsed.api_endpoint)
  } catch (err) {
    if (err instanceof ConfigError) {
      throw new CredentialsError(
        `Credentials file at ${path} references an api_endpoint we no longer trust: ` +
          `${err.message}. Run \`btrmnt login\` to re-authenticate against a valid endpoint.`,
      )
    }
    throw err
  }
  return parsed
}
