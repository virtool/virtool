# Development

## Coasts and Worktrunk

The root `Coastfile` uses `dev/compose.yaml` for an isolated application per
worktree. Postgres and Azurite are shared; each instance owns a database and
blob container. The root `docker-compose.yml` remains the database test
environment.

Requires Docker Engine, Python 3.11+, Worktrunk 0.77.0, Coasts 0.1.53, and mise
with shell activation enabled. Mise adds the repository's `dev/bin` directory
to `PATH` so the `coasts` command is available in each up-to-date worktree.
The integration checks the Coast version because it uses that release's local
JSON API for state and readiness. Coasts 0.1.53 interpolates assignment paths
into shell commands without quoting them. The controller therefore accepts
only letters, numbers, `/`, `_`, `.`, `+`, and `-` in repository/worktree paths
and branch names, rejecting spaces or shell metacharacters before provisioning.
`coast` can be on `PATH` or installed at `~/.coast/bin/coast`.

Start the daemon once, then start the current worktree:

```bash
coast daemon start
coasts up
coast ui
```

Creating or switching worktrees does not provision a Coast. Run `coasts up`
from a worktree when it needs a development instance. It creates the instance
on first use, resumes it if stopped, and leaves a healthy instance alone. Other
instances keep running. The command waits for readiness before returning.

```bash
coasts status
coasts list
coasts up                  # Start or resume
coasts up --rebuild        # Force an image rebuild
coasts stop                # Keep data for resume
coasts remove              # Delete instance and data
```

`status` prints the last lifecycle result and the log path. Coastguard shows
live service status. Logs are replaced on each operation. `--worktree <path>`
targets another worktree. To clean an instance whose worktree was already
deleted, use `coasts remove --instance <name>` from any remaining worktree.
`list` includes these pending records so bypassed hooks do not hide leftover
data.

### Workflow execution

Each Coast starts one Compose service for each workflow type. An executor polls
only its own queue, claims at most one job, and exits after that job or after
120 seconds without one. Compose restarts it unless the Coast was stopped.
There is no separate workflow launcher to run.

The executors still use the production claim, ping, cancellation, finalization,
failure, and exit paths. Each one connects directly to its Coast's private jobs
API and blob container. Compose applies per-executor CPU and memory limits, and
stopping a Coast stops its executors.

This deliberately does not reproduce KEDA. There is always one polling
executor per workflow type, queue depth does not add parallel workers, and
there is no global concurrency limit across Coasts. Up to four jobs can run in
each active Coast, including several memory-heavy jobs at once. Stop unused
Coasts before exercising heavy workflows on a constrained host.

All four workflow targets are part of the Coast build instead of being built
on demand. Docker still caches their independent tool stages, but a new artifact
includes every executor and can take substantially longer to build than the
core application alone.

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

Use `wt list` for branch/worktree status and application links after `coasts
up`, Coastguard for live service status and logs, and the badge for browser
switching. These cover
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

Removing a worktree through Worktrunk still stops its Coast, drops its database,
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

Shared Postgres uses `virtool-shared-services-postgres` and host port 15432.
Shared Azurite uses `virtool-shared-services-azurite` and host port 11000. Both
stay running when instances stop. These ports must be free on first startup and
are independent of the root Compose test databases. Data
separation is for development: instances share service credentials.

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

The removal hook calls the controller in the primary worktree. Keep that
worktree on a branch containing this integration. The primary and destination
worktrees must have matching Coast configuration; a mismatch produces an
actionable failure. Worktrunk reads hook configuration from the invoking
worktree, so older branches can still invoke their previous hooks. Merge the
integration into those branches before relying on opt-in startup or automatic
cleanup. Manual controller commands from the primary worktree remain available.

Initial Coast builds are serialized and reused while their inputs and latest
build ID match. Assignment changes the source mount; the controller builds the
development image on the host, caches it by input hash, and loads it into the
owning Coast. Dependency manifests, lockfiles, build configuration, migration
SQL, workflow sources, and workflow Rust crates invalidate that cache. Mounted
web, internal, and shared package source edits do not. `ensure --rebuild` reapplies
the cached image or builds changed inputs. Changing Coast configuration requires
removing and recreating the instance with fresh data. Existing instances keep
running on their previous configuration until explicitly recreated.

Do not use `coast rebuild` with this stack. In Coasts 0.1.53 it bypasses the
shared-service override and can launch an unintended second Compose project.
The controller uses `coast docker ... compose` to preserve the effective
configuration and builds the root Dockerfile's `dev-coast`
target for web, jobs API, tasks, and migrations. Before building, it generates
ignored `.coasts/Dockerfile` from that target's parent and `COPY --from` stages.
This keeps the root Dockerfile as the source of truth for the development
image. The workflow services build their root Dockerfile targets independently.
Stage declarations must be named, single-line `FROM <image> AS <name>`
instructions with literal images, named `COPY --from` dependencies, and no
build-mount dependencies; unsupported forms fail before building. Use the
controller to build so the generated file is current.

An instance refresh compares the host image ID with images already loaded in
that Coast. Matching images are retagged and services recreated without another
`docker save`/`load`; missing images are transferred before services stop.
Coasts 0.1.53 still builds/exports the same development target once per service
when creating an artifact, and exports the Node base once per build directive.
Removing that remaining duplication requires a different artifact mechanism or
an upstream change. Keep each service's `build` and
`volumes` keys explicit: Coasts 0.1.53 does not discover these through a
service-level YAML merge. Aliases for their values are supported.

Jobs API and tasks bundle mounted source with tsdown watch mode. A source edit
sends `SIGTERM` to the old service; its replacement waits for exit, preserving
HTTP shutdown and task draining/lease release. Rapid edits skip superseded
builds. Build failures remain visible in service logs; a successful later edit
starts the service again. Readiness checks probe both internal services because
a running watcher can outlive a failed build. Each container owns its build
output and dependencies.
Compose allows 50 seconds for shutdown, above the default task budget of 40
seconds; increase that grace period if you increase the application budget.

Migrations run once as a prerequisite at startup, without a watcher. After
editing migration code or SQL, use `ensure --rebuild` explicitly. Ordinary
service edits never apply migrations.

Host dependencies are no longer installed by a blocking Worktrunk hook. Run
`pnpm install` explicitly in worktrees where editors or host checks need them;
container builds install their own dependencies.

Vite runs as the mounted source owner's UID/GID. Source mounts stay writable
only where generated files require it; shared package sources are read-only,
and dependencies and caches live in containers. Prefer `coast exec <instance>
--service web <command>` for the web service. For an internal service shell, use:

```bash
coast exec <instance> --service jobs-api sh
```

`coast exec` maps the host user into the service. Raw Docker exec still defaults
to root. Internal source mounts are read-only and generated bundles stay inside
their containers. The controller uses root only for provisioning and Compose
administration.

`VT_COAST_BIN` overrides the executable and `VT_COAST_API` overrides the local
API address (default `http://127.0.0.1:31415`). Both accept a `_FILE` variant.
The API override must remain on loopback. The development UI link assumes the
default Coastguard port.

Run lifecycle regression tests without Docker:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s dev/scripts -p 'test_coast.py'
```

### Lifecycle acceptance, 2026-09-09

A live Worktrunk 0.77.0 run created two branches containing slashes and launched
their background `post-switch` hooks concurrently. Both instances reached
distinct HTTPS origins with distinct databases and blob containers. Only one
hook ran `coast build`; the other waited for and reused the shared build. Three
immediate switches, including two requests for the same instance, completed
without rebuilding or changing either identity or URL.

Stopping and ensuring one instance preserved its data ID, URL, database, and
blob container. For the other, shared Azurite was stopped for a controlled
cleanup failure. Worktrunk's `pre-remove` hook stopped the Coast and dropped its
database, then blocked worktree removal when blob deletion failed. The registry
record remained in `removing`, the worktree and blob container remained, and
the other instance stayed ready. After restarting Azurite, retrying the same
`wt remove` tolerated the absent database and removed the blob container,
Coast, registry record, and worktree. Normal removal of the second worktree did
the same. The disposable branches, instances, databases, and blob containers
were absent after the run.

### Feedback-loop measurements

Measured on 2026-09-08 with the existing test stack and two managed Coasts
running. These are single observations, not a complete controlled before/after
benchmark. No shared Docker caches were cleared.

| Operation | Elapsed |
| --- | --- |
| Existing instance image refresh before the watch change | 53.51 s |
| Development image build with an uncached dependency layer | 149.74 s |
| Unchanged cached development image build | 2.32 s |
| New watch instance, including Coast artifact build/import | 371.95 s |
| Healthy instance `ensure`, including service readiness probes | 1.99 s |
| Stop an idle watch instance | 3.06 s |
| Resume the stopped watch instance to readiness | 41.42 s |
| Internal source edit to both services ready | 4.21 s |
| Shared logger source edit to both services ready | 4.22 s |
| Web source edit to updated Vite module response | 0.53 s |

Edit measurements include polling and Docker exec overhead. The web measurement
checks the served module, not browser paint or HMR delivery. Both internal
services logged clean shutdown on source edits. An invalid TypeScript edit made
controller readiness fail; restoring valid source recovered both services.
The service children and `coast exec` used the source owner's UID, and the
validation worktree had no files owned by a different user. Stop/resume
preserved a test database row, the data identity, and the browser URL. The
validation Coast, its data, and its worktree were removed afterward; both
existing managed instances remained ready.

The 149.74-second image build spent 85.3 seconds exporting layers and 41 seconds
unpacking them. It overlapped the first Coast validation build, so do not treat
it as an isolated cold-build baseline. Coasts scanned the root Dockerfile's
Node, Debian, Rust, and Python base images for every service build declaration;
the corrected artifact reported 29 cached entries and four builds. Narrowing
those inputs and reducing repeated export/import remains unfinished.

#### Build/export comparison, 2026-09-09

Compared the full root Dockerfile with the generated development stages using
Coasts 0.1.53 on the same host. Both artifact builds used warm Docker layers;
no shared caches were pruned. The full-file control temporarily occupied the
ignored generated Dockerfile path, keeping Compose and the build target
identical. The generated file was restored before the second build.

| Operation | Full-file / forced-transfer control | Optimized |
| --- | --- | --- |
| Development image, uncached application layers | 75.76 s | 77.33 s |
| Coast artifact build | 126.53 s | 47.86 s |
| Existing instance refresh to readiness | 22.68 s | 13.82 s |

The uncached image controls used `docker build --no-cache --target dev-coast`
with the root and generated Dockerfiles, in that order, retaining the same
local Node base image. This measures uncached application layers, not a
fresh-machine download. Their similar times are expected: BuildKit already
prunes unreachable stages. A subsequent cached generated-file build took
1.99 s (an earlier observation was 1.90 s).

Artifact creation improved by 62%. Its manifest's base images went from Node,
Debian bookworm/bullseye, Rust, and Python to Node alone; reported cached-image
operations fell from 29 to 13. The refresh control forced a transfer through
the same controller path; the optimized refresh reused the loaded image ID.
The first refresh also needed a cached host build, so this comparison includes
that small extra cost.

| Development loop with a cached Coast artifact | Elapsed |
| --- | --- |
| New instance to readiness, shared services already running | 67.65–79.33 s (three runs) |
| Healthy instance `ensure` | 0.68–0.70 s |
| Stop | 1.96–2.43 s |
| Resume to readiness | 28.60–28.61 s |
| Internal edit to both updated bundles and healthy services | 2.64 s |
| New web source module to Vite response | 0.03 s |

The edit probes include command/polling overhead and do not measure browser
paint or HMR delivery. Temporary edits were restored, and every disposable
instance, database, and blob container was removed after validation.

The first startup observation is excluded: shared Azurite was stopped,
and Coasts did not resume it. Azurite was started before continuing. Existing
managed Coasts remained stopped throughout these measurements.

The stage-scanning and repeated export behavior was checked against the
[pinned Coasts build implementation](https://github.com/coast-guard/coasts/blob/v0.1.53/coast-daemon/src/handlers/build/images.rs).
These are individual observations, not a statistical benchmark.

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

The lifecycle regression suite, production web build, `pnpm check`,
`pnpm typecheck`, and `pnpm knip` passed. Knip reported only its existing
`packages/pathoscope-core/**` ignore configuration hint.
