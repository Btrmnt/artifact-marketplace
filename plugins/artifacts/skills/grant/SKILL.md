---
name: artifacts:grant
description: Grant a viewer email access to a project. Defaults to both test and prod environments.
disable-model-invocation: false
---

# /artifacts:grant

Run `btrmnt grant <email> <slug> [--env test|prod|both]`. Default scope is
`both`. Echo the resulting grant list for the project.
