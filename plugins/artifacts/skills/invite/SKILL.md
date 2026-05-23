---
name: artifacts:invite
description: Tenant admins only. Invite another user to the current tenant; emails them an onboarding URL.
disable-model-invocation: false
---

# /artifacts:invite

Run `btrmnt invite <email> [--role tenant_admin|tenant_user]`. Default role
is `tenant_user`. If the API returns 403, the caller is not a tenant admin —
surface that clearly.
