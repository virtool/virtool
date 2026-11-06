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

Lifecycle commands return immediately. Follow progress in the management UI at
<https://dev.localhost:9443>. See [the development guide](dev/README.md) for
data safety, workflow scheduling, and troubleshooting.

## Images

Every image ships from its app's `Dockerfile`. A release publishes only the
images whose app version changed; see [Continuous integration](docs/ci.md).

| Target | Published image |
| --- | --- |
| `web` | `ghcr.io/virtool/web` |
| `internal` | `ghcr.io/virtool/internal` |
| `create-sample` | `ghcr.io/virtool/create-sample` |
| `create-subtraction` | `ghcr.io/virtool/create-subtraction` |
| `pathoscope` | `ghcr.io/virtool/pathoscope` |
| `nuvs` | `ghcr.io/virtool/nuvs` |

Build one image locally by naming its Bake target:

```shell
docker buildx bake -f packages/image-build/docker-bake.hcl pathoscope
```

The web build uploads its source maps to Sentry only when `SENTRY_AUTH_TOKEN`
is set. `SENTRY_RELEASE` names the Sentry release, because the build context
has no Git history. The release job sets both.
