---
name: artifacts:whoami
description: Show the currently logged-in user, tenant, and role for the btrmnt artifact platform.
disable-model-invocation: false
---

# /artifacts:whoami

Run `btrmnt whoami` and pretty-print the resulting JSON
(`{ email, tenant_slug, role }`). If the user is not logged in, suggest
`/artifacts:login`.
