# Dev cluster

The local Kubernetes development environment, run with Tilt on Minikube. Every
service and workflow it deploys builds from this repository, which is why the
tooling lives here rather than in a repository of its own.

The `Tiltfile` is at the **repo root**, where `tilt up` looks for it; this
directory holds everything it reads. Run every command below from the repo
root.

## Requirements

Docker Engine, Helm, `kubectl`, `mkcert`, Minikube and Tilt.

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
    config.yaml           the Postgres and Azurite env every service shares
    data/                 PostgreSQL, Azurite
    ingress.yaml
    migration.yaml
    web/
    virtool/              jobs-api, tasks
    workflows/            a ScaledJob per workflow
  scripts/
    ensure-minikube.sh    Start the cluster if it is not already running
    init.sh               Create or reset the cluster
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
stage named after the target. Pass a flag to turn one on:

| Flag | Image | Dockerfile stage |
| --- | --- | --- |
| `--web` | `ghcr.io/virtool/ui` | `dev` |
| `--jobs-api` | `ghcr.io/virtool/jobs-api` | `jobs-api` |
| `--tasks` | `ghcr.io/virtool/tasks` | `tasks` |
| `--create-sample` | `ghcr.io/virtool/ts-create-sample` | `create-sample` |
| `--create-subtraction` | `ghcr.io/virtool/ts-create-subtraction` | `create-subtraction` |
| `--nuvs` | `ghcr.io/virtool/ts-nuvs` | `nuvs` |
| `--pathoscope` | `ghcr.io/virtool/ts-pathoscope` | `pathoscope` |

Flags combine: `tilt up -- --web --jobs-api`.

`--web` runs Vite in the pod and syncs `apps/web/src` and `packages` into it,
so an edit shows up without a rebuild. The rest rebuild the image on change,
and `jobs-api`, `tasks` and every workflow are on manual trigger — update them
from the Tilt UI when you want the build. A workflow's pods are one-shot and
only start when something claims work, so nothing waits on a rebuild and an
automatic one would rebuild a large image on every edit.

There is no migration target. Migrations are Python's, and the migration Job
runs the published `ghcr.io/virtool/virtool` image.

## Images

Every image this repository publishes is pinned to `latest`, so a pod picks up
the newest release each time it starts and no tag is ever committed. The
migration Job is the exception and stays pinned to an explicit
`ghcr.io/virtool/virtool` release: it runs Python's image, which owns the
schema, so an unrelated Python release must not migrate the dev database
without someone choosing it.

`ts-nuvs` and `ts-pathoscope` publish on release like the other two, but
neither has a usable `latest` until the first release that carries them:
`ts-nuvs` has no registry package at all, and `ts-pathoscope:latest` is the
leftover of a short-lived publish job and carries the tools with no workflow
code. Until then, run those two under `--nuvs` / `--pathoscope`, which build
the image locally.

## Labels

Every object carries the recommended Kubernetes set and nothing else:

| Label | Value |
| --- | --- |
| `app.kubernetes.io/name` | the deployable — `web`, `jobs-api`, `tasks`, `postgres`, `nuvs`, … |
| `app.kubernetes.io/component` | its role — `web`, `api`, `worker`, `database`, `storage`, `workflow`, `ingress`, `config`, `migration` |
| `app.kubernetes.io/part-of` | always `virtool` |

Selectors match on `name` + `part-of`. The workflows keep two extra namespaced
labels, `app.virtool.ca/workflow-name` and `app.virtool.ca/workflow-size`,
because size has no slot in the standard set.

Each manifest declares its own labels rather than having kustomize synthesize
them, so every file is valid on its own under `kubectl apply -f`. A selector is
immutable, so changing one of these means Tilt deletes and recreates the
workload; PVCs are retained, so the Postgres and Azurite data survive it.

## Resource sizing

`init.sh` creates an 8 CPU / 16000 MB node, and the manifests are sized to fit
it: the always-on services reserve about 1.9 CPU and 3.6 GiB between them,
which leaves room for any one workflow — or both small ones — to schedule.
Requests are dev-sized reservations and limits carry the headroom, so a
workflow's `VT_PROC` and `VT_MEM` track its **limits**; raising either without
the other is an OOMKill rather than a faster run.

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
