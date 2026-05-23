---
name: artifacts:list
description: List artifact projects the current user can see in their tenant.
disable-model-invocation: false
---

# /artifacts:list

Run `btrmnt project list`. Render as a small table (slug, owner, test URL,
prod URL). Tenant admins see every project; tenant users see only their own.
