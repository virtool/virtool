# Virtool

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` — never write to
`CLAUDE.md` directly.

This is a pnpm monorepo. Use `pnpm` for all install, run, and exec commands —
never `npm` or `bun`.

## Apps

| App | Purpose |
| --- | --- |
| [`@virtool/web`](apps/web/README.md) | The Virtool SPA and its TanStack Start server. |
| [`@virtool/site`](apps/site/README.md) | The product website at [virtool.ca](https://www.virtool.ca). |
| [`@virtool/jobs-api`](apps/jobs-api/README.md) | Lets workflow runners claim, run, and finish jobs. |
| [`@virtool/tasks`](apps/tasks/README.md) | Runs the periodic task spawner and task runner in one process. |
| [`@virtool/create-sample`](apps/create-sample/README.md) | Creates a sample from uploaded FASTQ files. |
| [`@virtool/create-subtraction`](apps/create-subtraction/README.md) | Creates a subtraction from an uploaded FASTA. |
| [`@virtool/pathoscope`](apps/pathoscope/README.md) | Quantifies known viruses in a sample. |
| [`@virtool/nuvs`](apps/nuvs/README.md) | Finds viruses absent from the reference. |

## Packages

`packages/` holds shared workspace libraries and two standalone Rust crates.
Apps bundle; packages stay source.

| Package | Purpose |
| --- | --- |
| [`@virtool/archive`](packages/archive/README.md) | Tar, gzip, and zip utilities. |
| [`@virtool/bio`](packages/bio/README.md) | Sequence utilities and workflow text parsers. |
| [`@virtool/contracts`](packages/contracts/README.md) | Shared wire shapes and isolated server-only helpers. |
| [`@virtool/data`](packages/data/README.md) | Server-only Drizzle schema mirror and Postgres queries. |
| [`@virtool/logger`](packages/logger/README.md) | Shared pino configuration. |
| [`@virtool/sentry`](packages/sentry/README.md) | Shared browser and server Sentry wiring. |
| [`@virtool/service`](packages/service/README.md) | Shared lifecycle utilities for long-lived services. |
| [`@virtool/sqlite`](packages/sqlite/README.md) | Reference-index SQLite schema, reader, and writer. |
| [`@virtool/storage`](packages/storage/README.md) | Server-only streaming object storage. |
| [`@virtool/workflow`](packages/workflow/README.md) | Workflow runtime and testing harness. |
| [`pathoscope-core`](packages/pathoscope-core/README.md) | Rust implementation of Pathoscope reassignment. |
| [`quality-core`](packages/quality-core/README.md) | Rust implementation of sample quality statistics. |

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

Add every new workflow image or crate input, including each Dockerfile `COPY`
source, to the corresponding filter in `.github/workflows/ci.yaml`. See
[docs/ci.md](docs/ci.md) for the filter boundaries and rationale.

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

See [docs/code-style.md](docs/code-style.md) for rationale and examples.

- **Functions:** Use function declarations, not arrow functions.
- **Refs:** Treat `ref` as an ordinary prop; do not use `forwardRef`.
- **Imports:** Biome organises imports automatically. Don't manually organise
  or clean up unused imports.
- **Conditionals:** Always use curly braces with `if`/`else`.
- **Prefer `const`** over `let`.
- **Types:** Use `type`, not `interface`.
- **JSDoc:** Give every exported `type` a one-line `/** ... */` that begins
  with what the type is.
- **Naming:** `is`/`has`/`get` for pure reads; `check`/`validate`/
  `assert` for operations that may throw. Suffix `createServerFn` exports with
  `Fn`; keep wrapped domain-function names unsuffixed.
- **Comments:** Default to none. Comment only to explain non-obvious reasons;
  do not restate code, narrate history, reference the current task, or name a
  caller.
- **Concurrency:** Put independent awaits in `Promise.all`; use
  `Promise.allSettled` when every outcome is required.

## Testing

- Import Vitest APIs explicitly from `vitest`.
- Give each database test file its own `createTestDatabase()` instance.
- Use explicit `expect()` assertions, not snapshots.
- Keep each test double in one owning harness, beside the boundary it models.

App and package READMEs document their test harnesses and commands.

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
