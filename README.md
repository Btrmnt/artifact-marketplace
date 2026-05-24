# artifact-marketplace

Public Claude Code marketplace for the **btrmnt artifacts** plugin. The plugin
lets non-technical Claude users publish HTML artifacts to a private host gated
by Cloudflare Zero Trust, without touching git, AWS, or Cloudflare directly.

## Install

In Claude Code:

```
/plugin marketplace add btrmnt/artifact-marketplace
/plugin install artifacts@artifact-marketplace
```

Then say "set up artifacts" in any folder; Claude runs the `/artifacts`
skill and walks you through the rest.

## What's inside

- `plugins/artifacts/` — the plugin source. Skills, the `btrmnt` Node CLI, and
  the `SessionStart` hook.
- `packages/types/` — `@btrmnt/artifact-types`, the TypeScript types that
  describe the platform API. Consumed both by `bin/btrmnt` here and by the
  private backend.
- `.claude-plugin/marketplace.json` — the marketplace manifest pointing at the
  one plugin.

This repo is **public** — its security model relies on platform-side OAuth and
RBAC, not on keeping plugin source secret. Backend code lives in a separate
private repo.

## Versioning

We deliberately do **not** set a `version` in `plugin.json` or in the
marketplace entry. Per the Claude Code plugin docs, omitting `version` makes
Claude Code use the git commit SHA so every push to `main` rolls out to all
users automatically. This is the right default for an actively-evolving
plugin.
