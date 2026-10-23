# Virtool

## Development

Virtool uses a repository-scoped development service to run isolated Docker
Compose environments for Git worktrees. Install Docker Engine, Node 24, pnpm,
and Worktrunk, then run:

```shell
vtd up
vtd ui
vtd list
vtd stop
vtd remove
```

Lifecycle commands acknowledge immediately. Follow progress in the management
UI at <https://dev.localhost:9443>. See [the development guide](dev/README.md)
for architecture, data safety, workflow scheduling, and troubleshooting.

## Images

Every image ships from a target in the root `Dockerfile`, and every release
publishes all of them.

| Target | Published image |
| --- | --- |
| `dist` | `ghcr.io/virtool/web` |
| `internal` | `ghcr.io/virtool/internal` |
| `create-sample` | `ghcr.io/virtool/create-sample` |
| `create-subtraction` | `ghcr.io/virtool/create-subtraction` |
| `pathoscope` | `ghcr.io/virtool/pathoscope` |
| `nuvs` | `ghcr.io/virtool/nuvs` |

Build one image locally by naming its target:

```shell
docker build --target pathoscope .
```
