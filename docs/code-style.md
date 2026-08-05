# Code style

The basics live in `AGENTS.md`. This doc covers the longer-form rules:
TypeScript conventions, naming, comments, and concurrency.

## TypeScript: prefer `type` over `interface`

Use `type` for all type definitions. Reserve `interface` only when
declaration merging is explicitly needed (e.g. extending third-party
module types).

Bad:

```ts
interface User {
  id: string
  name: string
}
```

Good:

```ts
type User = {
  id: string
  name: string
}
```

## TypeScript: prefer literal unions over enums

Use string literal unions instead of `enum`. Literals are plain values
at runtime, require no import at call sites, and serialize naturally.

Bad:

```ts
enum Status {
  Pending = 'pending',
  Running = 'running',
  Complete = 'complete',
}
```

Good:

```ts
type Status = 'pending' | 'running' | 'complete'
```

## TypeScript: document every exported type with a one-line JSDoc

Every exported `type` (or `interface`, when declaration merging
requires it) gets a `/** ... */` JSDoc comment, even when the name
seems self-explanatory. The payoff is that hovering the symbol in any
consumer shows what it represents without jumping to the definition.

```ts
/** Discriminated auth state: authenticated, awaiting forced reset, or anonymous. */
export type AuthContext = …

/** Read/write/clear access to the session cookie. Abstracts framework details. */
export type CookieAdapter = { … }
```

## Naming: name functions after what they return or do

- `is` prefix → type predicate or boolean, no side effects (`isAdmin`,
  `isEmpty`, `isExpired`)
- `has` prefix → boolean ownership check, no side effects (`hasRole`,
  `hasPermission`)
- `get` prefix → returns a value, no side effects (`getLifetime`,
  `getExpiry`)
- `check` / `validate` / `assert` → may throw, may have side effects,
  returns void or an error (`checkAuth`, `assertDefined`)

The line between `is` and `has` is loose in practice — don't
overthink it. The important line is between all of those and
`check`/`validate`/`assert`: if it can throw or has side effects, it
is not an `is` or `has`.

Prepositional names like `lifetimeFor` or `dataFor` are not in the
rule — prefer `getLifetime` / `getData`.

## Naming: a server function gets an `Fn` suffix; the domain function it wraps does not

A `createServerFn`-wrapped export is not a plain function call — every
call site crosses the network, goes through validation and auth
middleware, and returns whatever the RPC layer's plumbing returns
(`loginFn` isn't `login`'s return type, it's a callable RPC handle with
its own `.url`, for instance). That's a real behavioral difference from
the domain function underneath it, worth naming, not hiding:

- `server/auth/core.ts` exports the pure domain helpers (`login`,
  `logout`, `getAuthState`) — no suffix, since these never cross the
  RPC boundary.
- `server/auth/functions.ts` exports the TanStack Start server
  functions that wrap them, suffixed `Fn` (`loginFn`, `logoutFn`) —
  every call site, client or test, sees at a glance that the call is a
  server round-trip rather than a local one.
- React Query hooks in the feature's `queries.ts` wrap those server
  calls as `useLoginMutation`, `useAuth`, etc.

Because the wrapper and the domain function it wraps now have
different names, no import aliasing is needed for the common case. Only
alias an import (`as` at the import site) for an unrelated, incidental
name collision that isn't this domain-function/server-function pair.

Import these model constants by their exported names. Do not alias
them with `as` to avoid collisions; instead name other imports
clearly enough that the model can keep its `*Document` name.

## Comments: default to no comment; document the *why*, not the *what*

Well-named code does not need a narrator. A comment is worth writing
when removing it would make the next reader stop and wonder *why* —
a hidden constraint, a coupling to something off-screen, a deliberate
choice that looks wrong at first glance.

**Exported types and interfaces** are the exception: each one gets a
one-line JSDoc, even if the name is good.

**Functions** usually do not need a comment — the name and signature
carry the meaning. Add one when the *why* is non-obvious: a security
invariant, a quirk being preserved for compatibility, an edge case
the body handles silently.

```ts
// created_at is set once on insert and never mutated: the sliding-refresh
// lifetime is reconstructed as `expiresAt - createdAt`.
await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
```

**Constants** get a comment when the value choice or its coupling is
non-obvious. `COOKIE_NAME = 'session'` does not. `COST = 12` does,
because changing it invalidates pinned bcrypt fixtures elsewhere:

```ts
// Bcrypt cost factor. Matches the value passlib used on the Python side, which
// is required for the pinned $2b$12$ fixture in password.test.ts and
// session.test.ts to verify; raising this invalidates those fixtures.
const COST = 12
```

Lifetime constants deserve a line if there is an invariant tied to
them (e.g. a half-life refresh rule).

What not to write:

- Restating the code (`// increment i by 1`)
- The current task (`// added for the auth flow`, `// fix for issue #123`)
- The caller (`// used by LoginForm`) — those rot the moment something moves
- Multi-paragraph essays — if a comment grows past two or three lines,
  consider whether it belongs in a doc, a commit message, or a better
  function name instead
- **A history of the change** (`// previously this used X, now we do Y
  because...`, `// this used to be a class component`, `// no longer
  needed since we removed Z`). Git blame and the commit message already
  hold that history — a before/after comment just repeats it in a place
  that never gets pruned, and every subsequent change adds another
  layer, so the file accretes a stack of stale "this changed" notes
  that no one deletes. Write about the change only when the *old*
  behavior is a footgun someone could reintroduce — say so as a
  standing warning, not a narrative:

  ```ts
  // Do not fall back to `req.ip` here: it read the LB's address before
  // the trust-proxy fix and silently rate-limited the wrong client.
  const ip = getClientIp(req);
  ```

  That is a warning about a failure mode, phrased as a present-tense
  invariant — not "this used to use req.ip directly, but we changed it
  to getClientIp because...". If nothing would go wrong from reverting
  it accidentally, the history isn't worth a comment at all.

## Concurrency: run independent awaits in parallel

Awaits with no data dependency belong in `Promise.all`. Serial chains
pay the sum of all latencies instead of the slowest.

```ts
const [index, fasta, otus] = await Promise.all([
  client.indexes.get({ id }),
  client.indexes.fasta({ id }),
  client.indexes.otus({ id }),
]);
```

Skip when: a later call needs an earlier result; the calls share one
Postgres transaction (single connection, serialised server-side
regardless); or an early failure should short-circuit expensive later
work (e.g. bcrypt verify before hash).

Use `Promise.allSettled` when you need every result regardless of
failures.
