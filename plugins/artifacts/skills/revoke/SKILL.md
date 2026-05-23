---
name: artifacts:revoke
description: Remove a viewer email from a project. Scope to one env with --env, otherwise removes from both.
disable-model-invocation: false
---

# /artifacts:revoke

Run `btrmnt revoke <email> <slug> [--env test|prod|both]`. Confirm the
remaining grant list after the revoke.
