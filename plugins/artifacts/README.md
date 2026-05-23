# artifacts plugin

Publish HTML artifacts to a private, CF-Access-gated host from inside Claude Code.

## Skills

- `/artifacts:login` — first-time sign-in via Cloudflare Access.
- `/artifacts:whoami` — show the current logged-in user, tenant, and role.
- `/artifacts:new <slug> [--path <dir>]` — create a project (auto-provisions test + prod envs).
- `/artifacts:publish` — commit and push the current folder; auto-deploys to test.
- `/artifacts:promote <slug>` — fast-forward `prod` to `main`; deploys prod.
- `/artifacts:grant <email> <slug> [--env test|prod|both]` — add a viewer.
- `/artifacts:revoke <email> <slug> [--env test|prod|both]` — remove a viewer.
- `/artifacts:list` — list projects you can see.
- `/artifacts:invite <email>` — tenant admins invite another tenant user.

## How it works

Each skill instructs Claude to run `btrmnt <subcommand>` from the plugin's
`bin/` directory and interpret the JSON output. The `btrmnt` tool handles the
OAuth localhost callback, token storage, git operations, and API calls.

Token storage: `${CLAUDE_PLUGIN_DATA}/credentials.json` (mode 0600).

## Configuration

Defaults to `https://api.btrmntlab.com`. Self-hosted deployments can override
by setting `BTRMNT_API_ENDPOINT` in the shell that runs Claude Code, or by
passing `--api-endpoint <url>` to any `btrmnt` subcommand.
