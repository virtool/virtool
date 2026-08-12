# Architecture



### Types are inferred from the schema, not hand-copied

Older feature modules kept manually maintained types in their `types.ts`,
matching the Python Pydantic models by convention. Where a feature's
backend lives in `@virtool/data`'s `<feature>/data.ts`, prefer Drizzle
inference (`InferSelectModel`, `InferInsertModel`) over re-declaring the
row shape, and re-export the inferred types from `data.ts` so
`functions.ts`, hooks, and components share one definition. This is per-feature work — don't
bulk-convert the `types.ts` files that remain.

## Server modules

A server feature follows a three-file layering convention. Use the exact
filenames `data.ts`, `service.ts`, and `functions.ts` — don't rename them
per feature. They're how the layering is recognised at a glance and how
the import-direction invariant stays enforceable.

The three do not all live in the same place. `data.ts` lives in
`packages/data/src/<feature>/`, published as `@virtool/data`, because it
carries no framework surface and the jobs API and the TypeScript workflow
ports consume it. `service.ts` and `functions.ts` live in
`apps/web/src/server/<feature>/`.

- `data.ts` — pure domain layer plus persistence and external IO
  (drizzle / postgres, blob storage, outbound HTTP to upstream
  services). No framework imports. Exports domain types, typed errors
  that extend `AppError` (`@virtool/data/errors`), and the functions that
  read or mutate persistent state or call external systems. Every
  resource it needs — the db handle, the storage backend, the logger —
  comes in as an explicit argument, in that order, never as a
  module-scope singleton. The one exception is `emit`, which reads a
  handle installed once by `createEmitter` at a composition root rather
  than threading a client and a logger through two dozen plain mutations
  that do not otherwise log.
- `service.ts` — orchestration across multiple `data` modules, or
  cross-resource logic that doesn't fit cleanly in any one feature's
  `data.ts`. **Skip this file when the data layer covers the feature on
  its own.** Don't add `service.ts` just to have a place to put
  something — only when its absence forces ugly coupling.
- `functions.ts` — TanStack Start server function shell. Wraps
  `createServerFn` / `createServerOnlyFn`, validates input with zod,
  delegates to `data` / `service`, and maps `AppError` subclasses to
  HTTP responses — `setResponseStatus(4xx)` paired with a `ClientError`
  (`@server/errors`) carrying the message the client renders. Throw
  `ClientError`, never a plain `Error`, for a deliberate 4xx: the Sentry
  `beforeSend` filter (`dropExpectedClientErrors`) drops it — along with
  the auth middleware's 401/403 `UnauthorizedError` / `ForbiddenError` —
  as routine control flow, so a plain `Error` surfaces as a false
  incident. Reserve a bare `throw`/`throw err` for the genuinely
  unexpected, which _should_ reach Sentry. Should contain no business
  logic — if a handler grows a multi-step orchestration with rollbacks
  or branching, that is the signal to extract a `service.ts`.

  The same filter drops one thing no handler throws: the `Error:
  aborted` Node's `abortIncoming` raises when a client's socket closes
  with a request still in flight. Its stack is pure Node internals —
  no application frame, because no application code ran — and it is
  unactionable by construction, the peer having gone. The web app draws
  a steady stream of them because the SSE client probes `HEAD /events`
  from its `onerror` handler, which is exactly when a deploy is tearing
  the connection down, so every connected tab contributes one. The
  match is `code === "ECONNRESET"` **paired with** the literal message
  `aborted`. Never widen it to the code alone: `ECONNRESET` also
  arrives from connections this side opens — Postgres, object storage,
  GenBank — where it is a real incident.

  The status a handler sets is always a 4xx or a 2xx that carries a
  body. **A null-body status — 204, 205, or 304 — is not available
  here.** Start's server-function handler serializes the `{ result,
  error }` wrapper into a body unconditionally, and the fetch spec
  forbids a body on those three, so `new Response(body, { status: 204
  })` throws — *after* the handler has done its work. The handler's own
  catch then rebuilds the error response with the status still set and
  throws a second time, with nothing left to catch it, so the caller
  sees a failed request for an operation that succeeded. A deletion
  returns `null` and answers 200; the RPC client deserializes the body
  and never reads the code, so nothing observes the difference.
  `server/__tests__/responseStatus.test.ts` scans every `functions.ts`
  and fails the build on all three statuses. A raw route is unaffected —
  it builds its own `Response`, and `new Response(null, { status: 204 })`
  is fine.

### The underlying principle: keep policy logic pure

The three-file layering is the structural form of a broader rule:
keep decision logic separable from framework wiring. When a module
mixes validation, auth checks, business rules, or data shaping with
framework plumbing (React Query mutations, route loaders, server
handlers, DB clients, env access), the decision logic becomes hard
to test and hard to reuse. Split along the same line every time:

- A pure module exporting the decision helpers — no framework
  imports, no DB handle, no env access. Plain functions over plain
  data.
- A wired module that constructs the framework's hook / loader /
  handler and delegates to the pure helpers.

Tests target the pure module. The wired module gets exercised
through integration tests when needed, but its branching is trivial
because the real logic lives next door.

**Diagnostic that tells you the split is overdue**: a unit test
fails to *import* because a transitive dependency pulled in env
config, a DB client, or another framework concern the test does not
need. The fix is to split the module along that import-graph fault
line, not to mock the env or stub the DB. Ask "what does this file
import that the test should not have to care about?" — that is the
cut.

### Import direction

Imports flow `functions → service → data` and never the reverse.

- `data.ts` may import from its package's `db/`, `errors.ts`, `events/`,
  and other feature `data.ts` modules — but never from `service.ts`,
  `functions.ts`, or anything in `apps/web`. It is in a package that does
  not depend on the app, so the last of those is a resolution error
  rather than a convention.
- `service.ts` may import from any feature's `data.ts` — but never from
  `functions.ts`.
- `functions.ts` is the only layer that imports framework code
  (`@tanstack/react-start`, `@tanstack/react-start/server`).

A violation of the import direction shows up as the same diagnostic
described above: a unit test fails to *import* because a transitive
dependency dragged in TanStack Start or env config. If you see it,
the import direction has been violated.

### The client boundary: shared shapes go in `@virtool/contracts`

`apps/web` type-checks as two projects: `tsconfig.server.json` (Node
types, no DOM lib) for `src/server`, and `tsconfig.app.json` (DOM lib,
no Node types) for the browser. Browser code reaches the server through
the `@server/*` alias, which resolves to the server project's emitted
declarations — a one-way arrow, client → `@server/*`.

The server must not reach back the other way. A `src/server` file that
imports a browser feature module pulls a DOM-typed source graph into the
Node project; the moment anyone adds something DOM-dependent to that
module the server program breaks, at a distance, for reasons that won't
be obvious to whoever did it. And an authorization decision living in a
module the browser owns is exactly the kind of thing that gets
"simplified" by someone with no idea the server depends on it. A Biome
`noRestrictedImports` override scoped to `apps/web/src/server/**` blocks
the boundary from being re-crossed.

It lists **every** feature alias, plus the `@/*` catch-all that would
otherwise reach the same modules under another name. It used to
enumerate four — `@administration/*`, `@app/*`, `@banner/*`, `@users/*` —
and was already leaking by the time anyone noticed: `labels/data.ts`
imported `DEFAULT_LABEL_COLOR` from `@labels/constants`, which was not on
the list. An enumerated list that grows only when someone spots a
violation is a list that is always one violation behind. Add the alias in
the same commit as the feature directory.

`packages/**` needs no such rule. It has no `@<feature>/*` path mapping
at all, so a browser feature module is not resolvable from `@virtool/data`
or `@virtool/storage` in the first place — which is what forced
`DEFAULT_LABEL_COLOR` and the password policy down into
`@virtool/contracts` when `labels/data.ts` and `settings/data.ts` moved
into the package.

Anything both sides genuinely share — the administrator-role model and
`hasSufficientAdminRole`, the legacy `Permission` union, the banner
color list, the SSE domain/message schemas — lives *down* in the
framework-agnostic `@virtool/contracts` package, which neither side's
type project can break. Both sides import them from the package
directly — a feature module that re-exports its piece becomes a
middleman on a shape it does not own, and the real definition site stops
being greppable.

A domain's **wire shapes** are shared in exactly this sense, and belong
in the package for the same reason. What a server function returns is
written by `data.ts` and rendered by components, so neither owns it:
`@virtool/contracts` does. `references.ts` there defines `Reference`,
`ReferenceMinimal`, the rights and membership shapes, and the
`ReferenceSearchResult` page; `server/references/data.ts` imports them
to annotate its returns, and components import the same names straight
from `@virtool/contracts`. Don't add a feature `types.ts` re-export for
these — unlike `@server/*` below, importing `@virtool/contracts`
directly crosses no project boundary, so the re-export bought nothing
but a second place a type must be kept listed. `samples/types.ts` holds
only genuinely client-only shapes (`CreateSampleRequest`,
`SampleUpdate`, and friends). `references/` and `indexes/` have no
`types.ts` at all any more: once both domains moved onto server
functions, every shape they declared turned out to be a wire shape and
moved into the package.

The failure mode to avoid is a client `types.ts` that does
`import type { Reference } from "@virtool/data/references/data"`. A Biome
`noRestrictedImports` override outside `apps/web/src/server/**` now
rejects it outright, but the reason it is worth rejecting is that it
makes the browser's view of a shape depend on a *data-layer* module, so a
`data.ts` refactor becomes a client type break. That problem disappears
when the type has a home neither side reaches through the other —
`@virtool/contracts`, imported directly. `ApiKey` was the last one, and
moved into the package for exactly this reason.

Two shapes generalised out of that move and now live in the package
alongside the reference contracts: `UserNested` (`{ id, handle }`, the
user reduced to what is shown beside another resource) and `Task` (the
background-task progress record embedded in resources a task acts on),
plus `SearchResult`, the camelCase pagination envelope every
server-function-backed list returns. Every domain is on it: the
snake_case envelope the Python API returned is gone, along with the
`apps/web/src/types/api.ts` that declared it and the per-domain copies
that restated it on both sides of the boundary.

What stays in `data.ts` is what only `data.ts` uses: the `*Values` and
`*Options` argument types its functions accept, its `AppError`
subclasses, and its row-to-shape mappers. A type the client never sees
does not belong in a shared package.

There are no sanctioned sideways imports left. `DEFAULT_LABEL_COLOR` used
to be one — `labels/data.ts` read it from `@labels/constants` — and it
moved into `@virtool/contracts` when the data layer moved into its own
package, which cannot reach the app's feature tree at all. The password
policy went the same way, for the same reason.

### The auth carve-out

`auth/` is the documented exception to the three-file layout. Its
pure layer is split by primitive, and the split runs across the package
boundary rather than along it: `password.ts`, `tokens.ts`, and
`session.ts` are in `@virtool/data/auth/` because they are bcrypt, crypto,
and plain Drizzle access on the `sessions` table; `core.ts`, `cookies.ts`,
and `verify.ts` stay in `apps/web/src/server/auth/` because `cookies.ts`
imports `@tanstack/react-start` and the other two reach it. Its wired
layer adds a `middleware.ts` and a `policy.ts` alongside `functions.ts`.
The split is finer-grained because the primitives are distinct (crypto
vs. persistence vs. cookies vs. verification), but the principle is the
same as labels: pure below, framework wiring above.

Treat auth as a one-off shape, not a template. New features start with
the standard three-file layout and only split further if the primitives
genuinely don't fit in one `data.ts`.
