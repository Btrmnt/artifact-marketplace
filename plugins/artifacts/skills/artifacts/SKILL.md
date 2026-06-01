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
| Deploy / publish / "ship it" | `btrmnt publish` (→ **test only**; see "Deploying" below) |
| Promote test → prod | `btrmnt promote <slug>` (only when the user asks for prod) |
| Roll prod back to a commit | `btrmnt rollback <slug> --to <sha>` |
| Add a viewer | `btrmnt grant <email> <slug> [--env test\|prod\|both]` (defaults to **prod**) |
| Remove a viewer | `btrmnt revoke <email> <slug> [--env test\|prod\|both]` (defaults to both) |
| Show who can view a project | `btrmnt grants <slug>` |
| Invite a tenant user | `btrmnt invite <email> [--role tenant_admin\|tenant_user]` |

For grant/revoke/publish/promote/rollback/grants, the `<slug>` positional is
optional when run from inside a project directory — the CLI resolves it
from the `btrmnt` git remote.

## Conventions that apply across commands

### Deploying defaults to test — prod is a separate, explicit step

"Deploy", "publish", "ship it", "push it up", and similar **mean publish to
the test environment**. Run `btrmnt publish`, surface the test URL, and
**stop there**. Do not chain into `btrmnt promote` on your own — promoting is
what puts an artifact in front of real viewers on prod, and that should be a
deliberate decision the user makes.

Only run `btrmnt promote` when the user explicitly asks for prod — e.g. "promote
it", "send it to prod", "make it live for everyone", or confirms when you offer.
After a `publish`, it's good to *offer* the promote ("Published to test at
<url> — want me to promote it to prod?"), but never assume it.

If the user's very first request is unambiguously "deploy to prod" / "publish to
production", you still go through test first: `publish` (→ test), then
`promote` (→ prod). The two steps are not collapsible.

### Sharing defaults to prod only

When a user says "share this with <email>" / "give <email> access" without
naming an environment, grant **prod only** — `btrmnt grant <email> <slug>`
already defaults to `--env prod`. Test is the internal staging environment;
only include it when the user explicitly wants the colleague to see test
(`--env test` for test alone, `--env both` for both). When in doubt, prod
only, and say which scope you used.

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

`btrmnt login` blocks for up to 5 minutes while it waits for a browser
callback. The CLI also tries to open the user's default browser to the
auth URL — but that fails silently in headless / remote / Claude Code
shells where no display is available.

**Always** run login in the background so you can read its stderr while
it waits:

```
Bash(command="btrmnt login", run_in_background=true)
```

Within a second or two of starting, the CLI emits a JSON line on stderr:

```json
{"status":"awaiting_callback","auth_url":"https://api.btrmntlab.com/auth/start?cb=...&state=...","hint":"..."}
```

Read that line (via Monitor or BashOutput on the background shell), grab
the `auth_url`, and **surface it to the user verbatim** — they may need
to paste it into their browser manually. Then wait for the background
command to exit. On success the CLI prints `{ ok, api_endpoint,
credentials_path }` to stdout; on failure it prints `{ error }` to
stderr with a non-zero exit code.

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
rule first. Echo the deployed SHA and the **test** viewable URL(s) (see
multi-file rule). This is the end of a "deploy"/"publish" request — do not
auto-promote (see "Deploying" above). Offer the promote as a next step.

### `promote`

```
btrmnt promote <slug>
```

Fast-forwards `prod` to `main` and redeploys. **Only run when the user
explicitly asks for prod** — never as an automatic follow-on to `publish`.
Echo the new prod SHA and the viewable URL(s).

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

`grant` defaults to `--env prod` (share prod only unless the user asks for
test/both — see "Sharing defaults to prod only" above). `revoke` defaults to
`--env both` so a plain revoke removes the user from every environment. For
`grant`, echo the resulting grant list and state the scope you used. For
`revoke`, confirm the remaining grants after the operation by running
`btrmnt grants <slug>`.

### `grants`

Lists everyone with direct viewer access, grouped by email. Output is
`{ slug, viewers: [{ email, envs: [...] }, ...] }`. Visible to the project
owner and to tenant admins.

### `invite`

Tenant admins only. Default role is `tenant_user`. On 403, say clearly
that the caller needs to be a tenant admin.
