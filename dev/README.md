# Development service

`@virtool/dev` is the Linux-only local development coordinator. One daemon runs
per Git repository and manages a distinct Docker Compose environment for each
worktree. It is intentionally specific to Virtool.

Node 24, pnpm, Docker Engine with Compose, Git, and Worktrunk are prerequisites.
The pnpm workspace must be installed before the first command. Mise adds
`dev/bin` to `PATH`.

```shell
vtd up
vtd stop
vtd remove
vtd list
vtd ui
vtd daemon stop
```

The first command installs and starts a repository-specific systemd user
service from the primary checkout. Mutations record desired state and return
immediately with <https://dev.localhost:9443>; the UI reports build, migration,
readiness, failure, and cleanup progress. Environment details retain the latest
startup timeline, including its elapsed time and failed stage.

## Architecture

The daemon resolves the repository through the absolute Git common directory and
stores its generated UUID, SQLite state, operation history, secrets, rendered
Compose inputs, and logs under `<git-common-dir>/virtool-dev/`. Its CLI uses a
repository-specific Unix socket below `$XDG_RUNTIME_DIR/virtool-dev/`. The HTTP
API uses a repository-local Unix socket that Caddy exposes at the management
origin.

The generated `virtool-dev-<repository-id>.service` unit is stored under
`<git-common-dir>/virtool-dev/systemd/`, linked into the user manager, and
started on demand. It is not enabled at login. The daemon stays in the
foreground, systemd restarts it after crashes and source updates, and a
process-lifetime `flock` prevents a second service from owning the same
repository. `vtd daemon stop` asks systemd to stop the unit. Use
`systemctl --user status virtool-dev-<repository-id>.service` for service state;
the management UI continues to read its bounded systemd journal. Its log viewer
can also tail and filter Compose output by environment and
service, pause automatic scrolling, and copy or download the visible lines.

An update waits for lifecycle operations and workflow executors to finish, then
the daemon drains its background reconciliation and scheduler work before
closing SQLite. It exits with a restart status and relies on systemd to launch
the replacement, which rebuilds the management client when its source changed;
it never spawns a detached copy itself.

The daemon continuously reconciles Git, durable desired state, and Docker. Git
worktrees appear in the UI before an environment is created. The first `up`
mints an immutable environment ID and hostname. Branch renames and worktree
moves update their display values without changing the database, blob
container, secrets, Compose project, or HTTPS origin.

One repository Compose project owns Postgres, Azurite, Caddy, and their durable
storage. Environment projects contain migrations, jobs API, tasks, and web
services. Every managed Docker resource carries repository, environment,
generation, and role labels. Cleanup validates those identities and never
removes shared infrastructure.

The shared gateway uses port 9443 without fallback:

- `https://dev.localhost:9443` serves the management UI.
- `https://<environment>.localhost:9443` serves an environment.
- signed `/devstoreaccount1/` requests route to shared Azurite.

Caddy owns one development CA. Its public root is published at
`<git-common-dir>/virtool-dev/root.crt` for manual trust; the service never
changes the host trust store.

## Lifecycle and data safety

Starting ensures shared infrastructure, creates the isolated database and blob
container, writes stable mode-0600 secrets, builds the core image, migrates the
database, starts application services, and checks readiness. Stopping preserves
all data and identity. Removing stops writers first, then deletes only the
target database, container, secrets, and Docker resources. Interrupted removal
is retained and retried.

The daemon does not silently recreate missing shared storage. A missing volume
after initialization is treated as possible data loss and shown as an error.
Use the confirmed shared reset control only when destroying all local
development state is intentional.

Worktrunk's removal hook only requests asynchronous deletion. If a worktree
disappears without the hook, cleanup is allowed only after successful Git
inspection proves its durable worktree identity is gone and Docker ownership
labels still match.

## Workflows and builds

Core builds have priority and only one repository build runs at a time.
Workflow images build on demand. The daemon polls the production-compatible
jobs counts endpoint for ready environments, schedules the four bioinformatics
executors fairly, and holds one global slot per one-shot container. The default
repository-wide concurrency is one. Tasks remain a normal long-lived service.

Executors continue to claim atomically from the jobs API and use the production
ping, cancellation, finalization, failure, and exit contracts. Stopped, failed,
stopping, and removing environments receive no new workflow work.

## Rollout

The new service has no migration or compatibility wrapper for the former Coasts setup.
Before uninstalling Coasts, remove its managed environments with the old branch
and tool. The new service uses distinct projects, volumes, labels, databases,
blob containers, secrets, and state and will neither adopt nor delete them.

## Measurements

Record cold start, warm start, stop, and rebuild timings from operation history
when changing the development stack. These are comparative observations, not
machine-independent test thresholds.
