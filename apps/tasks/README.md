# @virtool/tasks

The task service: **one** long-lived process carrying both halves of Virtool's
task system — the periodic spawner that inserts scheduled tasks, and the runner
that claims and executes what it spawns.

Image: `ghcr.io/virtool/tasks`. No ingress and **no Service** — its
HTTP listener serves only `GET /health/live`, `GET /health/ready` and a
token-gated `GET /metrics` on `VT_TASKS_PROBE_PORT` (**9900**).

Neither half has a flag to turn it off. The cutover from Python is two
deployments inside a minute, and a minute of task lag is invisible to a user,
so a staged rollout buys nothing.

## Shape

Everything is built inside `bootstrap()` (`src/bootstrap.ts`), the composition
root — config, logger, pool, emitter, storage, registry, listener. This app has
no module-scope singleton of any kind, so a module of it can be imported to read
a type without opening anything.

- `src/spawner.ts` — the periodic spawner, over `src/tasks/periodic.ts`
- `src/runner.ts` — claim, dispatch, heartbeat, drain
- `src/framework/` — `defineTask`, the progress writer and `runTask`
- `src/tasks/` — the task bodies, named for the `type` column in skewer case
  (`refresh-hmms.ts` for `refresh_hmms`), registered in `src/tasks/registry.ts`
- `src/download.ts` — downloading a release archive to disk, with the bounded
  retry, idle-stall timeout and status check `install_hmms` needs

A claim is a lease encoded on `acquired_at`, renewed every 60 s and live for
300. A reclaimed task re-runs from step zero, so **every task body must be
idempotent**.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/tasks build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/tasks start` | Run the bundle |
| `pnpm --filter @virtool/tasks test` | Run the Vitest suite (needs Docker — Postgres testcontainer) |
| `pnpm --filter @virtool/tasks typecheck` | `tsc --noEmit` |

## Documentation

`docs/tasks.md` covers the config table, the `AppContext` contract, shutdown
ordering, the lease and fencing rules, the framework's step model, the runner's
loop and the task-body contracts in full. `docs/apps.md` covers the bundling
and `pnpm deploy` pipeline every non-Vite app shares, and `docs/images.md` the
image pipeline.
