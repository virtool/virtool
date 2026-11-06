# @virtool/internal

Virtool's internal service. One image, `ghcr.io/virtool/internal`, carries five
processes. The first argument selects the process
(`node dist/index.mjs <command>`). See [Images](../../README.md#images) for the
shared image pipeline.

| Command            | Process                                                                           |
| ------------------ | --------------------------------------------------------------------------------- |
| `serve`            | The jobs API HTTP server workflow runners claim, update, and finish jobs through. |
| `run`              | The periodic task spawner and the task runner, in one long-lived process.         |
| `migrate`          | Applies pending Drizzle migrations, then exits. Run as an init Job.               |
| `data-migrations`  | Inspects recorded audits and backfills. Run as a Job.                             |
| `auth-remediation` | Reports how many accounts have not completed email remediation.                   |

Run `serve` and `run` as separate containers.

`serve`, `run`, `migrate`, and `data-migrations` report errors to Sentry,
tagged `service: jobs-api`, `service: tasks`, `service: migrate`, and
`service: data-migrations`. `auth-remediation` logs failures and exits non-zero
without sending them to Sentry.

When `migrate` runs a data migration, an attempt that errors is reported as an
exception. An attempt that fails with findings is reported as one issue per key
and version, with finding counts by code and the `export` document attached as
`<key>-v<version>.json`. Both are tagged `data_migration` and
`data_migration_version`.

## `auth-remediation`: remediation report

Run `node dist/index.mjs auth-remediation report` against the production
database to write one JSON document. It counts active and deactivated normal
users whose `auth_migrated_at` is still null. The counts are information only.
Unmigrated users do not block the cutover, because they can still complete
email remediation after it. Unmigrated users do not change the exit code. The
command exits non-zero only when it fails, for example when it can't read the
database.

## `serve`: the jobs API

The process workflow runners use to claim, update, and finish jobs. It binds
`VT_JOBS_API_PORT` (**9950**), the port `api-jobs-service` publishes.

See [Job lifecycle](../../docs/jobs.md) for the protocol shared with
`@virtool/workflow`, including cancellation, failure, retries, and exit codes.

## `run`: the task spawner and runner

One process carries the periodic spawner that inserts scheduled tasks and the
runner that claims and executes tasks. It has no ingress and no Service. Its
HTTP listener on `VT_TASKS_PROBE_PORT` (**9900**) serves only
`GET /health/live`, `GET /health/ready`, and `GET /metrics`. `/health/ready`
checks Postgres and returns unavailable when shutdown starts.

Each replica runs one task at a time, so the replica count sets task
concurrency. Every replica also runs the spawner, and replicas can't insert the
same periodic task twice.

If a replica stops without releasing its task, another replica claims the task
after five minutes and runs it again from the start.

A periodic task's interval is the minimum time between runs, not an exact
schedule. A task type has at most one outstanding periodic task. A periodic task
that doesn't finish within an hour fails with a `wedge ceiling` error, and the
spawner can then start a replacement.

On SIGTERM, the spawner stops, and the runner waits up to
`VT_TASKS_DRAIN_TIMEOUT` for its task. It then aborts the task and releases the
claim, so another replica can run it. The container must execute Node directly
so SIGTERM reaches the process.

## `migrate`: database migrations

Applies pending Drizzle migrations and exits. It appears as `migrate` in
`pg_stat_activity`. The image carries the migration SQL. Set
`VT_MIGRATIONS_PATH` to run against a different folder, such as a working tree
outside the image.

### Paired data migrations

Some SQL migrations pair with a TypeScript data migration that runs immediately
before them. `migrate` commits all earlier SQL first, so the data migration sees
the schema at its own position in the chain.

A pair that has passed doesn't run again. If a data migration doesn't pass,
`migrate` exits non-zero and leaves the paired SQL and every later migration
unapplied. Follow [Remediation](#remediation), then rerun `migrate`. It retries
at that boundary. A fresh installation completes in one run when all data
migrations pass.

Only one `migrate` run can work at a time. A second run exits non-zero without
doing work. SIGTERM and SIGINT stop a run at the next batch or SQL boundary.

Don't deploy with the `@virtool/data` `db:migrate` command. It can't run
TypeScript data migrations, and when an assertion stops it, its single
transaction can roll back the preceding SQL too.

## `data-migrations`: inspection

A data migration is an audit or a backfill. An attempt that reports a finding is
`failed`, and an attempt that throws is `errored`. Outcomes are stored in
`data_migrations`, with finding details in `data_migration_findings`. An attempt
with many findings counts all of them but keeps only some of the details.

| Command                        | Action                                                    |
| ------------------------------ | --------------------------------------------------------- |
| `data-migrations list`         | Report registered migrations and recorded versions.       |
| `data-migrations export <key>` | Write the current version's outcome and findings as JSON. |

Before `migrate` initializes the database, both commands report that and exit
non-zero. `export` also exits non-zero for an unrun or non-passing attempt. Only
`migrate` runs data migrations.

### Remediation

1. Read the failing key's findings from the Sentry issue's attachment, or run
   `data-migrations export <key>`.
2. Remediate the data, or deploy a corrected data migration.
3. Rerun `migrate`. It retries the pending pair and continues only after a pass.

### Migrations that affect users

`legacy_identities@2` fails on invalid handles or bcrypt hashes, corrupt
migration state, and unsafe credential linkages. Its findings use the
`user:<id>` subject. Blank, malformed, and duplicate emails don't fail it.

`forced_password_reset@1` replaces the password of each user flagged for a
forced reset and ends their sessions. These users get access again through an
administrator recovery link. Before deploy, list them:

```sql
SELECT id, handle FROM public.users WHERE force_reset = true ORDER BY id;
```

## Metrics

`serve` exposes `GET /metrics` on port 9950 and `run` on port 9900. Set
`VT_METRICS_TOKEN` and send `Authorization: Bearer <token>` to scrape them.
Without a configured token the endpoint returns 404. Invalid credentials return
401.

Both emit `virtool_*` series for the build and the Postgres pool, and standard
process metrics. `serve` adds HTTP request and job queue series. `run` adds
series for task spawns, task runs, the task queue, and email delivery. A task
type that Virtool doesn't know reports as `other`. If a database read fails
during a scrape, the series from that read are absent and the rest of the scrape
stays available.

Alert on `virtool_email_availability{state="ready"}`. It is 1 when email is
available. In the `disabled` state, Virtool still delivers mail that is already
queued, so `virtool_email_outbox` falls to zero.

See [the metrics guide](../../docs/metrics.md) to query across services.

## Configuration

Each subcommand reads its variables at startup. Every variable accepts a `_FILE`
variant, which takes precedence. See [the environment guide](../../docs/env.md)
for file-backed values and key rotation. `serve` and `run` also need
[the shared storage settings](../../packages/data/README.md#configuration).

`migrate` reads only `VT_POSTGRES_URL`, `VT_MIGRATIONS_PATH`, and
`VT_SENTRY_DSN`. `data-migrations` reads only `VT_POSTGRES_URL` and
`VT_SENTRY_DSN`. `auth-remediation` reads only `VT_POSTGRES_URL`.

| Variable                       | Type                       | Default            | Use                                                                                                                                                                                                  |
| ------------------------------ | -------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VT_JOBS_API_HOST`             | String                     | `0.0.0.0`          | `serve`: set the interface on which the API listens.                                                                                                                                                 |
| `VT_JOBS_API_PORT`             | Positive integer           | `9950`             | `serve`: set the API listen port.                                                                                                                                                                    |
| `VT_JOBS_API_SHUTDOWN_TIMEOUT` | Positive integer (seconds) | `30`               | `serve`: limit graceful shutdown. Keep it below the pod termination grace period.                                                                                                                    |
| `VT_TASKS_PROBE_PORT`          | Positive integer           | `9900`             | `run`: listen for health probes and Prometheus scrapes.                                                                                                                                              |
| `VT_TASKS_SHUTDOWN_TIMEOUT`    | Positive integer (seconds) | `40`               | `run`: limit graceful shutdown. Keep it below the pod termination grace period.                                                                                                                      |
| `VT_TASKS_DRAIN_TIMEOUT`       | Positive integer (seconds) | `25`               | `run`: give an in-flight task time to finish before its claim is released. Must be less than `VT_TASKS_SHUTDOWN_TIMEOUT`, which includes it.                                                         |
| `VT_MIGRATIONS_PATH`           | String                     | Bundled `drizzle/` | `migrate`: override the migrations folder.                                                                                                                                                           |
| `VT_POSTGRES_URL`              | URL                        | Required           | Connect to the Virtool Postgres database.                                                                                                                                                            |
| `VT_POSTGRES_POOL_MAX`         | Positive integer           | `10`               | `serve` and `run`: limit the Postgres connection pool.                                                                                                                                               |
| `VT_METRICS_TOKEN`             | String                     | Unset              | `serve` and `run`: enable `/metrics` and authenticate scrapes with a bearer token.                                                                                                                   |
| `VT_SENTRY_DSN`                | URL string                 | Unset              | `serve`, `run`, `migrate`, and `data-migrations`: send errors to Sentry.                                                                                                                             |
| `VT_ENCRYPTION_KEY`            | Base64 string (32 bytes)   | Unset              | `run`: decrypt the Resend API key and email links. When unset or invalid, email is unavailable and every other task runs normally. See [the encryption-key guide](../../docs/env.md#encryption-key). |
| `VT_ENCRYPTION_KEY_PREVIOUS`   | Base64 string (32 bytes)   | Unset              | `run`: accept encrypted values written under the prior key during rotation.                                                                                                                          |

## Development

Run these commands from the monorepo root.

| Command                                                         | Action                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm --filter @virtool/internal develop serve` / `develop run` | Watch, rebuild, and gracefully restart the selected service. |
| `pnpm --filter @virtool/internal test`                          | Run the tests. They need Docker for a Postgres container.    |
