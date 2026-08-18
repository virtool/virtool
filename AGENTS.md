# Virtool

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` — never write to
`CLAUDE.md` directly.

This is a pnpm monorepo. Use `pnpm` for all install, run, and exec commands —
never `npm` or `bun`.

## Apps

### apps/web

`@virtool/web`

- The Virtool single-page application and the TanStack Start server that
  serves it. Every request the SPA makes is a server function under
  `src/server/`.
- See **Client** and **Server** below, and
  [apps/web/README.md](apps/web/README.md).

### apps/site

`@virtool/site`

- The product website at [virtool.ca](https://www.virtool.ca).
- Deployed to Cloudflare Workers.
- See [apps/site/README.md](apps/site/README.md).

### apps/jobs-api

`@virtool/jobs-api`

- The service workflow runners call to claim, run and finish jobs.
- Image: `ghcr.io/virtool/jobs-api`.
- See [apps/jobs-api/README.md](apps/jobs-api/README.md).

### apps/tasks

`@virtool/tasks`

- **One** long-lived process carrying both halves of the task system: the
  periodic spawner that inserts scheduled tasks, and the runner that claims
  and executes what it spawns.
- Image: `ghcr.io/virtool/tasks`. No ingress and no Service — its listener
  serves only the health probes and a token-gated `/metrics`.
- See [apps/tasks/README.md](apps/tasks/README.md) and
  [docs/tasks.md](docs/tasks.md).

### apps/create-sample

`@virtool/create-sample`

- Turns a user's uploaded FASTQ files into a sample.
- Two steps, and one external binary, `quality-core` — a Rust crate.
- Image: `ghcr.io/virtool/ts-create-sample`.
- See [apps/create-sample/README.md](apps/create-sample/README.md).

### apps/create-subtraction

`@virtool/create-subtraction`

- Turns an uploaded FASTA into a subtraction an analysis can eliminate reads
  against.
- Two steps, and one external tool, `seqkit`.

- Image: `ghcr.io/virtool/ts-create-subtraction`.
- See [apps/create-subtraction/README.md](apps/create-subtraction/README.md).
### apps/pathoscope

`@virtool/pathoscope`

- Quantifies known viruses in a sample, reassigning the reads that matched
  more than one isolate.
- Eight steps, four external tools, and `pathoscope-core`.
- Image: `ghcr.io/virtool/ts-pathoscope`.
- See [apps/pathoscope/README.md](apps/pathoscope/README.md).

### apps/nuvs

`@virtool/nuvs`

- Finds viruses the reference does **not** describe, by discarding every read
  that maps to a known OTU or to a subtraction, assembling what is left and
  searching the contigs for viral motifs.
- Ten steps and five external tools — `skewer`, `bowtie2`, SPAdes, `hmmpress`
  and `hmmscan`.
- Image: `ghcr.io/virtool/ts-nuvs`.
- See [apps/nuvs/README.md](apps/nuvs/README.md).

## Packages

`packages/` holds shared, framework-agnostic libraries published as workspace
packages, plus two Rust crates — `pathoscope-core` and `quality-core`. Neither
crate is a pnpm workspace member; each is a standalone cargo project a workflow
invokes as a subprocess, and each has its own CI job. Only `pathoscope-core`
needs `libclang-dev` to build. `quality-core` computes a sample's `Quality`
blob from one FASTQ file and replaced FastQC in `apps/create-sample`; see
[packages/quality-core/README.md](packages/quality-core/README.md) for where it
matches FastQC and where it deliberately does not.

**Apps bundle; packages stay source.**

- `@virtool/archive` — tar, gzip and zip, for anything in the monorepo that
  reads or writes an archive. Never duplicate what it exports. See
  [packages/archive/README.md](packages/archive/README.md).
- `@virtool/bio` — sequence utilities (complement, translation, ORF finding,
  FASTA/FASTQ) and the pure text parsers the ported workflows need. See
  [packages/bio/README.md](packages/bio/README.md).
- `@virtool/contracts` — the shapes both sides of a wire share, plus the
  server-only helpers each behind its own subpath.
- `@virtool/data` — the Drizzle schema mirror and every Postgres query, as
  `packages/data/src/<feature>/data.ts`. Server-side only.
- `@virtool/logger` — a thin wrapper over pino. See
  [packages/logger/README.md](packages/logger/README.md).
- `@virtool/sentry` — the shared Sentry wiring, including the pino destination
  stream server logs are forwarded on.
- `@virtool/service` — the process-lifecycle pieces every long-lived service
  shares. Today that is `createShutdownController` (`./shutdown`) alone:
  readiness flip, LIFO hooks, listener, pool, Sentry **flush**,
  `process.exitCode` and an `.unref()`'d backstop, with every dependency
  injected. Steps take an equal share of the budget unless a hook declares its
  own `timeoutMs`, which is reserved out of what the rest divide. It is **not**
  a home for the probe server or the metrics registries, however alike those
  look across the three services.
- `@virtool/sqlite` — the reference index SQLite artifact: the schema mirror,
  the reads a workflow makes against one, and the writer that produces one.
  Depended on by both `@virtool/data`, which writes the snapshot a finished
  build publishes, and the workflow executors, which read it — that second
  consumer is why it is not part of `@virtool/workflow`. `node:sqlite` and the
  filesystem are its whole dependency surface; it has no runtime dependencies
  at all.
- `@virtool/storage` — the five-method streaming object-storage interface and
  its S3 and Azure backends. Server-side only.
- `@virtool/workflow` — the workflow runtime and testing harness.

## Rules

- No app may import another app's source.
- Don't use the dev server. Use Tilt and Minikube via the root `Tiltfile`; see
  [dev/README.md](dev/README.md).

## Tooling

### Commands (from repo root)

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Typecheck | `pnpm typecheck` |
| Lint + format | `pnpm check` |
| Format only | `pnpm format` |
| Dead-code scan | `pnpm knip` |
| Build | `pnpm build` |
| Test (all packages) | `pnpm test` |
| Test (watch, web app) | `pnpm --filter @virtool/web test:watch` |
| Test (one file) | `TZ=UTC pnpm --filter @virtool/web exec vitest run <path>` |
| Rust crates | `cargo test` / `cargo fmt` (in `packages/pathoscope-core` and `packages/quality-core`) |

`TZ=UTC` matches the `test` script and every CI test job — drop it and that
command becomes the only unpinned way to run the suite.

`pathoscope-test`, `quality-test`, `build-pathoscope` and `build-nuvs` are the
only path-filtered jobs in `ci.yaml`, and they take **a filter each**, because
their inputs differ: the crate jobs run cargo and read no TypeScript, while
each image build bundles its own app and so depends on every workspace package
its Dockerfile copies. One shared filter would run the libclang-and-cargo job
on any `packages/workflow` change, and would rebuild each image for the other's
inputs — `pathoscope-image` carries `packages/pathoscope-core` and `nuvs-image`
does not. Extend the `changes` job's filters in the same
commit as anything that gives a job a new input — in
particular, **every path a workflow Dockerfile `COPY`s must appear under that
image's filter**, or the build is skipped on the pull request that breaks it
and fails on the push to `main`, where nothing gates it. That covers everything
the shared `base` stage copies, packages the app does not import among them:
`base` copies `packages/data`, `packages/service` and `packages/bio` whichever
target was requested, so both image filters list all three.

### When to run checks

- Route changes: run `pnpm --filter @virtool/web build` before type-checking.
  This regenerates the checked-in `apps/web/src/routeTree.gen.ts`; commit it if
  changed. Never use `tsr generate`: its outdated router CLI removes required
  Start type declarations.
- Test changes: run the affected file with
  `TZ=UTC pnpm --filter @virtool/web exec vitest run <path>`.
- Before committing: run `pnpm check`, `pnpm typecheck`, and `pnpm knip`.
- Run the full test suite only when asked or for cross-cutting changes.
- All checks must pass. Treat failures as caused by your changes because `main`
  is green; never modify the working tree to compare against `main`.
- Keep no dead code. Wire up or delete unused exports; tag intentionally public,
  uncalled exports with `@public`; remove `export` from file-local symbols.

## Client

Client code is server-rendered and compiled with React Compiler. Keep render
pure: do not read browser globals, clocks, randomness, locale, or mutable
module state during render. Use `useSyncExternalStore` with a cached server
snapshot for ambient browser state and `ClientOnly` for measured subtrees.

Use aliases across directories and `@server/*` for every client-to-server
import. When adding a feature alias, add it to the server
`noRestrictedImports` list. Keep server-only and native dependencies out of
the browser graph.

Follow the client conventions in [apps/web/README.md](apps/web/README.md), with
the detailed rationale in:

- [docs/ssr.md](docs/ssr.md) — SSR, hydration, time, and CSP
- [docs/queries.md](docs/queries.md) — React Query and error/loading states
- [docs/bundling.md](docs/bundling.md) — route splitting and server-only code

## Server

Web-specific server conventions live in
[apps/web/README.md](apps/web/README.md#server-development). Keep these
repository-wide rules in view:

- Server features flow `functions.ts` → optional `service.ts` → `data.ts`.
  Framework-free persistence code belongs in `@virtool/data`; app composition
  and transport boundaries stay in the app.
- Shared wire shapes belong in `@virtool/contracts` and are imported directly.
  Shape and narrow values at the publishing boundary. Timestamps cross wires as
  `Date`; raw JSON schemas use `z.coerce.date()`.
- Virtool-owned environment variables use the `VT_` prefix, and every configured
  key supports a file-backed variant. Follow [the shared environment
  configuration pattern](docs/env.md).
- Server code logs through `@virtool/logger`, with structured fields first and
  a stable message second. Data functions receive a `Logger`; apps own logger
  construction and optional Sentry forwarding. See
  [packages/logger/README.md](packages/logger/README.md).
- Each long-lived service owns its Prometheus registry and token-gated
  `/metrics` endpoint. Keep labels bounded and use the shared constant-time
  bearer-token helper. See [the web metrics guide](apps/web/README.md#metrics),
  [the jobs API guide](apps/jobs-api/README.md#metrics), and [the tasks
  guide](docs/tasks.md).
- `apps/tasks` runs both the periodic spawner and task runner. Its lease,
  fencing, shutdown, progress, metrics, and task-body contracts are maintained
  in [docs/tasks.md](docs/tasks.md); do not duplicate them here.

## Data

### Data store: Postgres-first

The TypeScript server reads and writes Postgres only, through
`@virtool/data`; Python owns the schema and migrations. Mirror constraints
exactly, use `.$defaultFn()` for Python-side defaults, and declare explicitly
named table-level foreign keys. Serve legacy-shaped tables without
renormalizing them.

See [docs/database.md](docs/database.md) for the schema mirror, available
domains, legacy data, transactions, and index-build contract.

### Files live in object storage, shared with Python

Files live in the same S3 or Azure bucket Python uses. Stored-object keys are
recorded, never reconstructed; collect them before deleting their rows. Pass
the storage backend into data functions, log failures returned by `deleteKeys`,
and use `MemoryStorage` in unit tests. Client code must read named
`import.meta.env` keys, never the whole object.

See [docs/storage.md](docs/storage.md) for the streaming interface, key and
cleanup contracts, configuration, backend behavior, and testing.

Third-party requests identify themselves with `USER_AGENT` from
`@virtool/data/userAgent`; see [packages/data/README.md](packages/data/README.md).

## Workflows

Every executor uses `@virtool/workflow`; the runtime stays separate from the
jobs API lifecycle and has no database access. See
[the package README](packages/workflow/README.md) for runtime, subprocess,
storage, cache, and configuration contracts, and [the job lifecycle](docs/jobs.md)
for claim, ping, cancellation, failure, and exit behaviour.

Workflow files always stream, and storage keys are recorded or minted rather
than derived. See [the jobs API README](apps/jobs-api/README.md) for finalize
manifests and key validation, [indexes](docs/indexes.md) for the SQLite reference
artifact, and [workflow testing](docs/workflow-testing.md) for the shared test
harness.

## Code style

The basics:

- **Functions:** Use function declarations, not arrow functions. For React
  components this is enforced by Biome's
  `useReactFunctionComponentDefinition`. Everywhere else it stays a
  convention.
- Refs:** Don't use `forwardRef`. React 19 makes `ref` an ordinary prop:
  type a wrapper's props with `ComponentPropsWithRef` and let `ref` flow
  through the `...props` spread. `forwardRef` also trips
  `useReactFunctionComponentDefinition`, because the component ends up as a
  function expression rather than a declaration.
- **Imports:** Biome organises imports automatically. Don't manually organise
  or clean up unused imports.
- **Conditionals:** Always use curly braces with `if`/`else`.
- **Prefer `const`** over `let`.
- **Types:** Use `type`, not `interface`. Enforced by Biome's
  `useConsistentTypeDefinitions`.
- **JSDoc:** Every exported `type` gets a one-line `/** ... */`, leading
  with what the thing *is* rather than a sentence about its behavior — the
  label is the first thing a hover shows.
- **Naming:** `is`/`has`/`get` for pure reads; `check`/`validate`/
  `assert` for may-throw. The `is`/`has` line is loose — don't overthink
  it. A prepositional name (`lifetimeFor`) isn't part of the rule; prefer
  `getLifetime`. A `createServerFn` export gets an `Fn` suffix
  (`loginFn`, `getSampleFn`) — it's an RPC call, not a plain function,
  and the suffix marks that at every call site. The domain function it
  wraps keeps the plain name (`login`, `getSample`) and never crosses
  the network. `functions.ts` imports that data function under its own
  name — the `Fn` suffix already keeps the two apart, so don't alias it
  to `...Impl` on the way in.
- **Comments:** Default to none. Document *why* when non-obvious, not
  *what* — never restate the code, reference the current task, or name
  the caller (those rot the moment something moves). Never narrate
  history ("this used to do X, now it does Y") — that's git blame's job,
  and it just accretes stale layers; write a comment about a past change
  only if reverting it would silently reintroduce a bug, phrased as a
  standing warning, not a changelog. Syntax: `/** ... */` for the one-line
  JSDoc on an exported type (or a label on a function/constant that needs
  one); `/* ... */` for a multi-line *why*; `//` for one-liners only —
  never chain `//` lines into a block.
- **Concurrency:** Independent awaits go in `Promise.all` — don't pay
  the sum of latencies. Skip it when a later call needs an earlier
  result, the calls share one Postgres transaction (serialised
  server-side regardless), or an early failure should short-circuit
  expensive later work. Use `Promise.allSettled` when every result is
  needed regardless of failures.

## Testing

- **The Postgres container is described once**, in
  `packages/data/src/db/test/globalSetup.ts`. The `@virtool/data`
  project, the web app's `server` project, `@virtool/jobs-api` and
  `@virtool/tasks` all name that module as their `globalSetup` — the
  latter three through the `@virtool/data/db/test/globalSetup` subpath —
  so the options cannot drift and `withReuse()` boots one container for
  every suite locally. There is no teardown; `docker rm -f` it when done.
  Don't add a second copy of the container options.
- **Test files:** `ComponentName.test.tsx` or `functionName.test.ts`.
- **Imports:** Use explicit vitest imports (`import { describe, it,
  expect, vi } from "vitest"`).
- **Test doubles:** A helper lives in exactly one test harness. Keep app and
  package fixtures with the code whose boundary they model; do not duplicate
  them in another app's test utilities.
- **Database tests:** `createTestDatabase()` from
  `@virtool/data/db/test/fixtures` gives a suite its own isolated
  Postgres database with the schema applied, and installs the
  `client_events` emitter on it. Test files run in parallel, so never
  share one database between them. A test that stubs
  `@virtool/data/events/emit` must stub `createEmitter` alongside `emit`,
  or the fixture's install call finds nothing to call.
- **Assertions:** Use explicit `expect()` assertions, not snapshots.

See [docs/testing.md](docs/testing.md) for the unit / integration
layer split, where to mock the network boundary, snapshot guidance, the
axe-core accessibility helper, and the shared-fixtures rule.

## Process

### Documentation

Before committing, check whether your change contradicts anything in
this file. It does if you have:

- removed, added, or replaced a dependency listed under **Key libraries** in
  `apps/web/README.md`;
- deleted, moved, or renamed a file or directory named anywhere in this
  document;
- added or removed a top-level feature directory under `apps/web/src/`;
- changed a command in the **Commands** table, or changed what one does;
- added, removed, or changed a lint rule this file describes as enforced;
- changed the shape of an API this file tells agents to call.

"I'll update the docs afterwards" is how a doc goes stale. There is no
afterwards — the commit that removes the last `styled.` call site is the
commit that removes styled-components from this file.

**When to update what:**

- New behavioural rule or convention → add a one-line statement in
  the right `AGENTS.md` section and put the detail in the matching
  `docs/<topic>.md`. Create a new doc only when no existing one
  covers the area.
- Change to behaviour described in a doc → update the doc in the
  same commit. `docs/` goes stale the moment the code it describes
  changes.
- A section in `AGENTS.md` keeps growing → move the detail into a
  doc and leave a one-or-two-line pointer behind.
- A doc grows past one cohesive topic, or starts pulling in
  unrelated material to stay self-contained → split it along the
  mixed-concerns line so each half is again a leaf.
- New app or package, or a change to an app's port, image, surface or
  commands, or to what a package exports → update that directory's
  `README.md` in the same commit.

### Git

Commit messages use **Conventional Commits**. Releases are automated with
semantic-release: only `feat` (minor) and `fix` (patch) trigger a release.
Anything user-visible must be one of those — never `refactor` or `chore`.

```
type(scope): description
```

#### Types

- `feat`: new user-facing feature or capability
- `fix`: bug fix or correcting wrong behavior (includes UI adjustments and
  performance improvements)
- `chore`: internal code not yet exposed to users (e.g., new hook, data model),
  configs, dependencies, file moves/renames, build scripts
- `refactor`: restructuring code without changing behavior (e.g., extracting
  functions, renaming variables, reorganizing modules)
- `style`: formatting only — no logic changes
- `docs`: documentation changes only
- `test`: adding or updating tests
- `ci`: CI/CD pipeline changes

#### Titles

`feat` and `fix` titles are user-facing. Describe the outcome for the user,
not the code change. Implementation details go in the body, not the title.

- Bad: `fix: use shared Button component with corrected label`
- Good: `fix: correct submit button label`
- Bad: `feat: wrap save handler in a transaction`
- Good: `fix: prevent rare data loss when saving`

All other types are developer-facing — implementation details are helpful
and make commits easier to find later.

- Good: `refactor: extract form helpers into src/forms/`
- Good: `chore: add csv parser`
- Good: `test: add tests for table components and hooks`

#### Other rules

- Title: lowercase, no period, under 72 characters.
- Scope is optional. Allowed scope: `deps` (dependency changes). Do not scope
  by domain.
- Don't push or create PRs unless asked.
- Don't include a Test plan section in pull request descriptions or comments.
- Don't use `git -C <path>` unless necessary. It triggers permission prompts
  that aren't worth the trouble. Run git commands from the working directory
  instead.

#### GitHub

- PR titles must follow Conventional Commits format so they can be cleanly
  squash-merged into a single well-formed commit.

### Linear

- **Team**: Virtool
- **Team ID**: `76cf3c46-c5d9-4df4-b457-0fc053d402f7`
- **Issue prefix**: `VIR`

#### Issue conventions

- Capitalize issue titles.
- Place issues in **Todo** by default; use **Backlog** only when explicitly
  asked. If an issue seems like it should be Backlog, say so and ask.
- Never assign issues to anyone.
- **Never change an issue's status.** Status is managed automatically from
  branch and PR activity. Move an issue by hand only when explicitly told to.
  The Todo-by-default rule above governs issues you create, not ones already
  in flight.
- Label bugs as **Bug** in addition to any other labels.
