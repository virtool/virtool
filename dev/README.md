# Dev cluster

## Coasts and Worktrunk

The root `Coastfile` uses `dev/compose.yaml` for an isolated core application
per worktree. Postgres and Azurite are shared; each instance owns a database
and blob container. Workflow executors still require the Minikube environment
below. The root `docker-compose.yml` remains the database test environment.

Requires Docker Engine, Python 3.11+, Worktrunk 0.75.0, and Coasts 0.1.53.
The integration checks the Coast version because it uses that release's local
JSON API for state and readiness. Coasts 0.1.53 interpolates assignment paths
into shell commands without quoting them. The controller therefore accepts
only letters, numbers, `/`, `_`, `.`, `+`, and `-` in repository/worktree paths
and branch names, rejecting spaces or shell metacharacters before provisioning. `coast` can be on PATH or installed at
`~/.coast/bin/coast`.

Start the daemon once, then start the current worktree:

```bash
coast daemon start
python3 dev/scripts/coast.py ensure
coast ui
```

After approving the project's Worktrunk hooks, `wt switch -c fix-thing` starts
its Coast in the background. Switching to an existing worktree resumes its
instance if stopped and leaves a healthy instance alone. Other instances keep
running. `wt switch --no-hooks` skips automatic startup. A successful switch
means the background operation was launched; wait for readiness before opening
the application.

```bash
python3 dev/scripts/coast.py status
python3 dev/scripts/coast.py list
python3 dev/scripts/coast.py ensure                 # Retry startup
python3 dev/scripts/coast.py ensure --rebuild       # Force an image rebuild
python3 dev/scripts/coast.py stop                  # Keep data for resume
python3 dev/scripts/coast.py remove                # Delete instance and data
```

`status` prints the last lifecycle result and the log path. Coastguard shows
live service status. Logs are replaced on each operation; Worktrunk also keeps
background hook output in `wt config state logs`. `--worktree <path>` targets
another worktree. To clean an instance whose worktree was already deleted, use
`remove --instance <name>` from any remaining worktree. `list` includes these
pending records so bypassed hooks do not hide leftover data.

### Browser access

Use the HTTPS URL printed by `ensure` or shown in `wt list`. Each instance has
a unique `*.localhost` hostname and a dynamic HTTPS port that survives
stop/start. Caddy proxies HTTPS, HMR WebSockets, and streaming responses to
Vite inside that Coast. Signed uploads use the same HTTPS origin: Caddy proxies
`/devstoreaccount1/` to shared Azurite while preserving the signed resource path.
Downloads stream through the authenticated web route. Authentication uses this exact origin, including its
port; cookies are host-only and passkeys use the instance hostname as their RP
ID. Terminal switches never call `coast checkout` or redirect existing tabs.
The development badge and tab title identify the branch and instance.
Expand the badge to open another managed instance in a new tab. The list
refreshes every five seconds while expanded and shows the controller's last
reported state, not a live health check. Lifecycle operations refresh discovery
for all existing managed worktrees; orphaned records and unmanaged trials are
excluded. Raw Coast operations bypass this publication; run `ensure` to refresh
it. Stopped instances retain their links but must be resumed from the terminal.

Discovery is a read-only, same-origin Vite endpoint backed by an ignored local
file. It publishes no data IDs, credentials, or worktree paths, and has no
start/stop/remove operations. The endpoint and switcher are absent from
production output. The generated file is excluded from Docker build contexts
and Vite watching, so switching terminals does not trigger page reloads.

Use `wt list` for branch/worktree status and application links, Coastguard for
live service status and logs, and the badge for browser switching. These cover
the section 2 overview needs; a separate TUI would duplicate them and is not
planned. Revisit only if a concrete missing operation appears in daily use.

Coasts shares its local Caddy CA across instances. After the first successful
startup, the controller copies the public certificate to
`<git-common-dir>/virtool-coasts/root.crt`. Trust that certificate in your
OS/browser once. No private key is exported and the controller does not change
your trust store. It reads the public certificate through the proxy because
Coasts 0.1.53 can leave the host CA directory unreadable to the developer.

The root is created when the first proxy starts. Browsers normally resolve
`*.localhost` to loopback without DNS setup. Command-line clients may need an
explicit mapping, for example `curl --resolve <hostname>:<port>:127.0.0.1
--cacert <root.crt> https://<hostname>:<port>/health/ready`.

The controller enables project subdomain links in Coastguard and sets the
HTTPS service's URL template. Its primary badge opens the managed instance.
If you manually check out an instance, Coastguard may show its canonical port;
use `wt list` or the dynamic HTTPS link on the Ports tab for the configured
origin. Raw Vite port 9900 is not the configured authentication origin. Legacy
trial instances still require their original `http://localhost:9900` URL.

### Lifecycle and data

The registry, operation locks, build cache record, and logs live in
`<git-common-dir>/virtool-coasts/`, outside individual worktrees and Coast
volumes. A generation marker in each worktree's Git directory survives branch
renames and worktree moves. Git removes that marker when deleting a worktree,
so reusing the same path cannot inherit its old data even if hooks were bypassed.
Instance names combine a readable branch slug with a random suffix; recreating
a removed worktree creates a new data identity. `list` flags unmatched records
as orphaned; clean them with `remove --instance <name>`.

Provisioning runs with Compose autostart disabled. The lifecycle script first
records an instance's data ID, then writes its identity and origin into the
isolated configuration volume before starting initialization or application
services. Database creation, migrations, and blob-container initialization
complete before the application starts. Coasts 0.1.53 does not wire its
documented automatic database injection into startup, so initialization remains
explicit.

Removing a worktree through Worktrunk stops its Coast, drops its database,
deletes its blob container, and removes the Coast. Cleanup failure blocks
worktree removal and preserves a pending record for retry. Starting an instance
with pending cleanup is refused. Only that instance's data is deleted; shared
service volumes are never reset. Stopping an instance preserves its data.

Resume checks Docker's outer-container state as well as Coast's recorded state.
Coasts 0.1.53 can report successful startup even after the outer container has
exited. Its shared-service setup kills PIDs saved by an earlier boot without
checking process identity. The controller starts the stopped outer container,
clears those obsolete proxy PID files, then lets Coast restore mounts, proxies,
and services. It checks the outer container again and still requires application
readiness before reporting success. This never recreates the configuration
volume or changes the data identity.

Do not use raw `coast rm` for managed instances: it leaves their database and
blobs behind. If it was used, run the lifecycle `remove` command before
recreating the instance. Legacy manually created trial instances are not
adopted or deleted by the hooks; clean those separately after identifying their
data ID in `/run/virtool-dev/namespace`.

Shared Postgres uses `virtool-coasts-postgres` and host port 15432. Shared
Azurite uses `virtool-coasts-azurite` and host port 11000. Both stay running when
instances stop. These ports must be free on first startup and are independent
of Minikube and the root Compose test databases. Data separation is for
development: instances share service credentials.

If another process takes a stopped instance's reserved dynamic port, `ensure`
reports the occupied port before starting Docker, instead of changing its
origin. A bind race can still fail in Docker; its detailed error is in the
lifecycle log. Release that port and retry `ensure`; do not
remove the instance or reset its data. The root test stack uses 5432 and 27017,
so it can run alongside the shared Coast services on 15432 and 11000. Those
fixed shared-service ports must remain available to Coast; there is no automatic
fallback to another port.

A failed Docker port bind can also drop the stopped container's default bridge
attachment. Resume restores a missing default bridge before starting the inner
daemon, preserving the host-gateway route to the shared services. It does not
disconnect shared-service networks or reset their volumes.

### Builds, dependencies, and rollout

Hooks call the controller in the primary worktree. Keep that worktree on a
branch containing this integration. The primary and destination worktrees must
have matching Coast configuration; a mismatch produces an actionable failure.
Worktrunk reads hook configuration from the invoking worktree, so older branches
can still invoke their Tilt hooks. Merge the integration into those branches
before relying on automatic startup or cleanup. Manual controller commands from
the primary worktree remain available.

Initial Coast builds are serialized and reused while their inputs and latest
build ID match. Assignment changes the source mount; the controller builds
bundled services on the host, caches them by input hash, and loads them into the
owning Coast. Later switches rebuild when bundled source or dependency inputs
change, but mounted web-source edits remain live. Internal services still need
an image rebuild after edits; `ensure --rebuild` reapplies the cached images or
builds changed inputs. Changing Coast configuration requires removing and
recreating the instance with fresh data.

Do not use `coast rebuild` with this stack. In Coasts 0.1.53 it bypasses the
shared-service override and can launch an unintended second Compose project.
The controller uses `coast docker ... compose` to preserve the effective
configuration and explicitly builds the root Dockerfile's `internal` and
`dev-coast` targets.

Host dependencies are no longer installed by a blocking Worktrunk hook. Run
`pnpm install` explicitly in worktrees where editors or host checks need them;
container builds install their own dependencies.

Vite runs as the mounted source owner's UID/GID. Source mounts stay writable
only where generated files require it; shared package sources are read-only,
and dependencies and caches live in containers. Prefer `coast exec <instance>
--service web <command>` for a mapped-user shell; the controller uses root only
for provisioning and Compose administration.

`VT_COAST_BIN` overrides the executable and `VT_COAST_API` overrides the local
API address (default `http://127.0.0.1:31415`). Both accept a `_FILE` variant.
The API override must remain on loopback. The development UI link assumes the
default Coastguard port.

Run lifecycle regression tests without Docker:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s dev/scripts -p 'test_coast.py'
```

### Section 2 validation

On 2026-09-08, headless Chromium exercised the two managed instances
`chore-coasts-dev-1afb6a5ba9` (HTTPS 57804) and
`test-coast-integration-87d274966a` (HTTPS 53438) in one browser context:

- Distinct authenticated users and host-only cookies persisted in both tabs.
- Both switchers discovered the other instance and opened its exact application
  URL in a new tab. Four Worktrunk switches preserved both original tabs and
  authenticated users without navigation.
- A source edit updated the primary tab through HMR without navigation or a
  corresponding change in the secondary tab.
- Both origins supported authenticated upload creation, signed Azure block
  uploads and finalization, byte-for-byte authenticated downloads, and SSE
  responses delivering event-stream bytes.
- The root Compose Postgres and Mongo services remained healthy on 5432 and
  27017 alongside Coast's shared Postgres and Azurite on 15432 and 11000.
  Each occupied fixed port rejected a second listener. Holding the secondary's
  reserved HTTPS port made `ensure` fail before startup, preserving its bridge,
  URL, and data identity.
- A controlled stale proxy PID pointing at init reproduced Coast's successful
  start response followed by an exited outer container. The updated controller
  recovered the same instance from Coast's stale running status. The original
  incident's historical PID value was not retained.
- A second stopped-instance resume with the injected stale PID also succeeded.
  Both existing browser sessions and previously uploaded bytes survived, with
  unchanged origins and data IDs; primary health probes stayed successful
  throughout the secondary's fault and recovery tests.
- The production web build contained no discovery endpoint or switcher strings,
  including in its source maps. The development endpoint rejected foreign
  origins, incorrect hosts, and POST requests with 403.

Chromium used `ignoreHTTPSErrors` for this automated run; separate HTTPS probes
validated the exported CA and instance hostname. OS/browser trust-store setup
was not changed. WebAuthn accepted the application's RP hostname in a virtual
authenticator ceremony, but full enrollment returned 401: the existing legacy
login session is not accepted by the passkey registration endpoint. End-to-end
passkey enrollment/sign-in and physical authenticators remain unverified.

Minikube was stopped and was left stopped because available memory was below
its configured 16 GiB. This validates coexistence with the root test Compose
stack, not a running Kubernetes environment or first-time shared-service
provisioning against an unrelated process occupying a fixed port.

The lifecycle regression suite, production web build, `pnpm check`,
`pnpm typecheck`, and `pnpm knip` passed. Knip reported only its existing
`packages/pathoscope-core/**` ignore configuration hint.

## Tilt and Minikube

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
    down.sh               Tear down workloads while retaining data
    destroy.sh            Delete this worktree's namespace and data
    wipe.sh               Delete this worktree's StatefulSets and their PVCs
    status.sh             Report Minikube, Tilt, and worktree namespace status
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

## Lifecycle commands

`mise run down` tears down the worktree's workloads while retaining its
namespace and Postgres/Azurite PVCs. `mise run destroy` deletes the namespace,
which also deletes all workloads and data; use it when deleting the worktree.

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
