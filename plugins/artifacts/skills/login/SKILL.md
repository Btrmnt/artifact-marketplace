---
name: artifacts:login
description: First-time sign-in for the btrmnt artifact platform. Opens the user's browser to Cloudflare Access, captures the platform token via a localhost callback, and persists it.
disable-model-invocation: false
---

# /artifacts:login

When the user invokes this skill, run:

```
btrmnt login
```

and surface any returned URL (so the user can copy/paste if their browser
doesn't open automatically). On success, confirm the logged-in email + tenant.
On failure, show the error message verbatim.

Do not attempt to handle the OAuth flow in markdown — `btrmnt login` does it.
