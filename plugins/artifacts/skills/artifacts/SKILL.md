---
name: artifacts
description: Publish, share, and manage HTML artifacts on the btrmnt platform via the `btrmnt` CLI. Use when the user wants to sign in, create a project, publish/promote/rollback an artifact, list projects, invite teammates, or grant/revoke viewer access.
disable-model-invocation: false
---

# /artifacts

The user invoked `/artifacts` to do something with the btrmnt artifact
platform. Read their request, pick the right `btrmnt` subcommand below,
run it, and interpret the JSON output.

The CLI is the source of truth — never try to do the auth flow, git
operations, or API calls yourself in markdown. Each `btrmnt` invocation
returns JSON on stdout (success) or stderr (failure, non-zero exit).

## Command map

| User intent | Command |
| --- | --- |
| Sign in | `btrmnt login` |
| Confirm current identity | `btrmnt whoami` |
| Create a new project | `btrmnt project new <slug> --path <dir>` |
| List projects | `btrmnt project list` (or `btrmnt list`) |
| Delete a project | `btrmnt project delete <slug> --yes` |
| Publish current folder to test | `btrmnt publish` |
| Promote test → prod | `btrmnt promote <slug>` |
| Roll prod back to a commit | `btrmnt rollback <slug> --to <sha>` |
| Add a viewer | `btrmnt grant <email> <slug> [--env test\|prod\|both]` |
| Remove a viewer | `btrmnt revoke <email> <slug> [--env test\|prod\|both]` |
| Show who can view a project | `btrmnt grants <slug>` |
| Invite a tenant user | `btrmnt invite <email> [--role tenant_admin\|tenant_user]` |

For grant/revoke/publish/promote/rollback/grants, the `<slug>` positional is
optional when run from inside a project directory — the CLI resolves it
from the `btrmnt` git remote.

## Conventions that apply across commands

### Single-file HTML projects → rename to `index.html`

Before `btrmnt project new` and before `btrmnt publish`, inspect the source
folder. If it contains exactly one top-level `.html` file and it is **not**
already `index.html`, rename it to `index.html`. The server has no
`index.html` rewrite, but `/` serves `/index.html`, so this is what makes
the project's base URL viewable.

For multi-file projects, leave filenames alone.

### Multi-file HTML projects → surface every URL

After `publish`, `promote`, or `rollback`, if the project has more than one
top-level `.html` file, surface viewable URLs as `<env_url>/<filename>` for
each file — not the bare base URL. With a single `index.html`, the base
URL itself is the viewable URL.

### Error handling

- **401** from any command → tell the user to run `/artifacts` and ask to
  sign in (`btrmnt login`).
- **403** on `btrmnt invite` → the caller is not a tenant admin; say so.
- **409** on `promote` (non-fast-forward) or `rollback` (sha not in repo) →
  surface the message verbatim. For rollback's "sha not found", suggest
  `btrmnt publish` first if the commit only exists locally.

## Per-command notes

### `login`

`btrmnt login` uses the OAuth 2.0 Device Authorization Grant (RFC 8628).
It needs only outbound HTTPS — no loopback listener, no exposed local
port — so it works in headless / sandbox / remote-shell environments
(Claude Code, CI runners, SSH sessions).

The flow blocks for up to 10 minutes waiting for the user to approve in
a browser, so **always** run it in the background:

```
Bash(command="btrmnt login", run_in_background=true)
```

Within a second of starting, the CLI emits a JSON line on stderr:

```json
{
  "status":"awaiting_authorization",
  "verification_uri":"https://api.btrmntlab.com/device",
  "verification_uri_complete":"https://api.btrmntlab.com/device?user_code=ABCD-EFGH",
  "user_code":"ABCD-EFGH",
  "expires_in":600,
  "interval":2,
  "hint":"Open ... in your browser to authorise this device. If asked for a code, enter ABCD-EFGH."
}
```

Read that line (via Monitor or BashOutput on the background shell) and
**surface both the `verification_uri_complete` URL and the `user_code`
to the user verbatim**. The URL pre-fills the code, so a single click
is enough — but the standalone code matters for users on a different
device than the one running Claude Code.

The CLI tries to open the user's default browser automatically, but
that's silently best-effort — in any environment where Claude Code is
running, it won't help.

After the user approves in their browser, the CLI's next poll succeeds
and it prints `{ ok, api_endpoint, credentials_path }` on stdout, exit
0. On failure it prints `{ error }` on stderr with a non-zero exit code.
On timeout the error message says to re-run `btrmnt login`.

After success, confirm the logged-in email + tenant by running
`btrmnt whoami`.

### `whoami`

Pretty-print the returned JSON (`{ email, tenant_slug, role }`). If not
signed in, suggest sign-in.

### `project new`

Apply the single-file rename rule (above), then:

```
btrmnt project new <slug> --path <dir>
```

Surface the returned test URL and the git remote URL. Warn that the prod
URL will be empty until the first promote.

### `project list` / `list`

Render as a small table (slug, owner, test URL, prod URL). Tenant admins
see every project in the tenant; tenant users see only projects they own
or have been granted access to.

### `publish`

Run from the project's working directory. Apply the single-file rename
rule first. Echo the deployed SHA and the viewable URL(s) (see multi-file
rule).

### `promote`

```
btrmnt promote <slug>
```

Fast-forwards `prod` to `main` and redeploys. Echo the new prod SHA and
the viewable URL(s).

### `rollback`

Unlike `promote`, `rollback` can move prod backwards. It requires an
explicit `--to <sha>` (40-char hex). Help the user find the SHA before
invoking — either `git log --oneline` in the project directory or ask
which version they want and infer from commit history.

```
btrmnt rollback --to <sha>           # from project dir
btrmnt rollback <slug> --to <sha>    # with explicit slug
```

Echo the new prod SHA and the viewable URL(s).

### `grant` / `revoke`

Default scope is `--env both`. For `grant`, echo the resulting grant list.
For `revoke`, confirm the remaining grants after the operation by running
`btrmnt grants <slug>`.

### `grants`

Lists everyone with direct viewer access, grouped by email. Output is
`{ slug, viewers: [{ email, envs: [...] }, ...] }`. Visible to the project
owner and to tenant admins.

### `invite`

Tenant admins only. Default role is `tenant_user`. On 403, say clearly
that the caller needs to be a tenant admin.
