# Dev cluster

The local Kubernetes development environment, run with Tilt on Minikube. Every
service and workflow it deploys builds from this repository, which is why the
tooling lives here rather than in a repository of its own.

The `Tiltfile` is at the **repo root**, where `tilt up` looks for it; this
directory holds everything it reads. Run every command below from the repo
root.

## Per-worktree isolation

Each git worktree runs its own dev instance in its own Kubernetes namespace, so
parallel branches never collide over ports, data or images on one Minikube
cluster. The `WT` environment variable names the namespace; `up.sh` sets it and
the `Tiltfile` reads it. The 8 CPU / 16 GB node cannot fit two full clusters,
so a few resources are shared singletons rather than per-worktree:

| Scope | What |
| --- | --- |
| Cluster-wide, set up once by `init.sh` | Minikube, metrics-server, ingress-nginx, KEDA, the wildcard TLS certificate |
| Per worktree, brought up by `up.sh` | The namespace and everything in it — web, jobs-api, tasks, migration, workflows, Postgres, Azurite |

Each worktree is reachable at `https://<WT>.<minikube-ip>.nip.io`. nip.io
resolves that host to the Minikube IP with no `/etc/hosts` entry, and the
wildcard `*.<minikube-ip>.nip.io` certificate covers every worktree.

## Requirements

Docker Engine, Helm, `kubectl`, `mkcert`, Minikube, Tilt, mise and either
`ss` or `lsof` to check which Tilt ports are free.

## Stack

- **Tilt** — orchestrates one namespace per worktree; the root `Tiltfile` is the
  entry point
- **Minikube** — the shared cluster
- **KEDA** — scales workflow pods off a `metrics-api` trigger pointing at the
  worktree's `jobs-api` `/jobs/counts`; installed once, cluster-wide
- **PostgreSQL** — one per worktree, persisted across `tilt up` / `tilt down` by
  a PVC
- **Azurite** — Azure Blob Storage emulator, one per worktree, on the well-known
  dev account `devstoreaccount1`, persisting blobs at `/data` by a PVC

## Layout

```
Tiltfile                  at the repo root: resources, buttons, live-edit flags
mise.toml                 at the repo root: convenient tasks for the dev scripts
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
    init.sh               One-time cluster-wide setup: addons, KEDA, certificate
    up.sh                 Bring up this worktree's instance and start Tilt
    down.sh               Delete this worktree's namespace
    wipe.sh               Delete this worktree's StatefulSets and their PVCs
    lib.sh                Shared helper: derive the worktree namespace slug
```

## Getting started

See the root README for the development commands. The `Tiltfile` calls
`dev/scripts/ensure-minikube.sh` as it loads, so bringing up an instance also
starts a stopped Minikube cluster. Run `tilt down` before `minikube stop` so the
cluster stops cleanly. `mise up` prints the instance URL; in terminals that
support OSC 8 it is clickable.

## Live editing

Every live-edit target builds from this repository's root `Dockerfile`, at the
stage named after the target. Pass a flag through `up.sh` to turn one on:

| Flag | Image | Dockerfile stage |
| --- | --- | --- |
| `--web` | `ghcr.io/virtool/web` | `dev` |
| `--internal` | `ghcr.io/virtool/internal` | `internal` |
| `--create-sample` | `ghcr.io/virtool/create-sample` | `create-sample` |
| `--create-subtraction` | `ghcr.io/virtool/create-subtraction` | `create-subtraction` |
| `--nuvs` | `ghcr.io/virtool/nuvs` | `nuvs` |
| `--pathoscope` | `ghcr.io/virtool/pathoscope` | `pathoscope` |

`--web` runs Vite in the pod and syncs `apps/web/src` and `packages` into it,
so an edit shows up without a rebuild. The rest rebuild the image on change,
and `jobs-api`, `tasks` and every workflow are on manual trigger — update them
from the Tilt UI when you want the build. `--internal` builds the one image the
`jobs-api` and `tasks` workloads and the migration Job all share, so a rebuild
updates all three. A workflow's pods are one-shot and
only start when something claims work, so nothing waits on a rebuild and an
automatic one would rebuild a large image on every edit.

There is no separate migration target. The migration Job runs the `internal`
image's `migrate` subcommand.

## Images

Every image this repository publishes is pinned to `latest`, so a pod picks up
the newest release each time it starts and no tag is ever committed. The
migration Job runs `ghcr.io/virtool/internal`'s `migrate` subcommand and follows
the same tag or local Tilt build as the `jobs-api` and `tasks` Deployments,
which run the same image.

Worktrees share one Minikube Docker daemon but do not collide over images: Tilt
tags each build with a content hash, so two worktrees building the same image
name get distinct tags that coexist, and each injects its own tag into its own
namespace.

## Namespacing

The manifests hard-code the `default` namespace in service FQDNs and
`virtool.local` as the ingress host, so each file stays valid on its own under
`kubectl apply -f`. The `Tiltfile` rewrites both for the worktree as it loads:
`*.default.svc.cluster.local` becomes `*.<WT>.svc.cluster.local`, `virtool.local`
becomes the worktree's nip.io host, and every object is placed in the `WT`
namespace. The KEDA operator runs cluster-wide and resolves each workflow's
trigger URL by its fully-qualified `<WT>` service name.

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

`dev/scripts/wipe.sh` deletes the `postgres` and `azurite` StatefulSets and
their PVCs in one worktree's namespace; Tilt recreates them on the next
trigger. It targets the namespace named by `WT` (or its first argument) and
refuses to run unless `kubectl`'s current context is `minikube`. Run it directly
or click **Wipe** in the Tilt UI, which passes the worktree namespace for you.

## Why none of this is linted or bundled

It is YAML, Bash and Starlark and no TypeScript, so nothing here is a pnpm
workspace and nothing here is built. `biome.json`'s `files.includes` carves
`dev/` out the way it carves out `apps/site`, and `.dockerignore` excludes both
`dev` and `Tiltfile` — without that, editing a manifest would land in the build
context and rebuild every live-edited image.
