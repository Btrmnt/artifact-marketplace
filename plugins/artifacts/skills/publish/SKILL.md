---
name: artifacts:publish
description: Commit local changes and push them; auto-deploys to the project's test environment.
disable-model-invocation: false
---

# /artifacts:publish

In the project's working directory, run:

```
btrmnt publish
```

This stages all files, commits with an auto-generated message, and pushes to
`main` on the server. The server's post-receive hook redeploys the test env.

Before running `btrmnt publish`, if the project contains exactly one
top-level `.html` file and it is not already `index.html`, rename it to
`index.html` so it serves at the project's base URL.

Echo the deployed SHA on success. If the project has multiple top-level
`.html` files, surface viewable URLs as `<test_url>/<filename>` for each —
not the bare base URL. With a single `index.html`, the base test URL is the
viewable URL.
