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

Every image ships from its app's `Dockerfile`. A release publishes only the
images whose app version changed; see [Continuous integration](docs/ci.md).

| Target | Published image |
| --- | --- |
| `dist` | `ghcr.io/virtool/web` |
| `internal` | `ghcr.io/virtool/internal` |
| `create-sample` | `ghcr.io/virtool/create-sample` |
| `create-subtraction` | `ghcr.io/virtool/create-subtraction` |
| `pathoscope` | `ghcr.io/virtool/pathoscope` |
| `nuvs` | `ghcr.io/virtool/nuvs` |

Build one image locally by building the app, preparing its pruned context, and
naming its Bake target:

```shell
pnpm --filter @virtool/pathoscope build
pnpm --filter @virtool/pathoscope --prod deploy .docker-build/pathoscope --force
docker buildx bake -f packages/image-build/docker-bake.hcl pathoscope
```

The web image needs no pruned context. Build the app and then name the `web`
Bake target.
