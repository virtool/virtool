# Dev cluster

The local Kubernetes development environment, run with Tilt on Minikube. Every
service and workflow it deploys builds from this repository, which is why the
tooling lives here rather than in a repository of its own.

The `Tiltfile` is at the **repo root**, where `tilt up` looks for it; this
directory holds everything it reads. Run every command below from the repo
root.

## Requirements

Docker Engine, `git`, Helm, `jq`, `kubectl`, `mkcert`, Minikube and Tilt.

## Stack

- **Tilt** — orchestrates the cluster; the root `Tiltfile` is the entry point
- **Minikube** — the cluster itself
- **KEDA** — scales workflow pods off a `metrics-api` trigger pointing at
  `jobs-api`'s `/jobs/counts`
- **PostgreSQL** — persisted across `tilt up` / `tilt down` by a PVC
- **Azurite** — Azure Blob Storage emulator, on the well-known dev account
  `devstoreaccount1`, persisting blobs at `/data` by a PVC

## Layout

```
Tiltfile                  at the repo root: resources, buttons, live-edit flags
dev/
  manifests/              Kustomize manifests for every cluster resource
    data/                 PostgreSQL, Azurite
    ingress.yaml
    migration.yaml
    web/
    virtool/              jobs-api, tasks
    workflows/            a ScaledJob per workflow
  scripts/
    ensure-minikube.sh    Start the cluster if it is not already running
    init.sh               Create or reset the cluster
    pull.sh               Point the manifests at the latest released image tags
    wipe.sh               Delete the StatefulSets and their PVCs
```

## Getting started

1. Create the cluster:

   ```shell
   bash dev/scripts/init.sh
   ```

   This deletes any existing cluster, creates one with preset resource limits,
   enables the `ingress` and `metrics-server` addons, issues an mkcert
   certificate for `virtool.local` and installs it as the ingress controller's
   default, and writes the cluster IP to `/etc/hosts` — which needs `sudo`.

   Run `mkcert -install` once beforehand so the certificate is trusted.

2. Start Tilt:

   ```shell
   tilt up
   ```

   Virtool is then at <https://virtool.local>.

`tilt down` brings the resources back down; run it before `minikube stop` or
the cluster does not stop cleanly. The `Tiltfile` calls
`dev/scripts/ensure-minikube.sh` as it loads, so `tilt up` starts a stopped cluster
on its own.

## Live editing

Every live-edit target builds from this repository's root `Dockerfile`, at the
stage named after the target. Pass a flag to turn one on. Each has a long form
and a short, double-dash form — Tilt's flag parser has no single-dash
shorthand, so `--w` is as short as it gets:

| Flag | Short | Image | Dockerfile stage |
| --- | --- | --- | --- |
| `--web` | `--w` | `ghcr.io/virtool/ui` | `dev` |
| `--jobs-api` | `--j` | `ghcr.io/virtool/jobs-api` | `jobs-api` |
| `--tasks` | `--t` | `ghcr.io/virtool/tasks` | `tasks` |
| `--create-sample` | `--m` | `ghcr.io/virtool/create-sample` | `create-sample` |
| `--create-subtraction` | `--b` | `ghcr.io/virtool/create-subtraction` | `create-subtraction` |
| `--nuvs` | `--n` | `ghcr.io/virtool/nuvs` | `nuvs` |
| `--pathoscope` | `--p` | `ghcr.io/virtool/pathoscope` | `pathoscope` |

Flags combine: `tilt up -- --w --j`.

`--web` runs Vite in the pod and syncs `apps/web/src` and `packages` into it,
so an edit shows up without a rebuild. The rest rebuild the image on change,
and `jobs-api` and `tasks` are on manual trigger — update them from the Tilt UI
when you want the build.

There is no migration target. Migrations are Python's, and the migration Job
runs the published `ghcr.io/virtool/virtool` image.

## Updating images

`dev/scripts/pull.sh` rewrites the manifests to the latest released tags — the
`virtool/virtool-ui` release for everything built here, and the
`virtool/virtool` release for the migration Job. Run it directly or click
**Pull** in the Tilt UI.

## Wiping data

`dev/scripts/wipe.sh` deletes the `postgres` and `azurite` StatefulSets and their
PVCs; Tilt recreates them on the next trigger. It refuses to run unless
`kubectl`'s current context is `minikube`. Run it directly or click **Wipe** in
the Tilt UI.

## Why none of this is linted or bundled

It is YAML, Bash and Starlark and no TypeScript, so nothing here is a pnpm
workspace and nothing here is built. `biome.json`'s `files.includes` carves
`dev/` out the way it carves out `apps/site`, and `.dockerignore` excludes both
`dev` and `Tiltfile` — without that, editing a manifest would land in the build
context and rebuild every live-edited image.
