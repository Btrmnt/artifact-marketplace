# artifacts plugin

Publish HTML artifacts to a private, CF-Access-gated host from inside Claude Code.

## Usage

One skill, `/artifacts`, covers the whole CLI. Invoke it and describe the
intent in natural language — Claude picks the right `btrmnt` subcommand
and interprets the JSON output.

Examples:

- `/artifacts` then "sign me in"
- `/artifacts` then "publish this folder as `epic-demo`"
- `/artifacts` then "who can view `epic-requirements`?"
- `/artifacts` then "roll prod back to the commit before lunch"

## How it works

The skill instructs Claude to run `btrmnt <subcommand>` from the plugin's
`bin/` directory and interpret the JSON output. The `btrmnt` tool handles
the OAuth localhost callback, token storage, git operations, and API calls.

Token storage: `${CLAUDE_PLUGIN_DATA}/credentials.json` (mode 0600).

## Configuration

Defaults to `https://api.btrmntlab.com`. Self-hosted deployments can override
by setting `BTRMNT_API_ENDPOINT` in the shell that runs Claude Code, or by
passing `--api-endpoint <url>` to any `btrmnt` subcommand.
