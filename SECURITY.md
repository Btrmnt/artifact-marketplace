# Security policy

This repo is the public source for the `btrmnt artifacts` Claude Code plugin
and the `btrmnt` CLI it ships. The plugin is auto-pulled by Claude Code on
every push to `main` (commit-SHA versioning), so changes here reach end-user
machines without an additional release step. Review this policy before
contributing.

## Reporting a vulnerability

Please **do not** open public GitHub issues for security problems. Instead:

1. Email **security@btrmnt.ai** with a clear description, reproduction, and
   the affected commit SHA.
2. If possible, also open a [GitHub private security
   advisory](https://github.com/btrmnt/artifact-marketplace/security/advisories/new).

You will get an acknowledgement within two business days and an initial
assessment within five. We coordinate disclosure with the reporter; please
keep the issue private until a fix has landed and propagated.

## Threat model

The plugin runs locally on the user's machine, holds a Cloudflare Access
JWT, and talks to the (private) btrmnt platform API. Specifically:

- **Local-attacker (same uid):** out of scope. Anyone running as the same
  uid can read the credentials file, dump process memory, etc. We do still
  defend against accidental leakage to **other** local users (e.g. via
  `ps`).
- **Local-attacker (different uid, same machine):** in scope. We make sure
  the JWT never appears in `ps`, shell history, or world-readable files.
- **Browser / other local-process during login:** in scope. The OAuth
  loopback flow uses a `state` nonce so a malicious tab can't inject a
  forged token into the credentials file.
- **Network attacker between CLI and api:** out of scope at this layer —
  Cloudflare Access + TLS handles transport. We do enforce `https://` (and
  an allowlist of host suffixes) on the API endpoint so a misconfigured
  endpoint can't be MitM'd.
- **Malicious server controlled via `BTRMNT_API_ENDPOINT` poisoning:** in
  scope. The CLI validates and allowlists the endpoint before any JWT is
  sent.

## Policies enforced by the CLI

| Policy | Where |
|---|---|
| Login CSRF: callback must echo a per-session `state` nonce. | `plugins/artifacts/bin/src/commands/login.ts` |
| CF Access JWT never on argv: git push uses `GIT_CONFIG_COUNT` env vars. | `plugins/artifacts/bin/src/git-auth.ts` |
| Pre-commit secret-guard blocks `.env`, AWS keys, PEM blocks, etc. Override with `--allow-secrets`. | `plugins/artifacts/bin/src/secret-guard.ts` |
| `.gitignore` scaffolded on `project new` so initial commit can't pick up secrets. | `plugins/artifacts/bin/src/secret-guard.ts`, `commands/project.ts` |
| API endpoint must be `https://` and resolve to an allowlisted host suffix; loopback exempt for tests. Opt-in via `BTRMNT_ALLOW_INSECURE` / `BTRMNT_ALLOW_UNKNOWN_HOST`. | `plugins/artifacts/bin/src/config.ts` |
| Email URL-encoded in path segments; client-side regex rejects path-breaking characters. | `plugins/artifacts/bin/src/api.ts`, `commands/grants.ts` |
| Credentials file is mode 0600 (enforced on read AND write) and written atomically via temp file + rename. | `plugins/artifacts/bin/src/credentials.ts` |

## For contributors

- Don't add features that would put a bearer token on argv. Use the env-
  driven config path or a credential helper.
- Don't introduce new ways to silently send the JWT off-host. Anything that
  reads `creds.token` and originates an HTTP request should go through
  `ApiClient`, which runs `validateApiEndpoint`.
- Be cautious with new `userConfig` fields in `plugin.json` — they become
  environment variables (`CLAUDE_PLUGIN_OPTION_*`) that an attacker may try
  to poison.
- If a change touches `bin/dist/`, make sure the CI freshness guard passes
  before merging.
