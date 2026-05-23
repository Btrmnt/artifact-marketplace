---
name: artifacts:rollback
description: Roll a project's prod branch back to an explicit historical commit. Use to undo a bad promote.
disable-model-invocation: false
---

# /artifacts:rollback

Unlike `promote` (which only fast-forwards), rollback can move prod
backwards. It requires an explicit `--to <sha>` (40-char hex). The server
validates the SHA exists in the project's bare repo before updating
`refs/heads/prod` and redeploying prod from that snapshot.

Help the user find the SHA before invoking. Either:

- `git log --oneline` in the project's working directory and pick a commit, or
- ask which version they want and infer from commit history.

Then run, from the project's working directory:

```
btrmnt rollback --to <sha>
```

Or with an explicit slug (if not in the project dir):

```
btrmnt rollback <slug> --to <sha>
```

Echo the new prod SHA. If the project has multiple top-level `.html` files,
surface viewable URLs as `<prod_url>/<filename>` for each — not the bare
base URL. With a single `index.html`, the base prod URL is the viewable URL.

If the API rejects with 409 ("sha not found in repo"), surface the message
verbatim and suggest `btrmnt publish` first if the commit only exists
locally.
