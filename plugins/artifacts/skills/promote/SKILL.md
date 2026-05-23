---
name: artifacts:promote
description: Promote a project's current test artifact to prod. Fast-forwards the prod branch and redeploys the prod environment.
disable-model-invocation: false
---

# /artifacts:promote

Run `btrmnt promote <slug>`. Echo the new prod SHA. If the project has
multiple top-level `.html` files, surface viewable URLs as
`<prod_url>/<filename>` for each — not the bare base URL. With a single
`index.html`, the base prod URL is the viewable URL. If the API rejects the
promote (non-fast-forward), surface the message verbatim.
