# Development

## Coasts and Worktrunk

The root `Coastfile` uses `dev/compose.yaml` for an isolated app per
worktree. Postgres and Azurite are shared; each instance owns a database and
blob container. The root `docker-compose.yml` remains the database test
environment.

Requires Docker Engine, Python 3.11+, Worktrunk 0.77.0, Coasts 0.1.53, and mise
with shell activation enabled. Mise adds the repository's `dev/bin` directory
to `PATH` so the `coasts` command is available in each up-to-date worktree.
The integration checks the Coast version because it uses that release's local
JSON API for state and readiness. Coasts 0.1.53 interpolates assignment paths
into shell commands without quoting them. The controller accepts
only letters, numbers, `/`, `_`, `.`, `+`, and `-` in repository/worktree paths
and branch names, rejecting spaces, or shell metacharacters before provisioning.
`coast` can be on `PATH` or installed at `~/.coast/bin/coast`.

Start the daemon once, then start the current worktree:

```bash
coast daemon start
coasts up
coast ui
```

Creating or switching worktrees doesn't provision a Coast. Run `coasts up`
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
`list` includes these pending records so bypassed hooks don't hide leftover
data.

### Workflow execution

Each Coast starts one Compose service for each workflow type. An executor polls
only its own queue, claims at most one job, and exits after that job or after
120 seconds without one. Compose restarts it unless the Coast was stopped.
No separate workflow launcher runs.

The executors still use the production claim, ping, cancellation, finalization,
failure, and exit paths. Each one connects directly to its Coast's private jobs
API and blob container. Compose applies per-executor CPU and memory limits, and
stopping a Coast stops its executors.

This deliberately doesn't reproduce KEDA. One polling executor always runs
per workflow type, queue depth doesn't add parallel workers, and
there is no global concurrency limit across Coasts. Up to four jobs can run in
each active Coast, including memory-heavy jobs at once. Stop unused
Coasts before exercising heavy workflows on a constrained host.

All four workflow targets are part of the Coast build instead of being built
on demand. Docker still caches their independent tool stages, but a new artifact
includes every executor and can take longer to build than the
core app alone.

### Browser access

Use the HTTPS URL printed by `coasts up` or shown in `wt list`. Each instance has
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
excluded. Raw Coast operations bypass this publication; run `coasts up` to refresh
it. Stopped instances keep their links but must be resumed from the terminal.

Discovery is a read-only, same-origin Vite endpoint backed by an ignored local
file. It publishes no data IDs, credentials, or worktree paths, and has no
start/stop/remove operations. The endpoint and switcher are absent from
production output. The generated file is excluded from Docker build contexts
and Vite watching, so switching terminals doesn't trigger page reloads.

Use `wt list` for branch/worktree status and app links after `coasts
up`, Coastguard for live service status and logs, and the badge for browser
switching.

Coasts shares its local Caddy CA across instances. After the first successful
startup, the controller copies the public certificate to
`<git-common-dir>/virtool-coasts/root.crt`. Trust that certificate in your
OS/browser once. No private key is exported and the controller doesn't change
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
origin. Raw Vite port 9900 isn't the configured authentication origin. Legacy
trial instances still require their original `http://localhost:9900` URL.

### Lifecycle and data

The registry, operation locks, build cache record, and logs live in
`<git-common-dir>/virtool-coasts/`, outside individual worktrees, and Coast
volumes. A generation marker in each worktree's Git directory survives branch
renames and worktree moves. Git removes that marker when deleting a worktree,
so reusing the same path can't inherit its old data even if hooks were bypassed.
Instance names combine a readable branch slug with a random suffix; recreating
a removed worktree creates a new data identity. `list` flags unmatched records
as orphaned; clean them with `remove --instance <name>`.

Provisioning runs with Compose autostart off. The lifecycle script first
records an instance's data ID, then writes its identity and origin into the
isolated configuration volume before starting initialization or app
services. Database creation, migrations, and blob-container initialization
complete before the app starts. Coasts 0.1.53 doesn't wire its
documented automatic database injection into startup, so initialization remains
explicit.

Removing a worktree through Worktrunk still stops its Coast, drops its database,
deletes its blob container, and removes the Coast. Cleanup failure blocks
worktree removal and preserves a pending record for retry. Stopping an instance
with pending cleanup preserves that state; the controller refuses to start it
until removal succeeds. Only that instance's data is deleted; shared
service volumes are never reset. Stopping an instance preserves its data.

Resume checks Docker's outer-container state as well as Coast's recorded state.
Coasts 0.1.53 can report successful startup even after the outer container has
exited. Its shared-service setup kills PIDs saved by an earlier boot without
checking process identity. The controller starts the stopped outer container,
clears those obsolete proxy PID files, then lets Coast restore mounts, proxies,
and services. It checks the outer container again and still requires app
readiness before reporting success. This never recreates the configuration
volume or changes the data identity.

Don't use raw `coast rm` for managed instances: it leaves their database and
blobs behind. If you used it, run the lifecycle `remove` command before
recreating the instance. Legacy manually created trial instances aren't
adopted or deleted by the hooks; clean those separately after identifying their
data ID in `/run/virtool-dev/namespace`.

Shared Postgres uses `virtool-shared-services-postgres` and host port 15432.
Shared Azurite uses `virtool-shared-services-azurite` and host port 11000. Both
stay running when instances stop. These ports must be free on first startup and
are independent of the root Compose test databases. Data
separation is for development: instances share service credentials.

The `Coastfile` generates the auth secret and encryption key with Python's
cryptographic random generator. Coast stores them in its encrypted keystore
and mounts them into app containers under `/run/secrets`; services
read them through `VT_AUTH_SECRET_FILE` and `VT_ENCRYPTION_KEY_FILE`.

Coasts 0.1.53 extracts fresh values on each Coast build and injects the current
values when creating an instance. Instances created from the same extraction
share these secrets. Existing instances keep their injected values across
stop/start and app image rebuilds. Re-running secrets on an existing
instance rotates its keys, invalidating sessions, and making encrypted data
unreadable without the old keys. See [environment configuration](../docs/env.md).
As with other Coast configuration changes, existing instances must be removed
and recreated to adopt these mounts; removal deletes their development data.

If another process takes a stopped instance's reserved dynamic port, `coasts up`
reports the occupied port before starting Docker, instead of changing its
origin. A bind race can still fail in Docker; its detailed error is in the
lifecycle log. Release that port and retry `coasts up`; don't
remove the instance or reset its data. The root test stack uses 5432 and 27017,
so it can run alongside the shared Coast services on 15432 and 11000. Those
fixed shared-service ports must remain available to Coast; there is no automatic
fallback to another port.

A failed Docker port bind can also drop the stopped container's default bridge
attachment. Resume restores a missing default bridge before starting the inner
daemon, preserving the host-gateway route to the shared services. It doesn't
disconnect shared-service networks or reset their volumes.

### Shared-service recovery

Run `coasts up` when an instance is running but can't reach Postgres or
Azurite. The controller checks shared-service registrations and actual host
containers, starts stopped shared containers, and probes the proxy addresses
from the effective Compose configuration. If a proxy is unreachable, it stops
and resumes the Coast through its lifecycle, then checks the proxies again
before proceeding. This preserves the instance's data identity and URL. A
second failed proxy check stops startup with a routing error.

Missing registrations or host containers stop startup with an explicit error.
The controller never automatically recreates shared storage. In Coasts 0.1.53,
`shared-services start` starts an existing registered container; it can't
recreate a removed service. `shared-services rm` deletes the service's named
volumes as well as its container and registration. Don't use it to repair
connectivity.

To deliberately provision a missing shared service, use a temporary, unassigned
Coast from the primary worktree. Choose an unused temporary instance name:

```bash
coast run repair-shared-services
coast rm repair-shared-services
```

With this project's `autostart = false`, provisioning creates the missing shared
containers and registrations without initializing app data. Removing
this unmanaged temporary Coast preserves shared services. Existing named volumes
are reused; absent volumes are created empty. Then run `coasts up` from the
affected worktree to initialize its database, apply migrations, and check
app readiness. Keep using `coasts remove` for managed instances.

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
SQL, workflow sources, shared package sources, and workflow Rust crates
invalidate that cache. Mounted web and internal source edits don't. Shared
package edits reach the running web and internal watchers immediately; run
`coasts up` to rebuild their bundled copies in workflow images.
`coasts up --rebuild` reapplies cached images or builds changed inputs. Changing
Coast configuration requires removing and recreating the instance with fresh data. Existing instances keep
running on their previous configuration until explicitly recreated.

Don't use `coast rebuild` with this stack. In Coasts 0.1.53 it bypasses the
shared-service override and can launch an unintended second Compose project.
The controller uses `coast docker ... compose` to preserve the effective
configuration and builds the root Dockerfile's `dev-coast`
target for web, jobs API, tasks, and migrations. Before building, it generates
ignored `.coasts/Dockerfile` from that target's parent and `COPY --from` stages.
This keeps the root Dockerfile as the source of truth for the development
image. Every refresh also builds and loads all four workflow targets from the
assigned worktree using the root Dockerfile, then replaces their containers.
All images finish loading before any service is stopped or retagged.
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
`volumes` keys explicit: Coasts 0.1.53 doesn't discover these through a
service-level YAML merge. Aliases for their values are supported.

Jobs API and tasks bundle mounted source with tsdown watch mode. A source edit
sends `SIGTERM` to the old service; its replacement waits for exit, preserving
HTTP shutdown and task draining/lease release. Rapid edits skip superseded
builds. Build failures remain visible in service logs; a successful later edit
starts the service again. Readiness checks probe both internal services because
a running watcher can outlive a failed build. Each container owns its build
output and dependencies.
Compose allows 50 seconds for shutdown, exceeding the default task budget of 40
seconds; increase that grace period if you increase the app budget.

Migrations run once as a prerequisite at startup, without a watcher. After
editing migration code or SQL, use `coasts up --rebuild` explicitly. Ordinary
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
