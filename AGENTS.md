# Virtool UI

React + TypeScript single-page application for Virtool, a bioinformatics platform.

> `CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` — never write to
> `CLAUDE.md` directly.

## Repository layout

This is a **pnpm monorepo**:

- `apps/web/` — the Vite SPA. All UI code lives here.
- `apps/site/` — `@virtool/site`, the product website at
  [virtool.ca](https://www.virtool.ca) (Astro + Tailwind, deployed to
  Cloudflare Workers). Kept out of the repo-wide `pnpm check`/`pnpm knip`
  gates — Astro is not linted by biome and is opaque to knip — so its own
  Vite build (a `site-build` CI job) and Vitest suite are its gate. Deploy is
  manual: `pnpm --filter @virtool/site deploy`.
- `apps/jobs-api/` — `@virtool/jobs-api`, the jobs API: the service workflow
  runners call to claim, run and finish jobs. A Hono app on port 9950,
  mirroring Python's `virtool/jobs/main.py` (`api-jobs-service`, ClusterIP,
  **no ingress** — that absence is the security boundary). Serves
  `/health/live`, `/health/ready`, a token-gated `/metrics`, the five
  lifecycle routes — `POST /jobs/claim`, `GET /jobs/{id}`,
  `PUT /jobs/{id}/ping`, `POST /jobs/{id}/steps/{stepId}/start`,
  `POST /jobs/{id}/finish` — the two cache endpoints —
  `GET /caches/{key}` and `POST /caches` — the three finalize routes —
  `PATCH /subtractions/{id}`, `PATCH /samples/{id}`, `PATCH /analyses/{id}` —
  and the six metadata reads — `GET /samples/{id}`, `/subtractions/{id}`,
  `/indexes/{id}`, `/analyses/{id}`, `/refs/{id}` and `/settings`.
  There is **no delete and no failure route**: cancelling a job, deleting
  one and the five-minute stalled-job sweep all stay Python's. Image:
  `ghcr.io/virtool/jobs-api`, Alpine. Four rules: it is **always "the jobs
  API"**, never "the control plane" — that names its role, not the service;
  **every route must refuse an unauthenticated caller or be named in
  `PUBLIC_ROUTES`**, which `src/__tests__/authorization.test.ts` enforces —
  `POST /jobs/claim` is named there, because the key it returns is the
  thing a caller would otherwise authenticate with; **it serves records,
  never bytes** — a read hands back the recorded `storageKey` and the
  workflow fetches the object itself, so no handler streams a payload or
  builds a derived artifact, and a read is handed a `{ db }` and no
  `storage`; and a handler's floor
  is `requireJobRequest` (`src/auth/guard.ts`), which authenticates a
  workflow pod as `job-{id}:{key}` over HTTP Basic and **returns** a 401
  rather than throwing one. It resolves to a `JobPrincipal` of `{ jobId }`
  — no user, no permissions — and there is no cookie fallback; this service
  has no session model. A route carrying a **job** id in its path must
  also check it against `principal.jobId` and answer **403** on a
  mismatch; that is the handlers' job, not the guard's. On the resource
  routes, **reads take no ownership check and writes do**: which jobs may
  read which rows is not a question this service answers, but a finalize
  may only be issued by the job that produced the row. That predicate
  rides on the `UPDATE ... WHERE` in `@virtool/data` — each finalize takes
  a `jobId` after the resource id — so there is no window between checking
  and writing, and the fallback `SELECT` answers **404 → 403 → 409** in
  that order, because a row a job does not own must not report its state.
  `POST /caches` is exempt: a cache row is owned by no job. Reaching a
  terminal state
  (`cancelled`, `failed`, `succeeded`) is the only thing that revokes a job
  key, and **that refusal is the cancellation channel** — it is the one 401
  that is not opaque, naming the state (`Job is cancelled.`) in a JSON
  body, which is safe only because the check sits *after* the key
  comparison. The **job read path parses on the way out**: `toJob` runs
  the response through the `Job` schema, and a row naming a workflow the
  union does not carry is a 500 with a Sentry event naming the row —
  the runtime's client parses with the same schema, so the alternative
  is a `JobsApiError` at a runner that can do nothing about it. Nothing
  else in the service validates a response. That `Job` is **one shape,
  not one per audience**: this service, the web app and the runtime all
  publish and parse the same schema. Don't narrow it into a runner-facing
  half — both halves would be built from the same record, a field one
  audience ignores costs it nothing, and zod strips what a schema does
  not name, so an added field cannot break an older runner. It winds down through `@virtool/service`'s
  `createShutdownController`, with **no hooks registered** — it holds no
  work to hand back — and `/health/ready` reports 503 from the moment
  that flips readiness. See [docs/jobs-api.md](docs/jobs-api.md).
- `apps/tasks/` — `@virtool/tasks`, the task service: **one** long-lived
  process carrying both halves of Virtool's task system, the periodic
  spawner and the runner that claims and executes what it spawns. Image:
  `ghcr.io/virtool/tasks`, Alpine, no ingress and **no Service** — its HTTP
  listener serves only `/health/live`, `/health/ready` and a token-gated
  `/metrics` on `VT_TASKS_PROBE_PORT` (9900). The two halves are turned off
  independently with `VT_TASKS_SPAWN_ENABLED` and `VT_TASKS_CLAIM_ENABLED`
  — both default `true` — which is what decouples their rollouts without a
  second image. Everything is built inside `bootstrap()`; this app has no
  module-scope singleton of any kind, not config, not the pool, not the
  registry. See [docs/tasks.md](docs/tasks.md).
- `apps/create-subtraction/` — `@virtool/create-subtraction`, the first workflow
  executor: a one-shot process that starts, works, exits. Only its object
  storage half is wired so far. It ports Python's `create_subtraction`
  **without `build_index`**: nothing consumes a subtraction's bowtie2 shards,
  and the jobs API's finalize route accepts only `subtraction.fa.gz`, so the
  run decompresses the FASTA, computes `gc`/`count`, compresses and finalizes.
  Don't port the step or the `*.bt2` upload loop back. That leaves it running
  no external tool at all — the gzip is `@virtool/workflow`'s, in-process — so
  the image, `ghcr.io/virtool/ts-create-subtraction`, is **Alpine** and copies
  nothing from `ghcr.io/virtool/tools`. Reintroducing a tools binary means
  moving the stage to Debian in the same edit, because they are built against
  `python:3.13-bookworm` and musl cannot load them. The other three workflow
  executors get a directory, a Dockerfile stage and a CI matrix entry when
  their port lands.
- `apps/workflow-pathoscope/` — the pathoscope workflow image
  (`ghcr.io/virtool/ts-pathoscope`). Holds only a `Dockerfile` today: it
  compiles `packages/pathoscope-core` and layers the `ghcr.io/virtool/tools`
  binaries on a Debian Node base. Built from the **repo root**
  (`docker build -f apps/workflow-pathoscope/Dockerfile .`). **CI builds it but
  must not publish it** — `virtool/workflow-pathoscope` still releases the
  pathoscope workflow, and a second pipeline shipping it from here would leave
  two candidates for what the cluster runs. Don't add a publish job until that
  repo retires.
- `packages/` — shared, framework-agnostic libraries published as workspace
  packages, plus one Rust crate:
  - `@virtool/logger` — pino wrapper, server-side log defaults and
    `child({...})` pattern
  - `@virtool/bio` — sequence utilities (complement, translation, ORF
    finding, FASTA/FASTQ) and the pure text parsers the ported workflows
    need: FastQC `fastqc_data.txt` (`./fastqc`) and `hmmscan --tblout`
    (`./hmmer`). Its output is pinned byte-for-byte against Python's —
    see [docs/bio.md](docs/bio.md) before changing a parser.
  - `@virtool/contracts` — cross-process data shapes, zod-validated where a
    boundary parses them
  - `@virtool/sentry` — shared Sentry option helpers (node + browser entry
    points), plus the pino-to-Sentry log destination every server process
    attaches (`./log`)
  - `@virtool/service` — the process-lifecycle pieces every long-lived
    service shares. Today that is `createShutdownController`
    (`./shutdown`) alone: readiness flip, LIFO hooks, listener, pool,
    Sentry **flush**, `process.exitCode` and an `.unref()`'d backstop,
    with every dependency injected. It is **not** a home for the probe
    server or the metrics registries, however alike those look across
    the three services.
  - `@virtool/storage` — object storage: the S3 and Azure backends, the
    key builders, and `MemoryStorage`
  - `@virtool/data` — the database and domain data layer: the Drizzle schema,
    `createDb`, every domain's `data.ts`, the `client_events` emitter, the
    bcrypt/session/token primitives, and `AppError`
  - `@virtool/workflow` — the workflow runtime every executor runs on: the
    step model, the run loop, the work path, the subprocess runner, the eager
    `buildContext` seam, the job lifecycle loop that claims, heartbeats and
    reports over the jobs API, and the file layer — streaming transfer, gzip,
    tar and cache-key derivation. It takes a `StorageBackend` as an argument
    and knows nothing about a database — see the section below. It is the
    only place in the repo that spawns a process, and so the only one
    depending on `execa`.
  - `pathoscope-core` — **Rust, not TypeScript.** Pathoscope's EM core as a
    standalone CLI, invoked as a subprocess. It is not a pnpm workspace (it
    has no `package.json`) and is excluded from biome and knip by name —
    see [docs/pathoscope-core.md](docs/pathoscope-core.md) before touching
    it. Its results are pinned byte-for-byte against the Python extension
    module it replaced.

  `@virtool/data` and `@virtool/storage` are server-side only. Browser code
  must never import them; they reach `apps/web` through `src/server/**`. A
  Biome `noRestrictedImports` override outside `apps/web/src/server/**`
  enforces that, and the `web` Vitest project aliases the pool-opening modules
  to a guard that throws.

  Neither package constructs anything at import time — both take their
  dependencies as arguments — which is what lets the jobs API and the workflow
  ports reuse them. `apps/web/src/server/composition.ts` is where the web app
  does the construction: it builds `storage`, calls `createDb(config, "web")`
  to get `client` and `db`, and calls `createEmitter({ client, logger })`. Every
  `db`, `client`, and `storage` import in `apps/web` comes from there.

**Apps bundle; packages stay source.** Every package under `packages/` is
unbuilt TypeScript — no `build` script, no `dist`, `noEmit: true`, and an
`exports` map pointing at `./src/*.ts`. A plain `node` process cannot import a
`.ts` file, so the non-Vite apps are where compilation happens: each bundles to
a single `dist/index.mjs` with every `@virtool/*` inlined from source, via
**tsdown**. Do not give a package a `dist` build to sidestep this — the apps
bundling *is* the design. A new app is `apps/<name>/` with a `package.json`, a
`tsconfig.json` extending `apps/tsconfig.node.json`, a `tsdown.config.ts` and
`src/index.ts`; that is enough for `pnpm build`, `check`, `typecheck`, `test`
and `knip` to cover it with no edits to root scripts, `knip.json`, `biome.json`
or the Dockerfile install layer. A new *image* still needs a Dockerfile stage
and a CI matrix entry.

A non-Vite app must **never import from `apps/web`**, in either direction. A
`biome.json` override over `apps/*/src/**` (excluding `apps/web/src/**`) bans
every feature alias, `@server/**`, the `@/*` catch-all and relative reaches into
`apps/web`. Shared shapes go down into `@virtool/contracts`.

See [docs/apps.md](docs/apps.md) for the bundler rationale, the
bundled-vs-external rule and why externals must be string literals, the
`pnpm deploy` / `injectWorkspacePackages` mechanism, and the Alpine-vs-Debian
image split.

Use `pnpm` for all install, run, and exec commands — not `npm` or `bun`.

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
| Rust crate | `cargo test` / `cargo fmt` (in `packages/pathoscope-core`) |

`TZ=UTC` matches the `test` script and every CI test job — drop it and that
command becomes the only unpinned way to run the suite.

`pnpm test` does **not** reach `packages/pathoscope-core` — it is not a pnpm
workspace. Run `cargo` there directly; a `pathoscope-test` CI job gates it.
Building the crate needs `libclang-dev` installed, because `hts-sys` runs
bindgen against htslib's headers.

`pathoscope-test` and `build-pathoscope` are the only path-filtered jobs in
`ci.yaml` — on a pull request they run only when the crate, the workflow app,
`.dockerignore` or `ci.yaml` changes. Extend the `changes` job's filter in the
same commit as anything that gives either job a new input.

`pnpm build` builds **every app but `apps/site`**, which is gated by its own
`site-build` CI job. `pnpm check` and `pnpm format` run biome over `apps` and
`packages` rather than a literal `apps/web/src`, so a new app's source is linted
without an edit; `apps/site` is excluded once, in `biome.json`'s
`files.includes`.

Don't use the dev server. Live development is done using Tilt and Minikube and is
currently configured in another repository.

### When to run checks

- After changing route files in `apps/web/src/routes/`: run
  `pnpm --filter @virtool/web build` to regenerate
  `apps/web/src/routeTree.gen.ts` before running type checks. The generator is
  `@tanstack/router-plugin`, which `tanstackStart()` wires in
  (`apps/web/vite.config.js`). **Never `tsr generate`.** The standalone
  `@tanstack/router-cli` has not been published past 1.167.x while the router
  is on 1.170.x, and that older generator emits no
  `declare module '@tanstack/react-start'` block — so it silently deletes the
  app's `Register` types, loosening router typing everywhere with nothing
  failing.
- `apps/web/src/routeTree.gen.ts` is checked in. If it shows up in
  `git status` — even when it looks like unrelated drift from a
  regen — commit it alongside your other changes. Never leave it
  out of a commit.
- Before committing: `pnpm check`, `pnpm typecheck`, and `pnpm knip`.
- After changing tests: run the specific test file with
  `pnpm --filter @virtool/web exec vitest run <path>`.
- Full test suite only when asked or when changes are cross-cutting.
- Always fix all lint errors. Biome's lint rules are all set to `error` in
  `biome.json` (there are no warn-level rules), and CI's `checks` job runs
  `pnpm check` — so `pnpm check` must exit 0 before merging. The main branch is
  guaranteed to pass `pnpm check` cleanly, so any issues are caused by your
  changes — never dismiss them as pre-existing.
- No dead code. CI's `checks` job also runs `pnpm knip` (config in
  `knip.json`), which fails on unused files, exports, types, and
  dependencies — so `pnpm knip` must exit 0 before merging. If you add an
  export with no caller yet, either wire it up or delete it; keep a
  deliberately-uncalled public export (e.g. an auth policy) by tagging it
  `@public`. Exports used only within their own file are fine —
  `ignoreExportsUsedInFile` is on, so drop the `export` keyword rather than
  the code.
- Always assume tests pass on `main` — CI enforces it. Any test failures you
  see locally are caused by your changes, never pre-existing. Do **not** use
  `git stash` (or any other working-tree-modifying command) to "check what
  main looks like" — that risks dropping uncommitted work. Just trust that
  main is green and debug your own changes.

## Client

### Web app (`apps/web/`)

Source lives in `apps/web/src/`. Each top-level directory is a feature
module:

- `src/account/` - User account management
- `src/administration/` - Admin settings
- `src/analyses/` - Analysis workflows
- `src/app/` - App shell, routing, theme, shared utilities
- `src/base/` - Shared UI components (buttons, dialogs, forms, tables, etc.)
- `src/forms/` - Form components and patterns
- `src/groups/`, `src/users/` - User groups and users
- `src/hmm/`, `src/indexes/` - Bioinformatics features
- `src/otus/`, `src/sequences/`, `src/references/`, `src/samples/` - Core data
  models
- `src/subtraction/` - Subtraction management
- `src/quality/` - Sequence quality charts
- `src/labels/`, `src/jobs/`, `src/uploads/`, `src/tasks/` - Supporting features
- `src/nav/`, `src/banner/`, `src/wall/` - Navigation, banners, and the
  unauthenticated wall
- `src/server/` - TanStack Start server features (server functions,
  middleware, db, auth) — every request the SPA makes is served from here
- `src/tests/` - Test setup, fakes, and server-function mocks
- `src/types/` - Shared type definitions

Each has a `@name` alias (`@app/utils`, `@base/Button`, `@samples/queries`) —
`paths` in `apps/web/tsconfig.json` is the authoritative list. `src/types/` and
`src/routes/` have none and are reached through the catch-all `@/*`, which maps
to `apps/web/src/*`. Prefer a specific alias over `@/`.

### Key libraries

- **React 19** with React Compiler, run as a Babel pass over `.ts` and `.tsx`
  via `@rolldown/plugin-babel` + `reactCompilerPreset` (see below)
- **TanStack Router** for routing
- **React Query** (`@tanstack/react-query`) for server state
- **zustand** for client state
- **react-hook-form** + **zod v4** for forms and validation
- **Tailwind CSS v4** for all styling
- **Radix UI** primitives for accessible components
- **CVA** (`class-variance-authority`) for component variants
- **Lucide React** for icons
- **d3** for the quality, coverage, and NuVs charts — imperative SVG, not a
  React charting wrapper
- **exceljs** for the analysis XLSX export — server-only, and reached through a
  dynamic `import()` inside `@server/analyses/export` so it stays out of every
  other bundle

### Every route renders on the server

`createStart` sets no `defaultSsr`, so it defaults to `true`: a hard load
runs a route's `beforeLoad`, `loader` and `component` in Node and ships
finished HTML. So render must not reach a browser global — `window`,
`document`, `localStorage`, a viewport measurement — and must not read
anything the server cannot know, above all the clock, the timezone and the
locale. The first crashes the render; the second is a hydration mismatch,
and a `typeof window` guard only converts one into the other.

Read those through `useSyncExternalStore` with a **cached** server
snapshot, which covers the server render and the hydration render that
must match it (`useIsSecureContext` in `@app/hooks` is the worked
example). Anything measuring elapsed time reads `@app/serverNow` rather
than the clock; a module-level `let now = Date.now()` is the deploy time
on a long-lived process, not page load. Wrap a genuinely browser-only
subtree — a virtualizer, which decides its rows by measuring — in
`ClientOnly` with a fallback of the same dimensions, in preference to
`ssr: false` on the whole route.

An `ssr` setting can only be made **more restrictive** down the tree, and
`defaultSsr` fills in for the root as well, so `defaultSsr: false` turns
SSR off everywhere and no leaf can opt back in. Turn a single page off
with `ssr: false` on that route.

Module-scope mutable state in client code is now shared by every
concurrent request, not per-tab. Keep per-user state out of it.

See [docs/ssr.md](docs/ssr.md) for the per-route settings and their
inheritance, the time rules, which queries participate in SSR and
streaming, and the CSP nonce.

### The React Compiler memoizes render, so render must be pure

The compiler is a Babel pass, wired up in `apps/web/vite.config.js` as
`babel({ presets: [reactCompilerPreset()] })` alongside `react()` —
`@vitejs/plugin-react` v6 removed its own `babel` option, so the compiler
cannot be configured on the `react()` plugin. It covers **both `.ts` and
`.tsx`** (every feature's `queries.ts` included) and runs only on the client
environment, so `src/server/` is never compiled.

Tests skip the compiler by default — the Babel pass is per-transform overhead
that thrashes CPU across parallel worktrees, and it earns nothing for
behavioural tests. So local `pnpm test` runs **un-compiled**; CI sets
`VT_TEST_REACT_COMPILER=1` to re-enable it, keeping the compiler-introduced
footguns below under test. Set `VT_TEST_WORKERS=<n>` to cap Vitest's per-process
worker count when several worktrees test at once.

Because the compiler caches render output against its inputs, code that
worked by accident under un-memoized render will now break:

- **Never read the clock, randomness, or other ambient state during render.**
  It will be computed once and cached, and a `setTick` counter will *not* force
  recomputation — the compiler can see the real inputs never changed. Subscribe
  to it with `useSyncExternalStore` and derive the value from the snapshot, so
  render stays a pure function of props and snapshot. `useRelativeTime` in
  `@base/RelativeTime` is the worked example: one shared 8s ticker for the whole
  page, rather than an interval per instance.
- **Never spread a `react-hook-form` return value** (`{ ...methods }`).
  `useForm` returns a stable object whose `formState` is a Proxy that must be
  re-read each render; a spread gets cached and pins `formState` to its first
  snapshot, so validation errors silently stop rendering.
- **Sync props into a form with `useForm({ values })`, not a `reset()` effect.**
  `values` deep-compares, so an unrelated re-render cannot wipe a validation
  error the way a re-fired `reset()` does.
- **Never use `useMatchRoute`.** It breaks React Compiler reactivity, so a
  component using it stops updating on navigation (TanStack Router #4499).
  Use `useMatchPartialPath` (`@app/useMatchPartialPath`), which subscribes
  through `useLocation`. A Biome `noRestrictedImports` rule blocks the import.

Opt a single function out with a `"use no memo"` directive — useful for
bisecting a suspected compiler interaction, but a fix, not a resting place.

### Routing: in-app navigation uses `<Link>`

Internal links use `<Link>` from `@tanstack/react-router`. A plain `<a>` to an
internal route triggers a full page reload. For query strings, use `search` on
`<Link>` — don't add an `href` escape hatch to link wrappers.

`<a>` is only for external URLs and deliberate full reloads.

`/` is `routes/_authenticated/index.tsx`, the dashboard, and it must stay a
**terminal** route — it renders, it never redirects. `/` used to redirect to
`/samples`, and nesting that under `_authenticated` meant resolving the layout's
async guard and only then throwing a second redirect, so signing in navigated
`/login` to `/` to `/samples` with the layout match re-rendering mid-chain — the
window the router throws `undefined` in (see `@base/ShellErrorBoundary`).
Reintroducing a redirect at `/` reintroduces that: `/login` and
`/administration` both redirect *to* `/`, so a second hop out of it is a
redirect chain by construction.

### Route search params

`validateSearch` resolves every default; nothing downstream repeats one. A
param with a default is required on the search type and coerced with a fallback
(`bool(input.reads, false)`), never left optional for a component to fill in
with `search.reads ?? false` — a second copy of a default is free to disagree
with the first, which is how the analysis viewer came to draw its coverage
filters as on while filtering nothing.

Keep the defaults in one exported object and hand it to `stripSearchParams` in
the route's `search.middlewares`, so a resolved default costs nothing in the URL
and a shared link carries only what its sender changed. `analyses/search.ts`
and the analysis route are the worked example.

Paginated list routes share `@app/pagination`. Spread `paginated(input)` into
the returned object and intersect the route's search type with `Paginated`
(`type FooSearch = Paginated & { term: string }`) rather than re-declaring
`page: num(input.page, 1)`. Loaders pass `DEFAULT_PER_PAGE` from the same
module, not a literal `25`.

### API calls

There is no HTTP client. The SPA reaches the backend through TanStack Start
server functions, and the handful of endpoints that must be raw routes (uploads,
downloads, SSE) are called with `XMLHttpRequest`, a plain `<a href>`, or
`EventSource`. A failed server function arrives as a plain `Error` — read its
`message`, and its HTTP status via `getErrorStatus` (`@app/queryErrors`).

Each feature owns a `queries.ts` module that folds its request logic directly
into React Query hooks and `queryOptions` factories — there is no separate
per-feature `api.ts` layer. Inline each server-function call into the hook's
`queryFn`/`mutationFn`; keep a module-private helper only when a request is
shared across hooks or branches. Route loaders prefetch via the same
`queryOptions` factories where appropriate.

Query keys are **not** hand-written. A feature's `*QueryKeys` comes from
`createQueryKeys(domain)` in `@app/queryKeys`, which returns `all`, `lists`,
`list`, `infiniteLists`, `infiniteList`, `details`, and `detail` — every list
variant extending `lists()` and every detail extending `details()` by
construction. A feature that caches something outside those seven shapes
spreads the result and derives the extra member from a base key, so it stays
inside the hierarchy.

Keys live in the feature's own `keys.ts`, which imports `@app/queryKeys` and
nothing else, and `queries.ts` does **not** re-export them. Anything that only
needs to invalidate a cache — the SSE handler, a route's `beforeLoad` — imports
`@<feature>/keys` and so pays for none of the request layer (zod, the
server-function stubs) that `queries.ts` pulls in.

Loading and error states come in two tiers: primary route data uses
`useSuspenseQuery` (loading via the route's `<Suspense>`, errors via the
router's `defaultErrorComponent`, `@base/RouteError`), and secondary data
stays on `useQuery`, gating an inline `@base/QueryError` on `isError && !data`
(error only when there's nothing to show, so stale data survives a failed
background refetch) before checking `isPending`. Never write
`if (isPending || !data)` — that puts `!data` in the loading branch, so an
initial-load failure spins forever. See
[docs/queries.md](docs/queries.md) for the query-key, `queryOptions`,
route-loader prefetch, the two-tier error/loading policy, and mutation
patterns.

Below both tiers sits `@base/ShellErrorBoundary`, mounted in the root route's
shell inside `<body>`. It catches what the router's own boundaries cannot: a
falsy thrown value. `MatchInner` throws a match's `loadPromise` to suspend, a
chained redirect can clear that promise first, and TanStack's `CatchBoundary`
tests the thrown value for truthiness — so `undefined` escapes every boundary
and unmounts the app to a blank page (TanStack/router#7753, open). The shell
boundary remounts the router once the race settles, and falls back to a reload
prompt. It is a backstop for that upstream bug, not a place to route ordinary
route or query errors — those belong in the two tiers above.

### Styling

- Styling is Tailwind utility classes. There is no CSS-in-JS; styled-components
  has been removed from the repo.
- Use `cn()` from `@app/cn` for conditional classes (combines `clsx` +
  `tailwind-merge`).
- Don't use arbitrary Tailwind classes like `max-h-[210px]`.
- Design tokens — colors, spacing, fonts — are defined in
  `apps/web/src/app/style.css` under `@theme`, with keyframes in
  `apps/web/src/app/animations.css`. Check there before inventing a color or
  spacing value, and add a token rather than hardcoding a hex.
- The root font size is `100%` — the reader's browser preference. Never put a
  length back on `html`; `body` carries the app's base size.
- Every rem-valued token Tailwind ships is overridden in `@theme` at 0.875, so
  a class does **not** render its documented px figure: `text-sm` is 12.25px,
  `md:` breaks at 672px.
- Size anything that holds text in `rem`; keep px for graphics that hold none.
  Where a size has to be a number — a threshold compared against a measured
  width — write it as a rem multiple and resolve it with `useRootFontSize`
  (`@app/hooks`), never as a px constant.
- A `color` prop on a `src/base/` component takes the shared `PaletteColor`
  from `@base/types` (`blue`, `green`, `gray`, `orange`, `purple`, `red`), or
  `IconColor` — `PaletteColor | "black"` — for the icon-based ones (`Icon`,
  `IconButton`, `Circle`). Don't redeclare the union locally, add a one-off
  color, or trim the set per component.
- Where a component has variants (`solid` / `soft`), `color` works in every
  one. A variant that silently ignores it is a footgun: honor it across the
  board or drop the prop for that variant.

See [docs/type-scale.md](docs/type-scale.md) for which token families are
overridden and why they move together, the class-to-px table, and the px
holdouts that still need fixing.

## Bundling: the chunk is the unit of loading, not the export

Tree-shaking removes unused code *within* a chunk; it does not decide which
chunks a page fetches. So importing one symbol pulls the whole module's chunk,
and `sideEffects: false` does nothing about it. Five rules follow:

- **Nothing heavy in a route's critical exports.** `autoCodeSplitting` makes
  `loader`, `beforeLoad`, `validateSearch` and `loaderDeps` a statically
  imported half that every page load pays for, `/login` included; only
  `component` is lazy. Never statically import a feature's `queries.ts` — pull
  the `queryOptions` factory in from inside the loader body — and never use zod
  in `validateSearch`, which is synchronous and so pins ~108 KB eagerly. Use
  `@app/searchParams` there instead.
- **What a route guard reaches is downloaded on the login wall**, dynamic
  imports included. The `queryOptions` the guards need therefore live apart
  from their feature's `queries.ts`, one server function each:
  `@account/account`, `@administration/passwordPolicy`, `@nav/queries`. Keep
  them there even when the feature module looks light today.
- **Heavy dependencies get their own module.** `cn()` is in `@app/cn`, not
  `@app/utils`, to keep `tailwind-merge` out of every bundle that wants a plain
  utility. Don't merge it back.
- **Reach `src/server/**` through `createServerOnlyFn`**, never a top-level
  import — `start.ts` puts it in the browser program (`auth/middleware.ts` and
  `metricsMiddleware` are the worked examples).
- **A native dependency must never be bundled.** It resolves its `.node` addon
  against `__dirname`, which an ES module has none of, so it builds clean and
  throws at first import. It needs both `environments.ssr.resolve.external` in
  `apps/web/vite.config.js` and an `apps/web` dependency entry.

See [docs/bundling.md](docs/bundling.md) for the eager/lazy split in full, why
the login wall is reachability rather than timing, Nitro's two bundling stages
and what `traceDeps` can and cannot reclaim, and how to verify the built output
rather than trusting a green build.

## Server

### Server modules layer as `data.ts` → `service.ts` → `functions.ts`

A server feature layers as `data.ts` (pure domain + persistence /
external IO), optional `service.ts` (cross-`data` orchestration), and
`functions.ts` (TanStack Start shell, zod validation, error mapping).
Imports flow `functions → service → data` and never the reverse.

`data.ts` lives in `@virtool/data` — `packages/data/src/<feature>/` —
because it carries no framework surface and the jobs API and workflow
ports need it. `service.ts` and `functions.ts` stay in
`apps/web/src/server/<feature>/`: `functions.ts` because `createServerFn`
is the web app's, and `service.ts` alongside it because the orchestration
it does is this app's, not a shared contract.

Every dependency a `data.ts` function needs is injected as an argument,
never imported: the db handle first, then `storage`, then `logger`. The
web app's `functions.ts` reads all three from `@server/composition`.

Type that first argument `DbOrTx` (from `@virtool/data/db/pg`), not `Db`,
for any function that might be called inside a `db.transaction(...)`.
Drizzle's transaction handle is not assignable to `Db`, so a helper
typed `Db` cannot be reused inside a transaction without being widened
first.

A `functions.ts` validator builds on the shared primitives in
`@server/validation` — `rowIdSchema` for any row id, `pageSchema` and
`perPageSchema` for a paginated list — rather than re-spelling
`z.number().int().positive()`. A schema that adds fields to an id it
already has a schema for extends that schema
(`referenceIdSchema.extend({ ... })`) instead of re-declaring the field.

A server function's return type is checked for serializability, and
`unknown` fails that check — so a payload this side does not interpret (a
workflow's `results` blob, a BLAST response) is typed `JsonObject` /
`JsonValue` from `@virtool/contracts`, not `Record<string, unknown>`. The
values genuinely come out of a JSONB column, so the narrowing is honest;
assert it once at the boundary rather than threading the type through
every internal helper.

**A column the database leaves open is narrowed in `functions.ts`, not on
the client.** `jobs.workflow` is `text` with no CHECK constraint, so
`data.ts` types it `string` while the SPA reads a closed union;
`server/jobs/functions.ts` parses it onto that union on the way out and
**bare-throws** — a 500 and a Sentry event, not a `ClientError` — when a
row does not fit, because nothing the caller sent is wrong and this side
owns the data. Declaring the narrow type on the client instead hides the
disagreement from TypeScript. Annotate the query's `select` parameter
with the shape the client parses, so what the server publishes is checked
against it.

A handler maps an expected outcome to an HTTP status with
`setResponseStatus`, then throws `ClientError` (`@server/errors`) — never
a plain `Error` — for any deliberate 4xx (a bad login, a missing record,
a name conflict). The Sentry `beforeSend` filter drops `ClientError`
(and the auth middleware's 401/403) as routine control flow; a plain
`Error` is reported as a false incident. A bare `throw` stays reserved
for the genuinely unexpected.

**Never set a null-body status — 204, 205, or 304 — from a server
function.** Start always serializes a body for an RPC call, so the
`Response` constructor rejects the pair and the operation reports a
failure it already completed. A deletion returns `null` and answers 200;
the RPC client reads the body and never the status.
`server/__tests__/responseStatus.test.ts` fails the build on any of the
three.

See [docs/architecture.md](docs/architecture.md) for the import-direction
invariant in full, the labels (minimal) and auth (carve-out) shapes,
the pure-policy-vs-framework-shell principle, and when to introduce
`service.ts`.

### Client-reachable files import server modules via `@server/*`

`apps/web` type-checks as two projects (`pnpm typecheck` runs both):
`tsconfig.server.json` (Node types) for `src/server`, and
`tsconfig.app.json` (DOM lib, no Node types) for browser code, which
resolves `@server/*` to the server project's emitted declarations.

Any file reachable from the browser program — including framework
entries pulled in by `routeTree.gen.ts`, like `start.ts` — must import
server modules through the `@server/*` alias, never a relative
`./server/*` path. A relative import bypasses the declaration remap and
drags the server source graph (and `@types/node` globals) back into the
browser program.

Because the app project consumes emitted declarations, anything exported
from `src/server` must have a type that can be *named* portably. If an
export's inferred type references a transitive dependency, declaration
emit fails (`TS2883`), that file emits no `.d.ts`, and every `@server/*`
import of it breaks with `TS2307`. Annotate the export explicitly with a
type re-exported from the direct dependency — as `src/server/logger.ts`
does with `Logger` from `@virtool/logger` rather than letting the type be
inferred as pino's.

**That trap is scoped to `apps/web/src/server/**`** — `functions.ts`,
`service.ts`, `auth/`, `config.ts`, and the raw-route handlers. It is
created by the declaration emit itself, and the workspace packages have
none: their `exports` maps point at `./src/*.ts`, there is no build step
and no `dist`, and `packages/tsconfig.base.json` sets `noEmit`. A
`@virtool/data` or `@virtool/storage` export can infer whatever type it
likes.

The arrow runs one way, and two Biome `noRestrictedImports` overrides
hold it there:

- `apps/web/src/**` outside `src/server/**` may not import
  `@virtool/data/**` or `@virtool/storage`. Without it those packages
  are resolvable from any React component — the workspace makes them so
  — and nothing else in the toolchain would say a word before Drizzle
  and postgres.js landed in the client bundle. The `web` Vitest project
  aliases `@server/composition`, `@server/config`, and
  `@virtool/data/db/pg` to a guard that throws, covering the same ground
  at runtime.
- `apps/web/src/server/**` may not import from the browser feature tree,
  because a server file reaching into a DOM-typed module breaks the
  server project at a distance. **Every** feature alias is listed, plus
  the `@/*` catch-all that would otherwise reach the same modules under
  another name — not merely the aliases something imports today. A
  partial list let `labels/data.ts` read `DEFAULT_LABEL_COLOR` from
  `@labels/constants` with nothing to catch it. Add the alias when you
  add a feature directory.

The packages need no rule of their own for the second: `packages/**` has
no `@<feature>/*` path mapping at all, so a browser feature module is not
resolvable from there. That is what forced `DEFAULT_LABEL_COLOR` and the
password policy down into `@virtool/contracts` when `labels/data.ts` and
`settings/data.ts` moved.

Shapes and helpers both sides need live *down* in `@virtool/contracts`
(roles, permissions, banner colors, the SSE schema, the reference wire
shapes, `UserNested`, `Task`, `SearchResult`, `ApiKey`); both sides
import them straight from the package.

**A domain's wire shapes belong in `@virtool/contracts`, not in
`data.ts`.** What a server function returns is read by both sides, so
`data.ts` imports those types from the package and components import the
same names straight from `@virtool/contracts` — no feature `types.ts`
re-export. `samples/types.ts` is the worked example, keeping only the
shapes that are genuinely client-only; a feature whose every shape is a
wire shape needs no `types.ts` at all. A
client `types.ts` must never import a shape from `@virtool/data` — the Biome
override rejects it, and it would point the client at a module the server
does not own the shape of. `data.ts` still owns what only it uses: its
`*Values` and `*Options` argument types, its `AppError` subclasses, and
its row mappers.

**Shape the payload in `functions.ts`, and parse nothing on the client.**
A `select` that runs a zod schema over a server function's result is a
second declaration of a shape this app owns both ends of, free to
disagree with the first, and it pays zod at every read. Rename a field,
fold a nested count, narrow an open column at the boundary that publishes
it — `server/jobs/functions.ts` is the worked example, mapping the
`steps` and `claim` JSONB blobs with `@virtool/contracts`' shared
`fromStoredJobStep` / `fromStoredJobClaim` rather than a second copy of
that conversion.

**A timestamp crosses as a `Date`.** Server functions serialize with
seroval, not `JSON.stringify`, and seroval revives a `Date` as a `Date` —
so a handler hands back the value it read out of Postgres, the contract
types it `Date`, and no `z.coerce.date()` runs on either side. The
exception is a timestamp stored *inside* a JSONB blob (`steps[].started_at`),
which is column bytes Python also writes and is converted by the mappers
above.

**A feature module must never re-export a name that originates in
`@virtool/contracts`.** Consumers import it from the package directly.
A `types.ts` that re-exports `UserNested`, or a `utils.ts` that
re-exports `hasSufficientAdminRole`, makes the feature a middleman on a
shape it does not own: the real definition site stops being greppable,
and a module that wanted one client-only type now drags the feature in
to get a package one. Keep the client-only shapes that genuinely live
there — `administration/types.ts` still owns `AdministratorRole` and
`Settings`, `banner/types.ts` still owns `Banner` and
`bannerColorClasses` — and delete only the pass-through lines. The rule
covers values as well as types, and applies just as much inside
`src/server/**`.

### Every server function declares an authorization policy

Every server function names who may call it, as middleware, from
`@server/auth/policy`:

```ts
export const deleteGroupFn = createServerFn({ method: "POST" })
	.middleware([adminRole("base")])
	.validator(groupIdSchema)
	.handler(async ({ context, data }) => { ... });
```

The four policies are `open()` (no session — login and friends),
`authenticated()` (any signed-in user), `adminRole(role)`, and
`permission(name)`. The policy resolves the session and puts it on
`context.session`, typed non-nullable for everything but `open()`.
Handlers read it from there — do not call `requireSession()` in a
handler, that costs a second lookup.

**This is not optional.** `server/__tests__/authorization.test.ts` calls
every exported server function with no session and fails the build on
any that does not refuse, so a function built without a policy breaks
CI by name. It also pins `authenticationExceptions` in both directions:
`open()` and that list must agree. Add a new `functions.ts` and register
it in that test's `MODULES` — a missing module fails too.

A policy states the *floor*. A rule that depends on the row — an
administrator editing another administrator — still belongs in the
handler, after the read (`users/functions.ts` is the example). Never put
a role check in `data.ts`.

Do not try to wrap `createServerFn` in a factory that takes the policy
as an argument. The Vite plugin matches that call syntactically at the
definition site; behind a factory it stops treating the function as a
server function at all — no RPC endpoint, and the handler body ships to
the browser.

Raw `Request` handlers in `createFileRoute` run outside the server-function
context, so **no policy middleware runs on them** and each enforces its own
floor — nearly always `requireAuthenticatedRequest(request)`, which is the raw
spelling of `authenticated()`. This table is the whole inventory:

| Route | Handler | Floor |
| --- | --- | --- |
| `events.ts` | `@server/events/*` | authenticated |
| `uploads.ts` | `@server/uploads/upload` | authenticated + `upload_file` |
| `uploads_.$uploadId.ts` | `@server/uploads/download` | authenticated |
| `analyses.documents.$document.ts` | `@server/analyses/download` | authenticated + sample `read` |
| `otus.$otuId.fasta.ts` (+ isolate, sequence siblings) | `@server/otus/fasta` | authenticated |
| `subtractions.$subtractionId.files.$filename.ts` | `@server/subtraction/download` | authenticated |
| `indexes.$indexId.files.$filename.ts` | `@server/indexes/download` | authenticated + `checkReferenceVisibility` |
| `samples.$sampleId.reads.$filename.ts` | `@server/samples/download` | authenticated + sample `read` |
| `metrics.ts` | `@server/metrics/handler` | `VT_METRICS_TOKEN` bearer; 404 when unset |
| `monitoring.ts` | `Sentry.createSentryTunnelRoute` | **none**, deliberately |
| `health/live.ts`, `health/ready.ts` | `@server/health/ready` | **none**, deliberately |

A route is raw only where RPC cannot do the job: `XMLHttpRequest` for upload
progress, a plain `<a href>` that needs a real `Content-Disposition`,
`EventSource`, or a non-RPC client like Prometheus. The two unauthenticated
entries are considered exceptions rather than oversights — Sentry's tunnel
exists to capture errors thrown *on the login wall* and is bounded by its DSN
check instead, and kubelet probes cannot hold a session. Don't add a floor to
either.

Constraints these handlers carry, each of which has been a bug:

- **Stream, never buffer.** `request.body` to storage on the way in, storage to
  the response on the way out. `request.formData()` puts a multi-gigabyte read
  file in the Node heap. For the same reason the upload must not become a server
  function: the RPC client uses `fetch`, which cannot report progress.
- **Take a storage key off a row already matched.** A `$filename` param selects
  a row first — against `subtraction_files`, or a whitelist of the names an index
  build produces — and the key is then read from that row's `storage_key`. Never
  compose one from the URL param, which is how a param traverses out of a prefix,
  and never from the row id.
- **`Content-Disposition` carries the row's `name`**, never `name_on_disk` and
  never the key.
- **A download gets its own URL.** The FASTA routes end in a literal `fasta`
  segment rather than a `.fa` suffix on the resource URL — sniffing a suffix
  inside a read handler is what puts two representations on one path.
- **`uploads_.$uploadId.ts` keeps its trailing underscore**, which stops it
  nesting under `routes/uploads.ts`. The URL is `/uploads/{uploadId}` regardless.
- **The sample reads floor is deliberately stricter than the endpoint it
  replaced**, which checked only the session. Don't relax it to match.

Raw routes are also the only endpoints reachable with an **API key**.
`requireAuthenticatedRequest` accepts either the session cookie pair or an HTTP
Basic `Authorization` header carrying `handle:key`; server functions stay
cookie-only. A key-authenticated session carries the key's permissions, and
`hasPermission` intersects them with the user's own — the key caps
administrators too.

See [docs/auth.md](docs/auth.md) for the middleware composition, the
session model, cookies, lifetimes, and the login / reset / logout
flows.

### Environment variables are prefixed with `VT_`

Every Virtool-owned env var must start with `VT_`. The prefix keeps our
variables clearly separated from third-party ones (`SENTRY_*`, `NODE_*`,
cloud-provider injected vars) and matches the `envPrefix` Vite is configured
to expose. This applies to the zod schema keys in
`apps/web/src/server/config.ts`, `apps/web/.env.example`, and any
`process.env.*` reads anywhere in the app.

Good: `VT_WORKER_MODE`, `VT_WORKER_CONCURRENCY`, `VT_POSTGRES_URL`.

Bad: `WORKER_MODE`, `POSTGRES_URL`.

The only exception is upstream-defined names (e.g. `SENTRY_AUTH_TOKEN`,
`NODE_OPTIONS`) — leave those as the third party expects.

### Every config key also reads from a `_FILE` variant

`parseServerConfig` resolves `<KEY>_FILE` before zod parses: the named
file is read, trimmed, and used as `<KEY>`'s value. It applies to every
key in the schema — add one and it gets the behaviour for free — so
secrets reach a pod through the secrets-store CSI driver's file mount
(`VT_METRICS_TOKEN_FILE=/mnt/secrets-store/metrics-token`) instead of a
Kubernetes `Secret`, which goes stale when a key is added to the
`SecretProviderClass`. Plain variables still work for local dev.

**The file wins over a plain variable of the same name.** A rollout
moving to the mount can still carry the stale env var from the `Secret`
it replaces, and erroring on the overlap would crashloop the rollout
that fixes it. An unreadable path throws at startup; an empty file is an
unset value.

**The resolver is shared, not copied** — `resolveFileBacked` in
`@virtool/contracts/env`, called by every service's `config.ts`. Each
caller passes the keys it wants resolved, so **a key missing from that
list silently loses its file variant**. Never add a plain `process.env`
read that skips it (`@virtool/sentry`'s `readDsn` is exactly that trap).

It is one of the server-only helpers `@virtool/contracts` shares across
services, each behind its own subpath so `node:*` never enters the browser
graph:

| Helper | Subpath | Purpose |
| --- | --- | --- |
| `resolveFileBacked` | `@virtool/contracts/env` | `<KEY>_FILE` resolution |
| `isBearerTokenValid` | `@virtool/contracts/bearer` | constant-time `/metrics` token check |

Adding one needs a subpath export **and** an entry in
`packages/contracts/tsconfig.node.json`, which is why that package
typechecks as two projects. See [docs/jobs-api.md](docs/jobs-api.md).

### Logging

Server code logs through `@virtool/logger`, not `console.*`. Biome's
`noConsole` bans `console.*` across the whole repo; on the client, report
unexpected conditions to Sentry (`Sentry.captureException`) rather than the
user's console, which no one can read.

Import the `logger` singleton from `@server/logger` and call it directly:

```ts
logger.warn({ err }, "postgres health check failed");
```

`@virtool/data` cannot reach that singleton — it carries the Sentry
forwarding stream, which is the app's. The six data functions that log
take a `Logger` as an argument instead, after `db` and `storage`, and the
web app's `functions.ts` passes `@server/logger` in. `emit` is the one
exception: its logger is bound once by `createEmitter`.

Pass structured fields as the first arg and the message as the second —
never interpolate values into the message string, that defeats the
redaction list and makes records ungreppable.

There is no request-scoped logger. `logger.child({...})` is available for
attaching scoped context, but nothing in the server currently uses it and
no `context.logger` exists — don't write code that assumes one.

When a Sentry DSN is configured, server logs at `info` and above are
forwarded to Sentry automatically (via a pino destination stream, not
`Sentry.pinoIntegration()`); redaction still applies and dev does not
forward. That holds for **all three** server processes — `apps/web`,
`apps/jobs-api` and `apps/tasks` — which share one stream,
`createSentryLogStream` from `@virtool/sentry/log`. It takes the SDK's
`logger` as an argument rather than importing one, because each process
initialises a different SDK and only the one it called `init` on sends
anything. Attach it only when a DSN is present, so the SDK graph stays
unloaded in dev and tests.

See [docs/logging.md](docs/logging.md) for the redaction
defaults, `VT_LOG_LEVEL` resolution, where the logger singleton lives, and
the Sentry forwarding wiring.

### Metrics

Prometheus scrapes `GET /metrics`, gated by a bearer token
(`VT_METRICS_TOKEN`). With the variable unset the route reports 404, so
metrics are off until a deployment opts in.

**There are three scrape targets, not one** — `apps/web`, `apps/jobs-api`
and `apps/tasks` are separate processes with separate registries, each
needing its own Prometheus job. Series names deliberately match so one
dashboard covers them all; they are told apart by the scrape's target
labels and by `application_name`, **never by renaming a metric**. All three
gate the endpoint with `isBearerTokenValid` (`@virtool/contracts/bearer`) —
constant-time, so don't reimplement it or reduce it to `===`. The rest of
this section is `apps/web`; see [docs/jobs-api.md](docs/jobs-api.md) and
[docs/tasks.md](docs/tasks.md) for the others.

**Job-queue visibility is `apps/jobs-api`'s, not `apps/web`'s.**
`virtool_jobs{workflow,state}` and
`virtool_jobs_oldest_pending_age_seconds{workflow}` are registered on
that service's registry, fed by `readJobQueueBounded`
(`@virtool/data/jobs/data`). Workflow pods are one-shot Kubernetes Jobs
and a poor scrape target — one may run for hours and vanish between
scrapes, and a pod-name label is unbounded — so the jobs API reports
the queue on their behalf. Three rules hold the bound: the read
covers only `pending` and `running` (a scan over every job ever run
grows forever against a table this side cannot index), an unrecognised
`workflow` folds into `other` (the column is plain `text`), and every
workflow/state pair is written as `0` on each refresh so a drained queue
reports zero rather than its last backlog. The workflow list is
`JobWorkflow.options` from `@virtool/contracts` — the one definition;
don't mint a second.

**Task and queue visibility is `apps/tasks`'s.**
`virtool_task_spawn_total{type,outcome}`,
`virtool_task_runs_total{type,outcome}`,
`virtool_task_duration_seconds{type}`, `virtool_tasks{type,state}` and
`virtool_tasks_oldest_queued_age_seconds{type}` live on that process's
registry. Five rules hold them: `type` is bounded by `TaskName` from
`@virtool/contracts` with an unrecognised value folded into `other`
(`tasks.type` is plain `text`, so nothing narrows the column itself);
the histogram's buckets are **task-sized**, 1 s to 2 h, because
`virtool_http_*`'s top out at 10 s and would put every bioinformatics
task in `+Inf`; `outcome` labels the counters and never the histogram;
the **spawn** counter is pre-declared over its whole cross product so
`skipped_locked` at zero can be told from a counter that was never
wired, while the run counter is observed-only; and the queue gauges are
built only when `spawnEnabled`, so N runner replicas don't each scan the
same table. The queue read reproduces Python's `get_counts` predicate
term for term — `complete = false AND error IS NULL`, split on
`acquired_at` — which is what makes the cutover comparison
apples-to-apples. Don't change it.

`server/metrics/registry.ts` owns the one process-wide `Registry`.
Default process metrics keep prom-client's standard unprefixed names
(`process_*`, `nodejs_*`) so off-the-shelf dashboards match; everything
we define is prefixed `virtool_`.

Request rate and latency come from `metricsMiddleware`, a global
`requestMiddleware` in `start.ts` that sees every request — server
function, raw route, and rendered page alike.

**No label may be unbounded.** The request path is deliberately not a
label: pathnames carry ids. Server functions are identified by
`serverFnMeta.name` instead, which is bounded by the number of functions
in the codebase.

**postgres.js exposes no pool statistics** — its connection queues live
in a closure, and `onclose` has no `onopen` counterpart. Pool occupancy
is read from Postgres itself, filtering `pg_stat_activity` on the
`applicationName` that `createDb` (`@virtool/data/db/pg`) sets and
`@server/composition` re-exports, which carries the hostname so each
replica counts only its own pool. Client-side queue depth remains
unavailable and needs per-query instrumentation.

That name is built by `@virtool/data/db/applicationName` and bounded to 63 bytes —
Postgres truncates a longer one silently, and the filter would then match
nothing and report every bucket as zero. It takes the **service** as well
as the hostname (`createDb(config, "web")`), without which the two
services would count each other's backends. The probe itself is bounded too:
it queries the very pool it measures, so a saturated pool queues it
client-side where nothing rejects, and an unbounded read would cost the
whole scrape rather than just the pool gauges.

`metricsMiddleware` loads the registry through `createServerOnlyFn`
because a static import would drag prom-client and its `node:*` reads
into the client graph.

See [docs/metrics.md](docs/metrics.md) for the exported series, the
token check, cardinality rules, and what deeper instrumentation would
take.

### Tasks

`apps/tasks` is **one** process carrying both halves of the task system.
The periodic spawner inserts scheduled tasks; the runner claims and
executes them. Each is disabled independently — `VT_TASKS_SPAWN_ENABLED`
and `VT_TASKS_CLAIM_ENABLED`, both defaulting to `true`, so an omitted key
fails toward a working fleet rather than a pod that starts, passes every
probe and does nothing. That is what decouples the two rollouts: the
cutover from Python is one deployment started with claiming off, then one
flag flip. Don't reintroduce a second binary to get the same effect.

**Nothing in this app happens at import time.** `bootstrap()`
(`src/bootstrap.ts`) is the composition root and builds all of it — config,
logger, pool, emitter, storage, registry, listener — returning an
`AppContext`. There is no config singleton, no module-scope pool, and no
`SHOW server_version` fired by an import. A module of this app can be
imported to read a type without opening anything.

Four rules it carries:

- **Config is the app's own zod schema**, parsed by `parseTasksConfig`,
  and every key keeps the `<KEY>_FILE` behaviour through the shared
  `resolveFileBacked`. A boolean is spelled out rather than left to
  `z.coerce.boolean()`, which reads `"false"` as `true`.
- **Liveness must never depend on Postgres.** `GET /health/live` is
  static. A database blip that failed it would restart the whole fleet
  and kill every task in flight. Readiness still probes Postgres, and
  reports 503 from the moment shutdown begins.
- **The version is passed into `bootstrap` explicitly**, from a JSON
  import of the app's own manifest. `__APP_VERSION__` is a Vite `define`
  and does not exist here; reading it would render `virtool_app_info`
  with an empty label and nothing would fail.
- **Never call `process.exit()`.** Registering a SIGTERM handler removes
  Node's default exit behaviour, so shutdown is the app's job from that
  moment: readiness flips, hooks run LIFO, the listener closes, the pool
  drains, Sentry **flushes** (never `close()`), and `process.exitCode` is
  set for a natural drain. The backstop timer is `.unref()`'d and its
  budget must stay under `terminationGracePeriodSeconds`. The sequence
  itself is `createShutdownController` from `@virtool/service/shutdown`,
  shared with the jobs API; only the hooks and the injected
  `closeListener` are this app's.

A claim is a **lease encoded on `acquired_at`** — live while that column
is within `TASK_LEASE_SECONDS` (300) of now, renewed every
`TASK_HEARTBEAT_SECONDS` (60). No lease column and no DDL. The claim,
lease and completion queries are `packages/data/src/tasks/data.ts`, and
four rules hold them:

- **Reclaim is folded into the claim**, as a disjunction in one
  statement, and the whole predicate is repeated as the outer `UPDATE`'s
  trailing guard — under Read Committed a blocked updater re-evaluates
  its own `WHERE` and never the subquery that chose the row. Python's
  `progress = 0` term is deliberately dropped: it excluded exactly the
  rows a reclaim exists for.
- **Anything that takes work back off a runner is scoped to a `ts-`
  `runner_id`**, which `buildRunnerId()` mints. Python never renews
  `acquired_at`, so its long-running tasks look abandoned; the scope is
  what stops a reclaim pulling live work out from under it. Never add a
  flag to widen it.
- **Every runner write is fenced** on `runner_id` and `complete = false`
  and returns `false` when it matches nothing; `renewLeases` reports the
  ids it renewed so a caller can abandon the rest. `failTask` sets
  `complete` as well as `error`, which Python does not. Every timestamp
  write is `timezone('utc', clock_timestamp())`, never `now()`.
- **The data layer publishes every `tasks` frame** — from
  `updateTaskProgress`, `completeTask` and `failTask` only, never from a
  claim, release or reclaim, and never from a guarded write that
  returned `false`. Those three take `Db` rather than `DbOrTx` so a
  frame cannot precede the commit of the row it describes.

The spawn and claim loops report through the `virtool_task_*` and
`virtool_tasks*` series described under **Metrics** above. `recordSpawn`
and `recordRun` are the only way a loop writes one — never register a
metric from a loop, and never read `tasks` from a scrape by any route
but `readTaskQueueBounded`, whose predicate is Python's.

A task body is authored against the framework in
`apps/tasks/src/framework/` — `defineTask` and the payload/step
declaration (`define.ts`), the debounced progress writer
(`progress.ts`), and `runTask` (`run.ts`). Eight rules it carries:

- **A body never persists and `data.ts` never learns about tasks.** The
  seam between them is a trailing `onProgress?: (percent: number) =>
  Promise<void>` on the data function — percent at that boundary,
  **fraction** (0–1) at `runStep`'s `report`, and a body bridges the two
  with `async (percent) => report(percent / 100)`. A caller rescales a
  child's full range into its own band.
- **A step is an equal slice of 0–100**, and rounding is **half-to-even**
  to match Python's `round` — `Math.round(62.5)` is 63 and Python's is
  62. Only step *entry* writes immediately; a step writes nothing on the
  way out, because the next entry carries the same value and an exit
  write would report a step that threw as finished. Everything between
  is debounced at `PROGRESS_DEBOUNCE_MS` (250) and flushed before the
  terminal write, and again after `cleanup`.
- **A step name absent from the declared `steps` has its progress
  dropped**, at `warn` — it is a typo, and giving it the whole 0–100
  range pins the bar at 100 for the rest of the run. A task that
  declares no steps at all still maps each one onto the whole bar.
- **A progress decrease is dropped, not raised**, and measured from the
  claimed row's `progress` rather than from zero — a reclaimed task
  re-runs from step zero and must not drag the bar back with it. Python
  raises, which lets a rounding wobble fail an otherwise-healthy task.
  Any accumulating helper guards `total <= 0` rather than dividing
  blind, as Python's does.
- **`cleanup` runs on every outcome but success** — including a handler
  that sees `signal.aborted` and returns *cleanly*, which a
  `catch`-only implementation skips silently. Never after a fence:
  another runner owns the task, and the claim is **renewed and checked**
  first rather than inferred from whatever progress write happened to be
  outstanding. A throwing cleanup is logged and never masks the original
  error.
- **An error is `` `${err.name}: ${err.message}` ``**, not Python's
  `"<class 'ValueError'>: boom"`. A payload the schema rejects fails the
  task before any handler code runs.
- **`runTask` always returns an outcome**: a terminal write that rejects
  reports `aborted`, the same as an already-aborted signal at dispatch,
  because both leave the row claimed and incomplete for the caller to
  release. `signal.aborted` is sampled once, before the flush that
  precedes the terminal write.
- **A reclaimed task re-runs from step zero, so every body must be
  idempotent.** Nothing records which steps already ran.

See [docs/tasks.md](docs/tasks.md) for the full config table, the
`AppContext` contract, the shutdown ordering and its guarantees, the
probe and metrics surface including the five task series and their
bucket, label and folding rules, the lease, fencing and frame rules in
full, and the framework's step model, terminal-outcome table and
progress seam.

## Data

### Data store: Postgres-first

The TypeScript server reads and writes **Postgres only** (via
Drizzle), through `@virtool/data`: the schema mirror is
`packages/data/src/db/schema/`, the pool comes from `createDb`
(`@virtool/data/db/pg`), and every query lives in a
`packages/data/src/<feature>/data.ts`. Python is the sole owner of schema
and migrations — TS code reads and writes against the schema Python
defines. Mirror Python-side column defaults with Drizzle `.$defaultFn()`,
never `.default()` — the real columns have no `server_default`, so
`.default()` inserts `null`.

**Mirror a column's constraint, and only its constraint.** A `text`
column Python closes with a CHECK constraint is typed
`text("state").$type<JobState>()`, with the constraint named in a comment
— `$type` asserts rather than validates, which is exactly right when the
database is doing the enforcing. A column with **no** constraint stays
`string` no matter how enumerable its values look: `jobs.workflow` is one,
Python's `Workflow` being an application-level enum, and that openness is
what `apps/jobs-api/src/metrics/registry.ts`'s `other` folding and
`isJobStateTerminal`'s `string` parameter exist for. Never narrow a column
the database leaves open, and never widen one it closes. The union itself
lives in `@virtool/contracts` — one definition, imported by the mirror.

Three `pgEnum` declarations (`messagecolor`, `indextype`,
`session_type_enum`) describe a Postgres enum where the real column is
`text` plus a CHECK. Each carries a comment saying so. They are inert —
nothing generates migrations from this side — so leave them alone rather
than restructuring. `subtraction_files.type` is the opposite case and is
genuinely backed by the `subtractiontype` enum.

Postgres is now Virtool's sole data store — Python removed MongoDB
entirely, so every domain's records live in Postgres and there is no
Mongoose / Mongo-driver layer here. A domain not yet reachable from the
TS server is missing only its Drizzle mirror and server functions, not
its data — build those against the tables Python already defines.

**Serve a legacy-shaped table on its own shape; do not renormalize it.**
The OTU domain writes `legacy_otus.data` as verbatim Mongo — isolates
embedded, `_id` keys — because history diffs address that document
positionally and Python still writes the same tables. Reshaping it from
this side misapplies every diff already recorded and corrupts the
analyses read path. Renormalizing is a Python-side migration.

**An index build is started here and finished by Python.**
`createIndex` (`@virtool/data/indexes/data`) inserts the pending `indexes` row,
stamps every unbuilt `legacy_history` row with it, and creates the
`create_index` task the Python runner claims — that task writes the
artifact, records each file's `storage_key`, and flips `ready`. The
insert runs under
`pg_try_advisory_xact_lock(hashtext('index_build:{referenceId}'))`, the
same key Python takes, so a build started from either service excludes
one started from the other. Don't drop the lock. `indexes.storage_key`
is dead — it is still `NOT NULL`, so the insert fills it, but nothing
composes a key from it any more.

See [docs/database.md](docs/database.md) for which domains the TS
server can reach today, why the OTU tables keep their legacy shape and
what that costs a writer, the `legacy_id` resolution rules, and the
column-default convention.

### Files live in object storage, shared with Python

Uploads, reads, analysis results, indexes, subtractions, HMM profiles,
and caches live in S3 or Azure Blob — **the same bucket Python uses**.
`@virtool/storage` exposes a five-method streaming interface
(`read`, `write`, `delete`, `list`, `size`); there are no paths, file
handles, or presigned URLs. There is no filesystem backend.

**A key is recorded, not derived.** Every row naming a stored object
carries its complete key in a `storage_key` column, and every read path
reads that column — nothing recomposes a key from a row id, a legacy id,
or a filename. New keys come from `mintStorageKey(domain, parentId)` and
`mintRootStorageKey(domain)` in `@virtool/storage/keys`, whose UUID leaf
must stay hyphenless to match Python's `uuid4().hex`. The `parentId`
segment is for human inspection only; keys in the bucket are
heterogeneous by design, because a migrated row keeps whatever prefix it
was written under.

**A key arriving over the wire is validated, not recomposed.** A workflow
finalizing its outputs sends the key it wrote to, and the jobs API records
it verbatim after checking it sits under `{domain}/{parentId}/` for the
resource in its own path — plus non-empty, no leading `/`, no empty
segment, no `..` segment. Composing a second key server-side would put a
second opinion about where the bytes went next to the writer's. `POST
/caches` is the exception and takes a bare uuid, because a cache key
really is derivable.

`StorageError` and `StorageKeyNotFoundError` come from
`@virtool/storage/errors` and extend plain `Error`, not the data layer's
`AppError`, so the storage package carries no dependency on the data layer.

The backend is built once at startup and **passed into `data.ts`
functions as an argument, the way `db` is**. `deleteKeys` never throws;
it returns failures, and callers must log them.

**Cleanup enumerates recorded keys; there is no prefix sweep.** Read a
row's key *before* deleting the row, and where a cascade takes child rows
with it — a sample's analyses take their `analysis_files`, an index takes
its `index_files` — collect the children's keys in the parent's delete.
An object written before keys were recorded is named by no row, survives
the delete, and is left for an orphan sweep that does not exist yet.

Client code must never reference the whole `import.meta.env` object.
Vite would serialize every `VT_`-prefixed variable — including
`VT_STORAGE_S3_SECRET_ACCESS_KEY` — into the browser bundle. Read named
keys instead; `src/app/__tests__/clientEnv.test.ts` enforces this.

Unit-test anything that stores files against `MemoryStorage`. The
backends themselves are tested against real Garage and Azurite
containers in `@virtool/storage`'s `integration` Vitest project.

See [docs/storage.md](docs/storage.md) for the interface, the key
layout, the backend configuration and its both-or-neither credential
rule, the three S3 quirks, and the testing setup.

### Server → client push runs over SSE with id-only frames

Server-pushed cache invalidations are delivered over a single SSE
stream at `/events`. Each frame carries `{ domain, operation, id }`;
the client invalidates React Query caches by `domain` and refetches
through the REST API so per-user auth is
enforced on the refetch instead of in a fanout broadcast. Both
Python and Node publish onto the Postgres `client_events` channel;
`routes/events.ts` is the sole consumer.

`jobs` and `tasks` update frames are the exceptions: a running job or
task emits one per progress step and every one on screen holds its own
`detail(id)` query, so invalidating per frame cost a request per record.
They route through `createJobRefreshQueue` (`jobs/refresh.ts`) and
`createTaskRefreshQueue` (`tasks/refresh.ts`), which buffer ids and read
them with the batched `getJobs`/`getTasks` server functions instead.
Don't add a `detail(id)` invalidation back for either.

Adding a domain is a change in **three** places — `SseDomainSchema` and
`SseMessageSchema` (`packages/contracts/src/sse.ts`), and
`reactQueryHandler`'s `domains` record — and doing only the first two
leaves every frame parsed and then dropped. Python needs no change:
it publishes free-form domain strings, and a domain the schema does not
name is discarded silently at the client, which is how `subtractions`
frames went unhandled for as long as they did.

See [docs/server-push.md](docs/server-push.md) for the wire format,
auth on the SSE side, the batching queues, and the follow-up TODOs.

## Workflows

### The runtime is `@virtool/workflow`: no injection, no teardown, no hooks

Every workflow executor runs on `@virtool/workflow`: `defineWorkflow`,
`runWorkflow`, `createWorkPath`, `createRunSubprocess`,
`parseWorkflowRunConfig`, and `runWorkflowApp`. It is the port of Python's
`virtool/workflow/`, and it knows nothing about a database.

**The run loop and the job lifecycle are strictly apart.** `runWorkflow`
**returns** an outcome and never touches the network, `process.exit`, or a
signal handler; `runWorkflowApp` — the entrypoint a workflow app's `main.ts`
calls — owns all of that.

Object storage is reached the way `db` is on the server side: a
`StorageBackend` is **passed in as an argument**, never constructed here and
never a module-level singleton. See the file layer below.

Three decisions shape it and are not up for re-litigation:

- **No dependency injection.** Python resolves fixtures by introspecting a
  step's parameter names against a `ContextVar` registry. Here a run's
  context is an ordinary object built once, before the first step, by a
  per-workflow `buildContext`. Its `data` half must survive a JSON round
  trip — no class instances, no closures, no live handles — because the
  deferred end-to-end test bed expresses a run as files plus a JSON blob.
  `createWorkflowContext` asserts that on every run, not only under test.
  `state` is the mutable cross-step scratch and carries no such constraint.
  Lazy or memoized accessors were rejected; per-workflow construction is
  how one workflow fetches HMMs and another does not.
- **No teardown.** The container is ephemeral and process exit reclaims
  everything. Do not port `AsyncExitStack` or add a `dispose` /
  `Symbol.asyncDispose` layer.
- **No lifecycle hooks.** Python's ten hooks carried three callbacks in all
  of production: four `on_failure` deletions, plus `on_step_start` and
  `on_success` used internally by its own runtime. The deletions are gone by
  decision — a failed run leaves its half-built resource for the user to
  delete — `on_success` is redundant against the returned `RunOutcome`, and
  `on_step_start` survives as a single optional `onStepStart` on
  `RunWorkflowOptions`. Don't reintroduce a registry to give a workflow
  somewhere to put teardown; that is the previous rule again.

Steps are an **explicit ordered array**, never a scanned module. A step's
`id` is authored in `snake_case` and **must match the Python function name
it was ported from** — the jobs API stores it, so a slugified display
name changes the shape of a job's step list at cutover.

Cancellation is **cooperative** and is the one real divergence from Python:
aborting an `AbortSignal` interrupts nothing, so `runWorkflow` races the
in-flight step against the signal and abandons it rather than waiting,
leaving a `catch` attached so its later rejection cannot take the process
down mid-report.

Every bioinformatics tool runs through `context.runSubprocess`, which
`runWorkflowApp` builds once per run with
`createRunSubprocess({ signal, logger })`. Four rules it carries,
each of which is a departure from Python or from execa's defaults:

- **stdout is opened on `/dev/null` unless a `stdout` handler is given.** An
  unread pipe is a buffer that fills, and a tool writing a SAM stream fills
  it fast. stderr is always piped, logged line by line, and its last twenty
  lines ride on `SubprocessFailedError`.
- **Lines are split with a byte ceiling**, 128 MiB by default — the same
  `limit` Python passes to `asyncio.create_subprocess_exec`. `node:readline`
  has no ceiling at all. Overrunning it throws `SubprocessLineLimitError`
  and kills the tree.
- **Descendants are killed, and execa cannot do it.** There is no
  `killDescendants` option; `kill()` and `cancelSignal` reach the direct
  child only, which for `bowtie2` is a perl wrapper. So the runner spawns
  `detached: true` and signals `-pid` — SIGTERM, then SIGKILL after 5s.
  `ESRCH` and `EPIPE` from a kill racing an exit are logged at `debug` and
  never surfaced.
- **Exit code 15 is a failure here and a success in Python.** Only a
  cancellation-driven kill resolves, as `cancelled: true`.

`VT_JOBS_API_URL` and `VT_WORK_PATH` have **no defaults**, unlike Python —
its defaults point at nothing and at a relative path `createWorkPath` would
delete. The former is also a rename; Python calls it
`VT_JOBS_API_CONNECTION_STRING`. `VT_TIMEOUT` is in **seconds**.

The lifecycle half — `createJobsApiClient`, `claimJob`, `startPingLoop`,
`runWorkflowApp` — carries five rules:

- **Paths are unprefixed and every wire field is camelCase.** The jobs API
  serves no SPA, so `/jobs/claim` and `/jobs/{id}/ping` match Python's byte
  for byte. `baseUrl` is the cluster-internal jobs API service, **never**
  the public web origin. Shapes come from `@virtool/contracts`; don't
  redeclare one.
- **A pod learns its job id from the claim and nowhere else.** `claimJob`
  polls unauthenticated — the key comes back *from* the claim — and returns
  `null` when its signal aborts, which is how a claim timeout and a SIGTERM
  both arrive.
- **Retries are five, at a flat 5 s, on transport failures only.** Not
  exponential — that is Python's observed behaviour and the ping-timeout
  sweep is calibrated against it. Never retry a status the jobs API chose.
- **The ping loop is the cancellation channel, and a 401 is the signal.** A
  job key stops authenticating the moment its job reaches a terminal state,
  so a refused ping means the job is over — cancelled, or failed by the
  sweep — and the loop calls `signals.cancel()`. There is deliberately **no
  `cancelled` flag** on `JobPing`, which carries only `pingedAt`: a flag
  would have to be readable by a credential the same transition revokes,
  and it would speak only for `cancelled`. The jobs API names the state in
  the 401 body and the loop *logs* that message without branching on it —
  a broken credential produces the same 401, and `Invalid credentials`
  rather than `Job is cancelled.` in the logs is how that bug is caught.
- **The ping loop owns its retry policy** (pings are issued with retries
  disabled). A 401 is neither retried nor counted; every other failure is,
  and it gives up after five *consecutive* failures — resetting on success,
  which Python does not — logging at `warn`, and lets the run continue. Its
  ~20 s give-up window must stay well inside the jobs API's **five-minute**
  stalled-job sweep.
- **A failed workflow exits 0.** Failure is an API-side transition and a
  non-zero exit makes the `ScaledJob` retry the pod. Only a broken pod exits
  1; only SIGTERM exits 124. There is deliberately no failure call to make —
  the wire contract has no "fail" endpoint.

See [docs/workflow-runtime.md](docs/workflow-runtime.md) for the step
model, the eager-context rationale, the hook survey behind dropping them,
the terminal-state table, the cancellation race, the subprocess runner's
outcome table and process-group kill, and the full config table.

### Workflow files stream, and a key is minted, never composed

Every byte a workflow moves goes through `downloadToPath` / `uploadFromPath`
(`files/transfer.ts`). Files run to many gigabytes, so **nothing may
buffer** — `readFile`, `writeFile` and `Buffer.concat` are absent from the
transfer path by rule, not by accident.

**No key is derived from row identity, on either side.** A key to read
arrives from the jobs API, off the row that records it. A key to write is
minted with `mintStorageKey(domain, parentId)` and sent back on the finalize
manifest, which the route validates against that resource's own
`{domain}/{parentId}/` prefix and then records verbatim. A cache is the one
exception in the other direction: `POST /caches` takes a bare uuid and
composes `cacheKey(uuid)` server-side, because that key genuinely is
derivable. The only fixed builders left are the two HMM constants.

**Finalize is one call per resource** — `PATCH /subtractions/{id}`,
`PATCH /samples/{id}`, `PATCH /analyses/{id}` — carrying the resource's own
fields plus the manifest, so a run cannot end with the parent flipped
`ready` and its file rows missing. The manifest declares no `size` and no
`name_on_disk`: the row is written with the byte count the route reads back
from storage, which is what makes a row pointing at nothing impossible.

**A resource that is unusable without its files must carry them**, and the
bound is on the contract in `@virtool/contracts` so the runtime cannot build
the call: a sample sends one or two reads (`.min(1).max(2)`), a subtraction
sends its source FASTA (`.min(1)`). An analysis manifest is legitimately
empty — pathoscope's whole output is the `results` blob — and `results`
being required is the guard there. A **subtraction accepts one filename,
`subtraction.fa.gz`**, not Python's seven: nothing consumes the bowtie2
shards, because both analysis workflows build the index locally from the
`.fa.gz`. That is the **write** path only — subtractions Python finalized
still have `bowtie2` rows, `GET /subtractions/{id}` keeps serving them, and
`SubtractionFileType` keeps both members. See
[docs/jobs-api.md](docs/jobs-api.md).

`tar.ts` is `tar-stream`, not `node-tar`, because it is a pure stream
parser. It diverges from Python's `tar.py` twice, deliberately: extraction
stages into a sibling directory and renames on success rather than reading
the archive twice to pre-validate it, and links and device nodes are
rejected outright rather than admitted when they stay inside the target.

`deriveCacheKey` (`cache/key.ts`) reproduces `json.dumps(..., sort_keys=True,
separators=(",", ":"), ensure_ascii=True)`, which `JSON.stringify` does not.
Mark a Python `float` with `float()` — an unmarked number serialises as an
`int`, and `1.0` versus `1` is a different key. Non-ASCII param keys and
numbers the two languages format differently are rejected rather than
guessed at. `cache/key.test.ts` holds a golden table generated by running
Python; **never update a golden to match this implementation's output** —
that converts a caught divergence into a permanent one.

### The reference index is a SQLite file, read with `node:sqlite` and no ORM

An index reaches a workflow as one file, `virtool-index-sqlite-v1.sqlite`,
built by Python's `index_sqlite.py`. `packages/workflow/src/index/` mirrors
that schema (`schema.ts`), reads it (`queries.ts`) and writes the collapsed
artifact pathoscope produces (`create.ts`). JSON was abandoned because a real
reference exceeds V8's maximum string length.

**There is no Drizzle here**, against the original plan: it ships no
`node:sqlite` driver, and the three alternatives all fail — `sqlite-proxy`
materialises every row, `better-sqlite3` is a native dependency, and using
Drizzle for SQL generation alone adds a fake driver for six fixed queries.
`node:sqlite` is unflagged on Node 22 and 24, so nothing needs raising.

Four rules it carries:

- **Ordering is the output.** Sequence order decides FASTA order, so Bowtie2
  index order, so every SAM line. `iterSequences`, `iterDefaultSequences` and
  `iterOtuSequences` carry Python's `ORDER BY` verbatim.
- **`iterOtus` returns insertion order, and the `ORDER BY` clauses inside its
  subqueries are no-ops that must stay.** SQLite sorts the one row an
  aggregate returns, not the rows entering it, so `json_group_array` collects
  in scan order. Python has the same no-op; `cd-hit-est` picks its
  representative by the order it sees, so "fixing" the sort changes the
  analysis. Removing the clauses could change the plan, and the plan is what
  decides the order.
- **Nothing materialises the index.** Every iterating query is an async
  generator over `StatementSync.iterate()` that yields to the event loop each
  batch, so the ping loop survives a long scan. Id sets bind through
  `json_each`, never one `?` per id.
- **The fixture is Python's.** `src/index/fixtures/` holds an artifact Python
  built plus the golden results of every query; `generate.py` is the
  provenance record. **Never edit a golden to match this implementation's
  output.**

See [docs/index-artifact.md](docs/index-artifact.md).

### Workflow tests stand on `@virtool/workflow/testing`

The harness replaces Python's `virtool/workflow/pytest_plugin/` and
`tests/fixtures/workflow_api/`. It lives in
`packages/workflow/src/testing/` and every workflow app's tests import it
from `@virtool/workflow/testing` — never from `apps/web`, which it does
not reach.

**Everything is a factory function.** pytest injected fixtures by
parameter name and resolved a dependency graph between them; Vitest has
no equivalent and this harness deliberately builds none. Nothing is
installed by importing it, there is no module-level mutable state — test
files run in parallel processes — and anything needing cleanup returns
its disposer for the caller to hand to `onTestFinished`.

Six rules it carries:

- **It splits by what the test is asking.** A *workflow* test gets
  `createFakeJobsApiClient(state)` and exercises no HTTP — "does nuvs
  produce the right results" gains nothing from a wire format. A
  *runtime* test gets `startJobsApiTestServer(state)`, a real
  `node:http` server, because retry, ping-driven cancellation, Basic
  credentials and status-to-error mapping only mean something over one.
  **Both run `handleJobsApiRequest` over the same `JobsApiState`**, so a
  test moves between them without rewriting its setup and the two halves
  cannot drift.
- **The fixture's responses are camelCase and built from
  `@virtool/contracts`.** The embedded server is what the jobs API
  client is tested *against*: spelled snake_case on both sides they
  agree with each other and the mismatch surfaces only against the real
  `apps/jobs-api`. Cancellation is therefore a **401 naming the state**,
  not a `cancelled` flag — `JobPing` has none.
- **Builders are seeded, with a fixed default.** `createFakeJob`,
  `createFakeSample`, `createFakeSubtraction` and the rest take
  `(overrides, seed)` and are reproducible, because checksums are the
  assertion. `STATIC_TIME` is **injected**, never patched onto a global
  clock, and is an ISO string rather than a shared `Date` — a shared one
  is module-level mutable state.
- **`buildTestContext` goes through `createWorkflowContext`**, so
  `assertSerializableData` runs on every test context. That seam is what
  the deferred end-to-end bed depends on and it rots silently the first
  time someone parks a closure on `data`.
- **Seeding helpers mint their keys and return them.** The caller
  attaches the returned key to the fake row the fixture will serve, and
  the code under test reads it back out of that metadata — its only
  route to the bytes. A minted key is unguessable by construction, so a
  fixture that composes one from a row id or falls back to a filename
  finds nothing. `seedHmmFiles` is the exception and keeps the two fixed
  HMM constants.
- **`createTestWorkPath` is never a fixed path.** `createWorkPath`
  unconditionally `rm -rf`s its target, so a shared path means one test
  deleting another's tree mid-run.

`checksumFile` and `checksumDirectory` hash **decompressed** content —
gzip embeds an mtime and varies by compressor, so hashing the compressed
bytes fails every comparison against a Python fixture for reasons that
are not correctness.

See [docs/workflow-testing.md](docs/workflow-testing.md).

## Code style

The basics:

- **Functions:** Use function declarations, not arrow functions. For React
  components this is enforced by Biome's
  `useReactFunctionComponentDefinition`. Everywhere else it stays a
  convention — Biome has no general `func-style` equivalent, so nothing
  catches a violation in a plain function but review.
- **Refs:** Don't use `forwardRef`. React 19 makes `ref` an ordinary prop:
  type a wrapper's props with `ComponentPropsWithRef` and let `ref` flow
  through the `...props` spread. `forwardRef` also trips
  `useReactFunctionComponentDefinition`, because the component ends up as a
  function expression rather than a declaration.
- **Imports:** Biome organises imports automatically.
- **Conditionals:** Always use curly braces with `if`/`else`.
- **Prefer `const`** over `let`.
- **Types:** Use `type`, not `interface`. Enforced by Biome's
  `useConsistentTypeDefinitions`. The exception is declaration merging —
  augmenting `Window` or TanStack Router's `Register` requires an
  `interface`; those sites carry a `biome-ignore` explaining why. Prefer
  string literal unions over `enum`.
- **JSDoc:** Every exported `type` gets a one-line `/** ... */`.
- **Naming:** `is`/`has`/`get` for pure reads; `check`/`validate`/
  `assert` for may-throw. A `createServerFn` export gets an `Fn` suffix
  (`loginFn`, `getSampleFn`) — it's an RPC call, not a plain function,
  and the suffix marks that at every call site. The domain function it
  wraps keeps the plain name (`login`, `getSample`) and never crosses
  the network. `functions.ts` imports that data function under its own
  name — the `Fn` suffix already keeps the two apart, so don't alias it
  to `...Impl` on the way in.
- **Comments:** Default to none. Document *why* when non-obvious, not
  *what*. Never narrate history ("this used to do X, now it does Y") —
  that's git blame's job, and it just accretes stale layers; write a
  comment about a past change only if reverting it would silently
  reintroduce a bug, phrased as a standing warning, not a changelog.
- **Concurrency:** Independent awaits go in `Promise.all` — don't pay
  the sum of latencies.

See [docs/code-style.md](docs/code-style.md) for the full TypeScript,
naming, comments, and concurrency rules with examples.

## Testing

- **Framework:** Vitest; Vitest node env for packages.
- **Projects (web app):** `web` runs browser code under jsdom.
  `server` runs `src/server/**` under **node** — server code runs on
  Node in production, and under jsdom its typed arrays come from a
  different realm, so bytes compare unequal to identical bytes.
  `a11y` runs `*.a11y.test.tsx` under headless Chromium
  (Playwright) so axe's layout-dependent rules — `color-contrast` above
  all — can actually run; it needs `playwright install chromium`. `pnpm
  test` runs all three; use `--project <name>` to narrow.
- **Projects (`@virtool/storage`):** `unit` covers everything testable
  against `MemoryStorage`; `integration` runs the S3 and Azure backends
  against real Garage and Azurite containers and has its own CI job.
- **`@virtool/workflow` runs under node via its own `test` script**,
  which `pnpm -r test` picks up — the per-package model every
  `packages/*` follows. **Do not add a project for it to
  `apps/web/vitest.config.js`**: that file is where `web`, `server` and
  `a11y` live, and declaring a package's project inside `apps/web` would
  contradict the harness's own rule that nothing in it reaches the SPA.
  Its tests are server-shaped and need node for the same reason the
  `server` project does.
- **`@virtool/data`**, **`@virtool/jobs-api`** and **`@virtool/tasks`**
  each run one node project against a Postgres testcontainer, and each
  has its own CI job for the same reason storage does — a container pull
  does not belong in the fast package loop. All three are excluded from
  `Packages / Test`.
- **The Postgres container is described once**, in
  `packages/data/src/db/test/globalSetup.ts`. The `@virtool/data`
  project, the web app's `server` project, `@virtool/jobs-api` and
  `@virtool/tasks` all name that module as their `globalSetup` — the
  latter three through the `@virtool/data/db/test/globalSetup` subpath —
  so the options cannot drift and `withReuse()` boots one container for
  every suite locally. There is no teardown; `docker rm -f` it when done.
  Don't add a second copy of the container options.
- **Test location:** `__tests__/` directories alongside source files
  (web), or sibling `*.test.ts` files (packages).
- **Test files:** `ComponentName.test.tsx` or `functionName.test.ts`.
- **Imports:** Use explicit vitest imports (`import { describe, it,
  expect, vi } from "vitest"`).
- **Setup:** `apps/web/src/tests/setup.tsx` provides
  `renderWithProviders()`, `renderWithRouter()`, and `MemoryRouter`, and
  gives the test `QueryClient` `retry: false` (a failed query surfaces
  its error immediately), so error paths are testable and under-mocked
  tests fail loudly rather than sitting through retries.
- **Test doubles** split two ways by what they do, and a helper lives
  in exactly one of them:
  - `src/tests/fake/` — `createFake*` data generators. No mocking.
  - `src/tests/server-fn/` — `vi.fn()` stubs over the TanStack Start
    server functions, named `mock<ServerFnName>` after the function
    they stub. Returns the `vi.fn()` itself, so assert with
    `expect(getUser).toHaveBeenCalled()`.

  Files under `server-fn/` mirror the mocked
  `@server/<feature>/functions` module, not the client feature —
  `getAccount` is stubbed from `server-fn/users.ts`. The SPA has no HTTP
  client, so there is no HTTP mocking library either: stub the module
  that would make the call, never an interceptor. Nothing blocks an
  outbound request, so a test that reaches the network really will.

  **Both directories are browser-side only.** Workflow data generators,
  jobs API fakes and process fakes live in the harness under
  `packages/workflow/src/testing/` and are imported from
  `@virtool/workflow/testing`. No test double lives in two places, and
  `apps/web/src/tests/` gains nothing from a workflow fixture.
- **Database tests:** `createTestDatabase()` from
  `@virtool/data/db/test/fixtures` gives a suite its own isolated
  Postgres database with the schema applied, and installs the
  `client_events` emitter on it. Test files run in parallel, so never
  share one database between them. A test that stubs
  `@virtool/data/events/emit` must stub `createEmitter` alongside `emit`,
  or the fixture's install call finds nothing to call.
- **Server functions:** a test cannot call a server function by
  importing it — the Vite plugin moves the handler body into a virtual
  `?tss-serverfn-split` module, so invoking the import runs none of your
  code and a naive test passes while asserting nothing. Import the split
  module and call it through `callServerFn` from `@server/test/serverFn`
  (`groups/functions.test.ts` is the worked example).
- **Assertions:** Use explicit `expect()` assertions, not snapshots.
- **User interaction:** Use `@testing-library/user-event` over
  `fireEvent`.
- **Queries:** Prefer accessible queries (`getByRole`,
  `getByLabelText`) over `getByTestId`; don't disambiguate by index.
- **Accessibility:** `expectNoViolations(container)` from
  `src/tests/axe.ts` runs axe-core over a rendered subtree. Opt-in per
  test, not auto-run in `renderWithProviders`; `color-contrast` is off by
  default (jsdom has no layout engine). Re-enable it in a `*.a11y.test.tsx`
  file — those run in the browser `a11y` project — via
  `expectNoViolations(el, { rules: { "color-contrast": { enabled: true } } })`.

See [docs/testing.md](docs/testing.md) for the unit / integration
layer split, where to mock the network boundary, snapshot guidance, the
axe-core accessibility helper, and the shared-fixtures rule.
## Process

### Documentation

`AGENTS.md` is the index. It carries the rules an agent needs to
start work — terse statements with pointers into `docs/` for the
full treatment. Detailed explanations, examples, and rationale live
in `docs/`.

**`docs/` files are self-contained leaves.** Each doc covers one
topic end-to-end and does not link to or reference other docs.
Routing between topics is `AGENTS.md`'s job, not the docs'. If you
find yourself wanting to write "see other-doc.md", either the detail
belongs in `AGENTS.md` as the routing layer, or the two docs need to
be reorganised so each is complete on its own.

**`AGENTS.md` is updated in the same commit as the change that
invalidates it.** It is the first file every agent and contributor
reads. A stale line does not merely fail to help — it actively
misleads, sending readers to deleted files and dead APIs.

Before committing, check whether your change contradicts anything in
this file. It does if you have:

- removed, added, or replaced a dependency listed under **Key libraries**;
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
