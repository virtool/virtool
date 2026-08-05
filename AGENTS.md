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
  Vite build (a `build-site` CI job) and Vitest suite are its gate. Deploy is
  manual: `pnpm --filter @virtool/site deploy`.
- `apps/jobs-api/` — `@virtool/jobs-api`, the jobs control plane. A plain Node
  HTTP service on port 9950, mirroring Python's `virtool/jobs/main.py`
  (`api-jobs-service`, ClusterIP, no ingress). Serves `/health/live` and
  `/health/ready` today. Image: `ghcr.io/virtool/jobs-api`, Alpine.
- `apps/create-subtraction/` — `@virtool/create-subtraction`, the first workflow
  executor: a one-shot process that starts, works, exits. Only its object
  storage half is wired so far. Image: `ghcr.io/virtool/ts-create-subtraction`,
  **Debian** — it copies binaries from `ghcr.io/virtool/tools`, which are built
  against `python:3.13-bookworm` and cannot load under musl. It also installs
  `perl` and `python3`, because `bowtie2` and `bowtie2-build` are interpreter
  scripts wrapping the real binaries. The other three workflow executors get a
  directory, a Dockerfile stage and a CI matrix entry when their port lands.
- `apps/workflow-pathoscope/` — the pathoscope workflow image
  (`ghcr.io/virtool/ts-pathoscope`). Holds only a `Dockerfile` today: it
  compiles `packages/pathoscope-core` and layers the `ghcr.io/virtool/tools`
  binaries on a Debian Node base. Built from the **repo root**
  (`docker build -f apps/workflow-pathoscope/Dockerfile .`).
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
    points)
  - `@virtool/storage` — object storage: the S3 and Azure backends, the
    key builders, and `MemoryStorage`
  - `@virtool/data` — the database and domain data layer: the Drizzle schema,
    `createDb`, every domain's `data.ts`, the `client_events` emitter, the
    bcrypt/session/token primitives, and `AppError`
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
  does the construction: it builds `storage`, calls `createDb(config)` to get
  `client` and `db`, and calls `createEmitter({ client, logger })`. Every
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
workspace. Run `cargo` there directly; a `test-rust` CI job gates it.
Building the crate needs `libclang-dev` installed, because `hts-sys` runs
bindgen against htslib's headers.

`pnpm build` builds **every app but `apps/site`**, which is gated by its own
`build-site` CI job. `pnpm check` and `pnpm format` run biome over `apps` and
`packages` rather than a literal `apps/web/src`, so a new app's source is linted
without an edit; `apps/site` is excluded once, in `biome.json`'s
`files.includes`.

Don't use the dev server. Live development is done using Tilt and Minikube and is
currently configured in another repository.

### When to run checks

- After changing route files in `apps/web/src/routes/`: run
  `pnpm --filter @virtool/web exec tsr generate` (or the equivalent
  `@tanstack/router-cli generate`) to regenerate
  `apps/web/src/routeTree.gen.ts` before running type checks.
- `apps/web/src/routeTree.gen.ts` is checked in. If it shows up in
  `git status` — even when it looks like unrelated drift from a
  regen — commit it alongside your other changes. Never leave it
  out of a commit.
- Before committing: `pnpm check`, `pnpm typecheck`, and `pnpm knip`.
- After changing tests: run the specific test file with
  `pnpm --filter @virtool/web exec vitest run <path>`.
- Full test suite only when asked or when changes are cross-cutting.
- Always fix all lint errors. Biome's lint rules are all set to `error` in
  `biome.json` (there are no warn-level rules), and CI's `check-biome` job runs
  `pnpm check` — so `pnpm check` must exit 0 before merging. The main branch is
  guaranteed to pass `pnpm check` cleanly, so any issues are caused by your
  changes — never dismiss them as pre-existing.
- No dead code. CI's `check-knip` job runs `pnpm knip` (config in
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

`routes/index.tsx` — the `/` to `/samples` redirect — stays **outside**
`_authenticated`, and its `beforeLoad` stays synchronous. Nested, resolving `/`
ran that layout's async guard before throwing a second redirect, so signing in
navigated `/login` to `/` to `/samples` with the layout match re-rendering
mid-chain — the window the router throws `undefined` in. Moving it back under
the guard reintroduces that. Nothing is exposed by leaving it unguarded: it
renders nothing, and `/samples` carries the guard.

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
re-export (`samples/types.ts` is the worked example, keeping only its
genuinely client-only shapes; `references/` and `indexes/` have no
`types.ts` left at all, because every shape they had was a wire shape). A client
`types.ts` must never import a shape from `@virtool/data` — the Biome
override rejects it, and it would point the client at a module the server
does not own the shape of. `data.ts` still owns what only it uses: its
`*Values` and `*Options` argument types, its `AppError` subclasses, and
its row mappers.

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
- **Compose a storage key only from a row already matched.** A `$filename` param
  is looked up first — against `subtraction_files`, or a whitelist of the names
  an index build produces — and the key is then built from that row's own `name`
  and `storage_key`. Never from the URL param, which is how a param traverses
  out of the prefix, and never from the row id.
- **`Content-Disposition` carries the row's `name`**, never the UUID-prefixed
  `name_on_disk` that keys the object.
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

The non-Vite apps carry their own copy of the resolver in their
`src/config.ts` — they cannot reach `apps/web/src/server`, and they parse
a much smaller set of keys than the web app's zod schema. Keep the
`<KEY>_FILE` behaviour in any new one; do not add a plain
`process.env` read that skips it.

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

When `VT_SENTRY_DSN` is set, server logs at `info` and above are
forwarded to Sentry automatically (via a pino destination stream, not
`Sentry.pinoIntegration()`); redaction still applies and dev does not
forward.

See [docs/logging.md](docs/logging.md) for the redaction
defaults, `VT_LOG_LEVEL` resolution, where the logger singleton lives, and
the Sentry forwarding wiring.

### Metrics

Prometheus scrapes `GET /metrics`, gated by a bearer token
(`VT_METRICS_TOKEN`). With the variable unset the route reports 404, so
metrics are off until a deployment opts in.

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
nothing and report every bucket as zero. The probe itself is bounded too:
it queries the very pool it measures, so a saturated pool queues it
client-side where nothing rejects, and an unbounded read would cost the
whole scrape rather than just the pool gauges.

`metricsMiddleware` loads the registry through `createServerOnlyFn`
because a static import would drag prom-client and its `node:*` reads
into the client graph.

See [docs/metrics.md](docs/metrics.md) for the exported series, the
token check, cardinality rules, and what deeper instrumentation would
take.

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
mints its `storage_key`, stamps every unbuilt `legacy_history` row with
it, and creates the `create_index` task the Python runner claims — that
task writes the artifact and flips `ready`. The insert runs under
`pg_try_advisory_xact_lock(hashtext('index_build:{referenceId}'))`, the
same key Python takes, so a build started from either service excludes
one started from the other. Don't drop the lock, and don't derive
`storage_key` from the row id — a migrated index keys on its old Mongo
id instead.

See [docs/database.md](docs/database.md) for which domains the TS
server can reach today, why the OTU tables keep their legacy shape and
what that costs a writer, the `legacy_id` resolution rules, and the
column-default convention.

### Files live in object storage, shared with Python

Uploads, reads, analysis results, indexes, subtractions, HMM profiles,
and caches live in S3 or Azure Blob — **the same bucket Python uses**.
`@virtool/storage` exposes a five-method streaming interface
(`read`, `write`, `delete`, `list`, `size`); there are no paths, file
handles, or presigned URLs. Keys are built by `@virtool/storage/keys` and
must stay byte-for-byte identical to Python's — a divergence silently
reads nothing and orphans what it writes. There is no filesystem backend.

`StorageError` and `StorageKeyNotFoundError` come from
`@virtool/storage/errors` and extend plain `Error`, not the data layer's
`AppError`, so the storage package carries no dependency on the data layer.

The backend is built once at startup and **passed into `data.ts`
functions as an argument, the way `db` is**. `deletePrefix` never
throws; it returns failures, and callers must log them.

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

See [docs/server-push.md](docs/server-push.md) for the wire format,
auth on the SSE side, the batching queues, and the follow-up TODOs.

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
- **`@virtool/data`** runs one node project against a Postgres
  testcontainer, with its own CI job for the same reason storage has
  one — a container pull does not belong in the fast package loop.
- **The Postgres container is described once**, in
  `packages/data/src/db/test/globalSetup.ts`. Both the `@virtool/data`
  project and the web app's `server` project name that module as their
  `globalSetup` — the web app through the
  `@virtool/data/db/test/globalSetup` subpath — so the options cannot
  drift and `withReuse()` boots one container for the two suites
  locally. There is no teardown; `docker rm -f` it when done. Don't add
  a second copy of the container options.
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
