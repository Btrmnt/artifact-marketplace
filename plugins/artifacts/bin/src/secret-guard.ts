// Pre-commit secret guard. Runs before every `git add .` we trigger
// (project new, publish) so a non-technical user can't accidentally
// publish `.env`, AWS keys, or SSH private keys to the hosted git remote.
//
// Two layers:
//   1. Filename denylist — fast, no IO besides the directory walk.
//   2. Content scan — only on small text-ish files, looking for high-signal
//      prefixes (AWS access keys, GitHub PATs, OpenAI keys, private-key
//      headers). Designed to be dependency-free; we deliberately accept
//      some false negatives in exchange for zero supply-chain footprint.
//
// The CLI passes us the list of files git would actually stage (via
// `git ls-files --others --exclude-standard --cached`), so a legitimate
// gitignored `.env` doesn't trip the guard.
//
// On match the guard throws `SecretFoundError` with a list of `{file, rule}`
// pairs. The caller can offer the user a `--allow-secrets` override.

import { readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const FILENAME_RULES: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: 'env-file', pattern: /(?:^|\/)\.env(?:\.[^/]+)?$/ },
  { rule: 'ssh-private-key', pattern: /(?:^|\/)id_rsa(?:\..*)?$/ },
  { rule: 'ssh-private-key', pattern: /(?:^|\/)id_ed25519(?:\..*)?$/ },
  { rule: 'pem-key', pattern: /\.pem$/ },
  { rule: 'pkcs12', pattern: /\.p12$/ },
  { rule: 'pfx', pattern: /\.pfx$/ },
  { rule: 'btrmnt-credentials', pattern: /(?:^|\/)credentials\.json$/ },
  { rule: 'aws-dir', pattern: /(?:^|\/)\.aws\// },
  { rule: 'gcp-service-account', pattern: /(?:^|\/)serviceAccountKey[^/]*\.json$/ },
  { rule: 'gcloud-config', pattern: /(?:^|\/)\.gcloud\// },
  { rule: 'kube-config', pattern: /(?:^|\/)\.kube\/config$/ },
]

const FILENAME_ALLOWLIST: ReadonlyArray<RegExp> = [
  /(?:^|\/)\.env\.example$/,
  /(?:^|\/)\.env\.sample$/,
  /(?:^|\/)\.env\.template$/,
]

const CONTENT_RULES: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { rule: 'github-pat', pattern: /\bghp_[A-Za-z0-9]{36}\b/ },
  { rule: 'github-oauth', pattern: /\bgho_[A-Za-z0-9]{36}\b/ },
  { rule: 'openai-key', pattern: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { rule: 'anthropic-key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { rule: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]+\b/ },
  {
    rule: 'private-key-block',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  { rule: 'gcp-private-key-json', pattern: /"private_key"\s*:\s*"-----BEGIN/ },
]

export interface SecretMatch {
  file: string
  rule: string
}

export class SecretFoundError extends Error {
  constructor(public readonly matches: SecretMatch[]) {
    super(
      `refusing to stage potential secrets:\n` +
        matches.map((m) => `  - ${m.file} (${m.rule})`).join('\n') +
        `\n\nReview the files above. If a hit is a false positive, re-run ` +
        `with --allow-secrets to override.`,
    )
    this.name = 'SecretFoundError'
  }
}

const MAX_CONTENT_BYTES = 256 * 1024

function toPosix(p: string): string {
  return sep === '\\' ? p.split(sep).join('/') : p
}

function matchesFilenameRule(relPath: string): string | null {
  const posix = toPosix(relPath)
  for (const allow of FILENAME_ALLOWLIST) {
    if (allow.test(posix)) return null
  }
  for (const { rule, pattern } of FILENAME_RULES) {
    if (pattern.test(posix)) return rule
  }
  return null
}

function matchesContentRule(absPath: string): string | null {
  let size: number
  try {
    size = statSync(absPath).size
  } catch {
    return null
  }
  if (size === 0 || size > MAX_CONTENT_BYTES) return null
  let buf: Buffer
  try {
    buf = readFileSync(absPath)
  } catch {
    return null
  }
  // Buffer.includes(0) catches files with embedded NUL bytes — almost
  // certainly binary, and not worth regex-scanning. Doing the check on the
  // Buffer (not the decoded string) avoids needing a NUL literal in source.
  if (buf.includes(0)) return null
  const text = buf.toString('utf-8')
  for (const { rule, pattern } of CONTENT_RULES) {
    if (pattern.test(text)) return rule
  }
  return null
}

/**
 * Scan a set of repo-relative file paths. Throws SecretFoundError if any
 * file trips a rule. The caller is responsible for producing the list
 * (typically via `git ls-files --others --exclude-standard --cached` so
 * gitignored files are skipped).
 */
/**
 * Ask git for the list of paths that a `git add .` would stage — i.e.
 * tracked files plus untracked files that are NOT gitignored. Returns
 * POSIX-separator paths relative to `root`.
 *
 * Takes a thin `SimpleGitLike` interface so callers can pass either a
 * real simple-git instance or a test fake without dragging the simple-git
 * type surface across modules.
 */
export interface SimpleGitLike {
  raw(args: string[]): Promise<string>
}

export async function candidatePathsFromGit(git: SimpleGitLike): Promise<string[]> {
  // --others = untracked, --exclude-standard = honour .gitignore +
  // .git/info/exclude, --cached = tracked files. We deliberately don't
  // use -z (NUL-separated): paths with embedded newlines are exotic
  // enough that supporting them isn't worth the complexity here.
  const out = await git.raw([
    'ls-files',
    '--others',
    '--exclude-standard',
    '--cached',
  ])
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function assertNoSecrets(root: string, relPaths: Iterable<string>): void {
  const matches: SecretMatch[] = []
  for (const raw of relPaths) {
    const rel = toPosix(raw)
    if (rel === '' || rel === '.') continue
    const filenameHit = matchesFilenameRule(rel)
    if (filenameHit) {
      matches.push({ file: rel, rule: filenameHit })
      continue
    }
    const abs = resolve(root, rel)
    const contentHit = matchesContentRule(abs)
    if (contentHit) {
      matches.push({ file: rel, rule: contentHit })
    }
  }
  if (matches.length > 0) throw new SecretFoundError(matches)
}

/** Default .gitignore scaffolded into a new project on `btrmnt project new`. */
export const DEFAULT_GITIGNORE = `# Created by btrmnt project new.
# These patterns keep secrets and build artefacts from being pushed to the
# hosted git remote on \`btrmnt publish\`. Tighten or remove anything you
# don't need — but keep the secret-bearing entries.
node_modules/
dist/
build/
.next/
.cache/
.env
.env.*
!.env.example
!.env.sample
!.env.template
*.pem
*.p12
*.pfx
id_rsa
id_rsa.*
id_ed25519
id_ed25519.*
.aws/
.gcloud/
.kube/config
serviceAccountKey*.json
.DS_Store
*.log
`
