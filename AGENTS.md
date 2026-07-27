# Virtool UI

React + TypeScript single-page application for Virtool, a bioinformatics platform.

> `CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` — never write to
> `CLAUDE.md` directly.

## Repository layout

This is a **pnpm monorepo**:

- `apps/web/` — the Vite SPA (formerly the top-level repo). All UI code lives
  here.
- `apps/site/` — `@virtool/site`, the product website at
  [virtool.ca](https://www.virtool.ca) (Astro + Tailwind, deployed to
  Cloudflare Workers). Kept out of the repo-wide `pnpm check`/`pnpm knip`
  gates — Astro is not linted by biome and is opaque to knip — so its own
  Vite build (a `build-site` CI job) and Vitest suite are its gate. Deploy is
  manual: `pnpm --filter @virtool/site deploy`.
- `packages/` — shared, framework-agnostic libraries published as workspace
  packages:
  - `@virtool/logger` — pino wrapper, server-side log defaults and
    `child({...})` pattern
  - `@virtool/bio` — sequence utilities (complement, translation, etc.)
  - `@virtool/contracts` — cross-process data shapes, zod-validated where a
    boundary parses them
  - `@virtool/sentry` — shared Sentry option helpers (node + browser entry
    points)

Use `pnpm` for all install, run, and exec commands — not `npm` or `bun`.

## Documentation

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
- completed or abandoned a project listed under **Projects**;
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

## Package manager

This repo uses **pnpm**. Common commands:

```bash
pnpm install                      # install everything (root + apps + packages)
pnpm -r test                      # run every package's tests
pnpm -r typecheck                 # typecheck every package
pnpm check                        # biome check (whole repo)
```

## Tooling

### Commands (from repo root)

| Task | Command |
| --- | --- |
| Typecheck | `pnpm typecheck` |
| Lint + format | `pnpm check` |
| Format only | `pnpm format` |
| Dead-code scan | `pnpm knip` |
| Test (single run, all packages) | `pnpm test` |
| Test (watch, web app) | `pnpm --filter @virtool/web test:watch` |
| Test (filtered) | `pnpm --filter @virtool/web exec vitest run src/path/to/file` |
| Build | `pnpm build` |

Don't use the dev server. Live development is done using Tilt and Minikube and is
currently configured in another repository.

### When to run checks

- After changing behavior covered by a `docs/` file: update that file
  in the same commit (see Documentation above).
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

## Architecture

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
  middleware, db, auth) — the new path for backend responsibility
  migrating into this repo
- `src/tests/` - Test setup, fakes, REST mocks, and server-function mocks
- `src/types/` - Shared type definitions

### Path aliases

Feature directories have a `@name` alias (e.g., `@app/utils`, `@base/Button`,
`@samples/queries`) — see `paths` in `apps/web/tsconfig.json` for the
authoritative list. A few directories (`src/types/`, `src/routes/`) have no
alias and are reached through the catch-all `@/*`, which maps to
`apps/web/src/*`. Prefer specific aliases over `@/`.

### Key libraries

- **React 19** with React Compiler, run as a Babel pass over `.ts` and `.tsx`
  via `@rolldown/plugin-babel` + `reactCompilerPreset` (see below)
- **TanStack Router** for routing
- **React Query** (`@tanstack/react-query`) for server state
- **zustand** for client state
- **react-hook-form** + **zod v4** for forms and validation
- **superagent** for API calls (via `@app/api.ts` client)
- **Tailwind CSS v4** for all styling
- **Radix UI** primitives for accessible components
- **CVA** (`class-variance-authority`) for component variants
- **Lucide React** for icons
- **exceljs** for the analysis XLSX export — server-only, and reached through a
  dynamic `import()` inside `@server/analyses/export` so it stays out of every
  other bundle

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

Opt a single function out with a `"use no memo"` directive — useful for
bisecting a suspected compiler interaction, but a fix, not a resting place.

### Nothing heavy in a route's critical exports

`autoCodeSplitting` splits each route file in two. The **critical** half —
`loader`, `beforeLoad`, `validateSearch`, `loaderDeps` — is imported
*statically* by `routeTree.gen.ts`, so whatever it reaches lands in the eager
bundle that **every** page load pays for, including `/login`. Only the
`component` half is lazy.

So, in a route's critical exports:

- **Never statically import `queries.ts` or `@app/api`.** Pull the
  `queryOptions` factory in from inside the loader body instead:
  `const { sampleQueryOptions } = await import("@samples/queries");`. A static
  import drags superagent and the feature's whole request layer into the eager
  bundle. Importing them in the `component` half is fine — that half is lazy.
- **Never use zod in `validateSearch`.** It is synchronous and cannot be
  deferred, so a zod schema pins all ~108 KB of zod eagerly. Use the
  dependency-free coercion helpers in `@app/searchParams` and type the function
  as `(input: Partial<T> & SearchSchemaInput) => T` — the `SearchSchemaInput`
  tag is what keeps `<Link search={{ page: 2 }}>` partial.
- **Paginated list routes share `@app/pagination`.** Spread `paginated(input)`
  into the returned object and intersect the route's search type with
  `Paginated` (`type FooSearch = Paginated & { term: string }`) rather than
  re-declaring `page: num(input.page, 1)`. Loaders pass `DEFAULT_PER_PAGE` from
  the same module, not a literal `25`.

`src/server/**` is reachable from the browser program via `start.ts`, so the
same rule applies there: reach server-function modules through
`createServerOnlyFn` (see `auth/middleware.ts`), never a top-level import.

### What a route guard reaches must not import `@app/api`

A `beforeLoad` that resolves an account, or a loader on `/login` or `/setup`,
runs for unauthenticated visitors. Anything it reaches — even *dynamically* —
is downloaded on the login wall.

**Tree-shaking will not save you here: the chunk is the unit of loading, not
the export.** `account/queries.ts` genuinely uses `apiClient` for its API-key
and password hooks, so its chunk contains superagent; importing that chunk for
one server-function-backed export still drags superagent in. Marking `@app/api`
side-effect-free does nothing about this.

So the queryOptions the guards need live in modules with no `@app/api` import
at all:

- `@account/account` — `accountQueryOptions` / `useFetchAccount`, backed by the
  `getAccount` server function.
- `@administration/passwordPolicy` — `passwordPolicyQueryOptions`, backed by
  `getPasswordPolicyFn`.
- `@nav/queries` — `rootQueryOptions` / `useRootQuery`, backed by the `getRoot`
  server function. The guard reads `firstUser` from it before a session
  exists; the whole module is `@app/api`-free.

All three are server-function-backed and need no HTTP client. Don't fold them
back into a feature's `queries.ts` that also imports `@app/api`, and don't add
an `apiClient` call to any of them. Prefer a server function over a Python REST
call for anything a guard reads.

### Heavy dependencies get their own module

A module's imports survive tree-shaking if the package does not declare
`sideEffects: false` — so a grab-bag module leaks its heaviest dependency into
every bundle that wants *any* of its exports. `cn()` (`@app/cn`) is split out
of `@app/utils` for exactly this reason — it keeps `tailwind-merge` out of every
bundle that only wants a plain utility. Don't merge it back.

### Routing: in-app navigation uses `<Link>`

Internal links use `<Link>` from `@tanstack/react-router`. A plain `<a>` to an
internal route triggers a full page reload. For query strings, use `search` on
`<Link>` — don't add an `href` escape hatch to link wrappers.

`<a>` is only for external URLs and deliberate full reloads.

### API calls

Use the superagent-based client in `apps/web/src/app/api.ts`. API errors have
the shape `error.response?.body.message`.

Each feature owns a `queries.ts` module that folds its request logic directly
into React Query hooks and `queryOptions` factories — there is no separate
per-feature `api.ts` layer. Inline each `apiClient` call into the hook's
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
`@<feature>/keys` and so pays for none of the request layer (superagent, zod,
the server-function stubs) that `queries.ts` pulls in.

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

### Styling

- Styling is Tailwind utility classes. There is no CSS-in-JS; styled-components
  has been removed from the repo.
- Use the `cn()` function from `@app/utils` for conditional classes (combines
  `clsx` + `tailwind-merge`).
- Don't use arbitrary Tailwind classes like `max-h-[210px]`.
- Design tokens — colors, spacing, fonts — are defined in
  `apps/web/src/app/style.css` under `@theme`, with keyframes in
  `apps/web/src/app/animations.css`. Check there before inventing a color or
  spacing value, and add a token rather than hardcoding a hex.

### Base component color props

Base components in `src/base/` that expose a `color` prop should accept the
shared `PaletteColor` type from `@base/types`
(`"blue" | "green" | "gray" | "orange" | "purple" | "red"`). Don't redeclare the
union locally, add one-off colors, or trim the set per component — keep the
surface uniform. Icon-based components (`Icon`, `IconButton`, `Circle`) use
`IconColor`, which is `PaletteColor | "black"`.

If a component has multiple variants (e.g. `solid` / `soft`), `color` should
work in every variant. A variant that silently ignores `color` is a footgun;
either honor it across the board or drop the prop for that variant.

### Server modules layer as `data.ts` → `service.ts` → `functions.ts`

New TanStack Start server features under `apps/web/src/server/<feature>/`
use a three-file layering: `data.ts` (pure domain + persistence /
external IO), optional `service.ts` (cross-`data` orchestration), and
`functions.ts` (TanStack Start shell, zod validation, error mapping).
Imports flow `functions → service → data` and never the reverse. The
db handle is injected as the first argument to `data.ts` functions,
not imported.

Type that first argument `DbOrTx` (from `@server/db/pg`), not `Db`, for
any function that might be called inside a `db.transaction(...)`.
Drizzle's transaction handle is not assignable to `Db`, so a helper
typed `Db` cannot be reused inside a transaction without being widened
first.

Legacy features that still call the Python API through their
client-side `api.ts` are not subject to this layering.

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

The arrow runs one way. `src/server/**` must **not** import from the
browser feature tree — a Biome `noRestrictedImports` override blocks
`@administration/*`, `@app/*`, `@banner/*`, and `@users/*` there, because
a server file reaching into a DOM-typed module breaks the server project
at a distance. Shapes and helpers both sides need live *down* in
`@virtool/contracts` (roles, permissions, banner colors, the SSE schema,
the reference wire shapes, `UserNested`, `Task`, `SearchResultV2`);
the server imports them from the package, and the client feature module
re-exports them so its own call sites are undisturbed.

**A domain's wire shapes belong in `@virtool/contracts`, not in
`data.ts`.** What a server function returns is read by both sides, so
`data.ts` imports those types from the package and components import the
same names straight from `@virtool/contracts` — no feature `types.ts`
re-export (`references/types.ts` and `samples/types.ts` are the worked
examples; each keeps only its genuinely client-only shapes). A client
`types.ts` must never `import type ... from "@server/*"` — that points
the client at the server's emitted declarations for a shape the server
does not own, and drags a data-layer module into the browser's type
graph to get it. `data.ts` still owns what only it uses: its `*Values`
and `*Options` argument types, its `AppError` subclasses, and its row
mappers.

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
the browser. This was tried and reverted.

Raw `Request` handlers in `createFileRoute` (e.g. SSE routes) run
outside the server-function context and call
`requireAuthenticatedRequest(request)` instead.

File uploads are a raw route (`routes/uploads.ts` → `@server/uploads/upload`),
**not** a server function. `uploads/uploader.ts`'s `postUpload` posts the raw
`File` to `POST /uploads` with `XMLHttpRequest`, because only XHR reports upload
progress — `fetch` cannot — and read files can run to many gigabytes. The handler
reads `name`/`type` from the query string and streams `request.body` to storage
(never `request.formData()`, which buffers the whole file in the Node heap), and
returns a plain-JSON `Response` the XHR can `JSON.parse`. Because no policy
middleware runs on a route, the handler enforces the floor itself:
`requireAuthenticatedRequest` then a `hasPermission(session, "upload_file")`
check. Don't fold it back into a server function — the RPC client uses `fetch`
and would lose progress.

The analysis CSV/XLSX export (`routes/analyses.documents.$document.ts` →
`@server/analyses/download`) is a raw route for the mirror-image reason: the
client reaches it with a plain `<a href>`, so the browser has to receive a real
response carrying a `Content-Disposition` header, which an RPC call cannot
produce. Its `$document` param is the `{id}.{extension}` segment. It too
enforces its own floor — `requireAuthenticatedRequest`, then the **read** right
on the analysis's parent sample.

Raw routes are also the only endpoints reachable with an **API key**.
`requireAuthenticatedRequest` accepts either the session cookie pair or an HTTP
Basic `Authorization` header carrying `handle:key`; server functions stay
cookie-only. A key-authenticated session carries the key's permissions, and
`hasPermission` intersects them with the user's own — the key caps
administrators too.

See [docs/auth.md](docs/auth.md) for the middleware composition, the
session model, cookies, lifetimes, and the login / reset / logout
flows.

### Data store: Postgres-first

The TypeScript server reads and writes **Postgres only** (via
Drizzle). Python is the sole owner of schema and migrations — TS code
reads and writes against the schema Python defines. Mirror Python-side
column defaults with Drizzle `.$defaultFn()`, never `.default()` —
the real columns have no `server_default`, so `.default()` inserts
`null`.

Postgres is now Virtool's sole data store — Python removed MongoDB
entirely, so every domain's records live in Postgres and there is no
Mongoose / Mongo-driver layer here. A domain not yet reachable from the
TS server is missing only its Drizzle mirror and server functions, not
its data — build those against the tables Python already defines.

See [docs/database.md](docs/database.md) for which domains the TS
server can reach today, the `legacy_id` resolution rules, and the
column-default convention.

### Files live in object storage, shared with Python

Uploads, reads, analysis results, indexes, subtractions, HMM profiles,
and caches live in S3 or Azure Blob — **the same bucket Python uses**.
`src/server/storage/` exposes a five-method streaming interface
(`read`, `write`, `delete`, `list`, `size`); there are no paths, file
handles, or presigned URLs. Keys are built by `keys.ts` and must stay
byte-for-byte identical to Python's — a divergence silently reads
nothing and orphans what it writes. There is no filesystem backend.

The backend is built once at startup and **passed into `data.ts`
functions as an argument, the way `db` is**. `deletePrefix` never
throws; it returns failures, and callers must log them.

Client code must never reference the whole `import.meta.env` object.
Vite would serialize every `VT_`-prefixed variable — including
`VT_STORAGE_S3_SECRET_ACCESS_KEY` — into the browser bundle. Read named
keys instead; `src/app/__tests__/clientEnv.test.ts` enforces this.

Unit-test anything that stores files against `MemoryStorage`. The
backends themselves are tested against real Garage and Azurite
containers in the `storage` Vitest project.

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

`jobs` update frames are the one exception: a running job emits one per
progress wave and every job on screen holds its own `detail(id)` query,
so invalidating per frame cost a request per running job. They route
through `createJobRefreshQueue` (`jobs/refresh.ts`), which buffers ids
and reads them with the batched `getJobs` server function instead. Don't
add a `detail(id)` invalidation back for jobs.

See [docs/server-push.md](docs/server-push.md) for the wire format,
auth on the SSE side, the job-batching queue, and the follow-up TODOs.

## Projects

Ongoing projects are documented in `docs/projects/`. These correspond to Linear
projects. If your task relates to a project, check that directory for
constraints, mappings, or decisions that apply to your work.

- **Auth handoff** (login moves from Python to TanStack Start):
  `docs/projects/auth-handoff.md`

## Linear

- **Team**: Virtool
- **Team ID**: `76cf3c46-c5d9-4df4-b457-0fc053d402f7`
- **Issue prefix**: `VIR`
- **Default label**: Frontend

### Issue conventions

- Capitalize issue titles.
- Place issues in **Todo** by default; use **Backlog** only when explicitly
  asked. If an issue seems like it should be Backlog, say so and ask.
- Never assign issues to anyone.
- **Never change an issue's status.** Status is managed automatically from
  branch and PR activity. Move an issue by hand only when explicitly told to.
  The Todo-by-default rule above governs issues you create, not ones already
  in flight.
- Label bugs as **Bug** in addition to any other labels.

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
  the network.
- **Comments:** Default to none. Document *why* when non-obvious, not
  *what*.
- **Concurrency:** Independent awaits go in `Promise.all` — don't pay
  the sum of latencies.

See [docs/code-style.md](docs/code-style.md) for the full TypeScript,
naming, comments, and concurrency rules with examples.

## Configuration

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

## Logging

Server code logs through `@virtool/logger`, not `console.*`. Biome's
`noConsole` bans `console.*` across the whole repo; on the client, report
unexpected conditions to Sentry (`Sentry.captureException`) rather than the
user's console, which no one can read.

Import the `logger` singleton from `@server/logger` and call it directly:

```ts
logger.warn({ err }, "postgres health check failed");
```

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

## Git

Commit messages use **Conventional Commits**. Releases are automated with
semantic-release: only `feat` (minor) and `fix` (patch) trigger a release.
Anything user-visible must be one of those — never `refactor` or `chore`.

```
type(scope): description
```

### Types

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

### Titles

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

### Other rules

- Title: lowercase, no period, under 72 characters.
- Scope is optional. Allowed scope: `deps` (dependency changes). Do not scope
  by domain.
- Don't push or create PRs unless asked.
- Don't include a Test plan section in pull request descriptions or comments.
- Don't use `git -C <path>` unless necessary. It triggers permission prompts
  that aren't worth the trouble. Run git commands from the working directory
  instead.

### GitHub

- PR titles must follow Conventional Commits format so they can be cleanly
  squash-merged into a single well-formed commit.

## Testing

- **Framework:** Vitest; Vitest node env for packages.
- **Projects (web app):** `web` runs browser code under jsdom.
  `server` runs `src/server/**` under **node** — server code runs on
  Node in production, and under jsdom its typed arrays come from a
  different realm, so bytes compare unequal to identical bytes.
  `storage` runs the storage backends against real Garage and Azurite
  containers. `a11y` runs `*.a11y.test.tsx` under headless Chromium
  (Playwright) so axe's layout-dependent rules — `color-contrast` above
  all — can actually run; it needs `playwright install chromium`. `pnpm
  test` runs all four; use `--project <name>` to narrow.
- **Test location:** `__tests__/` directories alongside source files
  (web), or sibling `*.test.ts` files (packages).
- **Test files:** `ComponentName.test.tsx` or `functionName.test.ts`.
- **Imports:** Use explicit vitest imports (`import { describe, it,
  expect, vi } from "vitest"`).
- **Setup:** `apps/web/src/tests/setup.tsx` provides
  `renderWithProviders()`, `renderWithRouter()`, and `MemoryRouter`. It
  also calls `nock.disableNetConnect()` (an unmocked request fails
  instead of hitting the network) and gives the test `QueryClient`
  `retry: false` (a failed query surfaces its error immediately), so
  error paths are testable and under-mocked tests fail loudly.
- **Test doubles** split three ways by what they do, and a helper lives
  in exactly one of them:
  - `src/tests/fake/` — `createFake*` data generators. No mocking.
  - `src/tests/api/` — nock interceptors for Python REST endpoints,
    named `mockApi<Thing>`. Returns a nock scope; `scope.done()`
    asserts the request fired.
  - `src/tests/server-fn/` — `vi.fn()` stubs over the TanStack Start
    server functions, named `mock<ServerFnName>` after the function
    they stub. Returns the `vi.fn()` itself, so assert with
    `expect(getUser).toHaveBeenCalled()`.

  A domain moving from the Python API to a server function moves its
  helper from `api/` to `server-fn/`. Files under `server-fn/` mirror
  the mocked `@server/<feature>/functions` module, not the client
  feature — `getAccount` is stubbed from `server-fn/users.ts`.
- **Database tests:** `createTestDatabase()` from
  `@server/db/test/fixtures` gives a suite its own isolated Postgres
  database with the schema applied. Test files run in parallel, so
  never share one database between them.
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
layer split, where to mock depending on migration state, snapshot
guidance, the axe-core accessibility helper, and the shared-fixtures
rule.
