---
name: artifacts:new
description: Create a new artifact project. Provisions test + prod environments and initialises a git repo from the supplied folder.
disable-model-invocation: false
---

# /artifacts:new

Expect a slug argument and an optional `--path` for the source folder
(default: cwd).

Before running the CLI, inspect the source folder. If it contains exactly
one top-level `.html` file and it is not already `index.html`, rename it to
`index.html` so it serves at the project's base URL. (The server has no
`index.html` rewrite, but it does serve `/` → `/index.html`.) For
multi-file projects, leave filenames alone.

Then run:

```
btrmnt project new <slug> --path <dir>
```

Surface the returned test URL and the git remote URL. If the project has
multiple top-level `.html` files, append each filename to the test URL when
showing it (e.g. `<test_url>/<filename>`). Warn the user the prod URL is
empty until they `/artifacts:promote`.
