# Authentication

Authentication owns two subtrees — `packages/data/src/auth/` for the
primitives and `apps/web/src/server/auth/` for everything that touches
the framework — plus a global function middleware wired into
`apps/web/src/start.ts`. This doc covers the whole picture: the
code layout (a documented exception to the three-file
`data.ts`/`service.ts`/`functions.ts` layering used by other server
features), how requests are gated, the session model, and the
login / reset / logout flows.

## Code layout

The pure layer is split by primitive rather than collapsed into one
`data.ts`, and the split runs across the package boundary rather than
along it.

In `@virtool/data/auth/`, because they are bcrypt, `node:crypto`, and
plain Drizzle access on the `sessions` table:

- `session.ts` — session row CRUD
- `tokens.ts` — session id and token generation, hashing
- `password.ts` — bcrypt wrappers

In `apps/web/src/server/auth/`, because `cookies.ts` imports
`@tanstack/react-start` and the other two reach it:

- `core.ts` — login / logout / password-reset domain logic
- `cookies.ts` — `CookieAdapter` type (framework-agnostic cookie I/O)
- `verify.ts` — request verification, by session cookie pair or API key
  (pure, given a cookie adapter and db handle)

The minimum-length rule is in neither: it lives in
`@virtool/contracts`'s `passwordPolicy.ts`, because the browser's forms
need the same rule and the same message the server enforces, and the
browser cannot import `@virtool/data` (see "Minimum password length"
below).

The wired layer is split too:

- `service.ts` — `checkConfiguredPasswordLength`, which reads the
  setting and applies the pure rule to it
- `functions.ts` — TanStack Start server functions for login, logout,
  password reset
- `middleware.ts` — TanStack Start middleware that delegates to
  `verify.ts`

The shape is the same as labels — pure below, framework wiring above —
just finer-grained because the primitives are distinct (crypto vs.
persistence vs. cookies vs. verification). A future feature that needs
this level of separation should follow this pattern; one that doesn't
should look like labels.

## Authentication middleware

Authentication is enforced globally at the server-function boundary,
not per-handler. The exempt endpoints live in
`server/auth/exceptions.ts`:

```ts
export const authenticationExceptions: ReadonlyArray<{ url: string }> = [
  createFirstUserFn,
  getPasswordPolicyFn,
  getRootFn,
  loginFn,
  logoutFn,
  resetPasswordFn,
];
```

and are wired up in `apps/web/src/start.ts`:

```ts
const authenticationMiddleware = createAuthenticationMiddleware();

export const startInstance = createStart(() => ({
  serializationAdapters: [serverErrorSerializationAdapter],
  requestMiddleware: [
    sentryGlobalRequestMiddleware,
    metricsMiddleware,
    csrfMiddleware,
    documentHeadersMiddleware,
  ],
  functionMiddleware: [
    sentryGlobalFunctionMiddleware,
    errorLoggingMiddleware,
    authenticationMiddleware,
  ],
}));
```

`createAuthenticationMiddleware` takes no list in production — it
reaches `./exceptions` through a `createServerOnlyFn` dynamic import on
first call, so `start.ts`, which is part of the browser program, never
drags those functions' modules into the eager client bundle. The
parameter exists only so tests can supply their own list.

Every server function is gated by default. Public endpoints opt out by
being listed in the `exceptions` array — passed as **server-function
references**, not URL strings. The middleware derives the path from
each fn's bound `url`, so the exception list can't drift out of sync
with a rename.

The list is a standalone module rather than an inline array so it can
be asserted on: `middleware.test.ts` pins its exact contents, and a fn
added to it by mistake fails that test instead of silently becoming
publicly callable. Its type is annotated rather than inferred — an
inferred type would name TanStack's server-fn types transitively and
break declaration emit for `@server/*` importers.

The middleware lives in `server/auth/middleware.ts` and exposes these
helpers:

- **`createAuthenticationMiddleware(exceptions)`** — builds the global
  function middleware. Resolves the session for every non-exception
  call and attaches it to `context.session`.
- **`requireSession()`** — the server-only resolver that the middleware
  delegates to. Throws `UnauthorizedError` and sets a 401 response
  status on failure. Handlers do **not** call this; they read
  `context.session`, which their policy put there. Calling it in a
  handler buys a second Postgres lookup for a session that has already
  been resolved.
- **`requireAuthenticatedRequest(request)`** — for raw `Request`
  handlers in `createFileRoute` (e.g. SSE / streaming routes like
  `routes/events.ts`, and `POST /uploads`). These run outside the
  server-function async-local context, so the middleware can't reach
  them. Accepts a session cookie pair *or* an API key (see "API key
  authentication" below). Returns a 401 `Response` on failure for the
  caller to `return` directly.
- **`requireAdminRole(session, role)`** — throws `ForbiddenError` and
  sets a 403 when the session user does not hold at least `role`. Roles
  are ranked `full` (strongest) through `base` (weakest), so `"base"`
  means "any administrator".

Verification itself is pure: `verify.ts` exports `verifyRequest(db,
request)` and `verifyAuthenticatedSession(db, sessionId, sessionToken)`
with no framework imports. The middleware is the only place that ties
verification to the TanStack Start request context — keeping
verification reusable from any handler shape that can produce a
`Request` or a cookie pair.

### Why a global middleware and not per-fn guards

Per-fn `requireSession()` calls would be easy to forget on a new
server function, and forgetting is silent — the fn would just be
publicly callable. Default-on with an explicit opt-out flips the
failure mode: forgetting to list a fn in `exceptions` produces a 401
the moment you test it, not a security hole.

## API key authentication

A script has no browser and no session cookie. It authenticates with
an HTTP Basic header carrying a user handle and a raw API key:

```
Authorization: Basic base64(handle:key)
```

`verify.ts` exports the two pieces: `parseBasicAuthHeader(header)`,
which returns `null` for a non-Basic scheme, a missing `:`, or an empty
handle; and `verifyApiKey(db, handle, key)`, which resolves the caller
in one query — `users` joined to `api_keys`, matching the handle
case-insensitively (as login and Python's `get_by_handle` both do) and
the key by its SHA-256, which is all that is stored. Every failure
returns `null`: unknown handle, deactivated user, a key that belongs
to someone else. The caller answers one 401 without saying which check
failed.

A login starting with `job` is refused outright. Job keys use the same
header format against the separate jobs API, and Python refuses them
here rather than resolving `job-{id}` as a user handle.

`requireAuthenticatedRequest` picks the path off the request: an
`Authorization` header commits it to the key, cookies are read only
when there is no header. A malformed header is therefore a 401, not a
silent fall back to whatever cookies the client happened to attach —
Python's `authentication_middleware` branches the same way.

**Only raw routes accept a key.** Server functions stay cookie-only:
they are the app's own RPC transport, not a public API, and the
generated client always sends cookies. The raw routes — `POST
/uploads`, `/events`, `GET /analyses/documents/{id}.{extension}`,
`GET /subtractions/{id}/files/{filename}`,
`GET /indexes/{id}/files/{filename}` and
`GET /samples/{id}/reads/{filename}` — are what a script can actually
reach.

### The key's permissions are a cap

A session resolved from a key carries `keyPermissions`, and
`hasPermission` intersects it with the user's own permissions: a
permission has to be granted by *both* the user (through a group or an
administrator role) and the key.

The cap applies to administrators. Python's `PermissionRoutePolicy`
lets any administrator role through regardless of the key
(`client.administrator_role or client.permissions[...]`); we do not,
because the account UI tells the user the opposite. It offers an
administrator a checkbox per permission and promises the key "will
revert to your new limited set of permissions" if their role shrinks.
A key that ignored its own checkboxes would make that a lie.

## Authorization: every server function declares a policy

The authentication middleware answers *who is calling*, never *what they
may do*. That second question is answered by a policy, declared as
middleware on the function itself, from `server/auth/policy.ts`:

```ts
export const deleteGroupFn = createServerFn({ method: "POST" })
	.middleware([adminRole("base")])
	.validator(groupIdSchema)
	.handler(async ({ context, data }) => { ... });
```

There are four:

- **`open()`** — callable with no session. Reserved for the endpoints
  that *establish* one: login, first-user setup, logout, and the
  password policy the reset form reads before it has anywhere to
  authenticate to. A function declared `open()` must also appear in
  `authenticationExceptions`.
- **`authenticated()`** — any signed-in user. The deliberate choice for
  reads that carry no secret: the job list, the group list (ordinary
  users need it to set sample rights and pick a primary group), labels.
  Not a fallback for "I haven't decided yet".
- **`adminRole(role)`** — an administrator holding at least `role`.
  Roles rank `full` (strongest) through `base` (weakest), so
  `adminRole("base")` means "any administrator". The ranking is not a
  total order: the Postgres `administratorrole` enum has five values,
  and `virtool/users/data.py::check_administrator_role` scores them
  `base` = 1, then `users` / `settings` / `spaces` as level-2 **peers**,
  then `full` = 3. `spaces` is obsolete in product terms but remains a
  valid value because Python still writes it — treat it as a level-2
  peer, and note that dropping it from the enum needs a Python-side
  migration first.
- **`permission(name)`** — a user granted `name` through the union of
  their groups' permissions, or an administrator whose role covers it.
  Mirrors `checkAdminRoleOrPermissionsFromAccount` on the client; the
  two must agree, or the UI offers an action the server then refuses.

The policy resolves the session once and puts it on `context.session`,
typed non-nullable for every policy but `open()`. Handlers read it from
there.

A policy states the **floor**. A rule that depends on the row being
touched cannot be expressed at the door — an administrator editing
another administrator needs the `full` role, and that is only knowable
after the target user is read. Those checks stay in the handler, after
the read, with `requireAdminRole`. `updateUserFn` is the worked example.
`data.ts` remains a pure persistence layer that assumes its caller has
already been authorized — never put a role check there. It is in
`@virtool/data`, which has no notion of a session at all.

### What makes a policy non-optional

Nothing in the type system forces one.
`apps/web/src/server/__tests__/authorization.test.ts`
does: it calls **every** exported server function with no session and
fails on any that does not refuse. A function built without a policy has
no guard of its own, so an anonymous call reaches its handler instead of
being rejected, and CI names it. The same test pins
`authenticationExceptions` from both sides — an `open()` function left
out of the list is unreachable, and a listed function that isn't `open()`
is publicly callable — and fails if a new `functions.ts` appears that
nobody registered in it.

This exists because the failure mode here is silent. Endpoints migrated
from Python arrived without the role checks their Python counterparts
had, and because authentication *is* automatic, an unauthorized endpoint
looks exactly like an authorized one. Three group endpoints shipped as a
privilege-escalation path that way (VIR-2665).

### The factory that does not work

The obvious way to make a policy mandatory is to require it as an
argument, so the type checker rejects a server function without one:

```ts
// Does not work. Do not reintroduce this.
export function serverFn(policy: Policy, options) {
	return createServerFn(options).middleware([policyMiddleware(policy)]);
}
```

The Vite plugin matches `createServerFn` **syntactically at the
definition site**. Behind a factory it no longer recognises the call, so
the function is never split or registered: it gets no `url`, no RPC
endpoint, and its handler body — `db` import and all — is bundled into
the browser. It looks like it compiles. This was built, caught by a test,
and reverted; the middleware form above is what the framework supports.

## Session model

Sessions are rows in the Postgres `sessions` table
(`packages/data/src/db/schema/sessions.ts`). Each row carries a
`sessionType` discriminator: `"authenticated"` or `"reset"`. The client
identifies itself with two cookies set by `server/auth/cookies.ts`:

- **`session_id`** — opaque identifier of a session row. Set on
  successful login and on a successful reset. Present alone (no
  `session_token`) during a forced-reset flow.
- **`session_token`** — proves the `session_id` belongs to an
  authenticated session. Only set on the authenticated branch of
  login and after a successful reset. The server stores the bcrypt-ish
  hash via `hashToken` in `@virtool/data/auth/tokens`; only the client
  ever holds the unhashed value. Treat it as equivalent to the user's
  password for the token's validity.

There is **no anonymous `session_id`**. The new server functions only
set the cookie when a real session row exists (`core.ts:90`,
`core.ts:99`, `core.ts:198`). This is a deliberate departure from the
legacy Python behaviour described in older docs — don't reintroduce
anonymous sessions without an explicit reason.

A reset session is not "authenticated" as far as the middleware is
concerned — any non-exception server function call from a client
holding only a reset cookie returns 401.

## Session invalidation

`verifyAuthenticatedSession` (`server/auth/verify.ts`) rejects a session
when the row is missing, the type is not `authenticated`, the token hash
does not match, the row has expired, or **`users.active` is false**. That
last one is why deactivation takes effect immediately even for a session
that has slipped through revocation: `active` is re-read on every request
rather than trusted at login.

**An admin's change to a user's `active`, `password`, or `force_reset`
deletes that user's sessions outright.** `updateUser`
(`@virtool/data/users/data`) calls `invalidateUserSessions` inside the same
transaction as the change, so revocation is atomic with the change that
triggered it — there is no window where the old password still
authenticates. The self-service reset path does the same
(`invalidateUserSessions` in `core.ts` before minting the new session).

**A user changing their own password from the account page revokes every
session too, including the one that made the request.** `changePassword`
(`@virtool/data/users/data`) updates the row, calls `invalidateUserSessions`,
and mints a replacement in one transaction; `changePasswordFn` writes that
replacement to the response cookies. Skipping the cookie write would sign
the user out of the form they just submitted. The replacement is always
`remember: false`, matching `AccountData.update` in Python, so a password
change downgrades a 30-day session to the 60-minute one.

That update matches on the hash it verified, not just the user id. Nothing
holds a lock across the read, the bcrypt verify, and the bcrypt hash of the
new password, and at cost 12 that gap is hundreds of milliseconds — enough
for an administrator responding to a compromise to reset the password or set
`force_reset` in between. Without the guard the self-service change would
overwrite the newer credential, clear the flag, and mint the attacker a valid
session; with it, the loser of that race updates no rows and is reported as
bad credentials. Keep the condition if you touch this — the same reasoning is
why `consumeResetSession` exists in `core.ts`.

## Session lifetimes

Defined in `@virtool/data/auth/session`:

| Kind                          | Lifetime   |
| ----------------------------- | ---------- |
| Authenticated, `remember`     | 30 days    |
| Authenticated, no `remember`  | 60 minutes |
| Reset                         | 10 minutes |

These mirror the Python values in `virtool/sessions/data.py` so a row
written by either backend is indistinguishable. Don't drift them — the
comment in `session.ts` exists because both sides must mint
interchangeable rows.

### `sessions.created_at` is an invariant

Python's sliding refresh extends `expires_at` once more than half the
lifetime has elapsed, and reconstructs that lifetime from
`expires_at - created_at`. So `created_at` is set by `defaultNow()` on
insert and **never** by an `UPDATE`. A code path that touches it fails
silently rather than loudly: sessions start refreshing on every request,
or stop refreshing entirely.

Reset sessions are the exception — a 10-minute absolute lifetime, no
sliding refresh.

## Login

`loginFn` (`server/auth/functions.ts:40`) is the public server
function. It delegates to `core.login`, which:

1. Looks up the user by handle (case-insensitive). A missing or
   inactive user still pays the `verifyPassword` cost against
   `TIMING_DUMMY_HASH` so the missing-handle and wrong-password paths
   are indistinguishable to a timing observer (`core.ts:20`,
   `core.ts:75`).
2. Verifies the password with bcrypt.
3. Branches on the user's `forceReset` flag:
   - `forceReset = false` → mints an authenticated session, sets both
     cookies, returns `{ status: "authenticated" }`.
   - `forceReset = true` → mints a reset session, sets only
     `session_id`, returns `{ status: "reset_required", resetCode }`.

The `resetCode` is returned in the response body (not a cookie) so the
client can hold it in JS for the duration of the reset flow.

## First-user setup

A fresh instance has no users; the root document reports
`firstUser: true` and the `_authenticated` guard redirects to
`/setup`. `createFirstUserFn` (`server/auth/functions.ts`) is the
public server function that bootstraps the instance. It is unauthenticated
by necessity — it runs before any user or session exists — and delegates
to `core.createFirstUser`, which:

1. Rejects with `FirstUserExistsError` (→ 409) if any user already
   exists, so the endpoint can't be used to mint further accounts once
   setup is done.
2. Creates the user as a full administrator (`administrator_role =
   "full"`, `force_reset = false`).
3. Mints an authenticated session and sets both cookies — the first
   user is logged in without a separate login step.

The client mutation (`useCreateFirstUser` in `wall/queries.ts`) drops
the cached `root` and `account` documents on success so the guard
refetches them fresh instead of reusing the pre-setup snapshot (which
still says `first_user: true` and would bounce the user back to
`/setup`). It then navigates to `/`, which is an unguarded route that
redirects straight to `/samples`; the now-authenticated guard admits the
user there.

## Forced password reset

`resetPasswordFn` (`server/auth/functions.ts:78`) takes the new
password and the `resetCode` returned from the previous login.
`core.resetPassword`:

1. Resolves the session_id from the cookie and loads the row, requiring
   `sessionType = "reset"`.
2. Compares the supplied `resetCode` against the stored one with
   `timingSafeEqual` (`core.ts:121`). A mismatch invalidates the
   session and throws.
3. Rejects an expired session (`expiresAt` past).
4. Rejects a password that matches the user's current hash
   (`PasswordReuseError`).
5. Invalidates **all** of the user's existing sessions
   (`invalidateUserSessions`), updates the password / clears
   `forceReset` / sets `lastPasswordChange`, then mints a new
   authenticated session and rotates both cookies.

Step (5) must match the Python order in
`virtool.account.data.AccountData.reset` so a user mid-reset sees the
same behaviour regardless of which backend serves them
(`core.ts:175-200`).

On success the client navigates away from the wall. The reset has
already rotated the cookies, so the user is authenticated; leaving them
on the form would strand them there.

A reset session is invalidated by:

- Successful reset (cookies rotate to the new authenticated session).
- A `reset_code` mismatch on `resetPasswordFn`.
- 10-minute expiry.

## Minimum password length

The minimum is the `minimum_password_length` instance setting, read from
Postgres by `getSettings`. It is **not** a constant, and it is **not** a
zod rule.

`checkConfiguredPasswordLength(db, password)` (`server/auth/service.ts`)
is the single enforcement point. Every path that **sets** a password
calls it: `createFirstUserFn`, `resetPasswordFn`, `createUserFn`, and
`updateUserFn`. It reads the setting, applies the pure
`checkPasswordLength` from `@virtool/contracts`, and throws
`PasswordTooShortError`; each handler maps that to a 400 carrying the
error's message.

It is deliberately **not** applied at login. Login authenticates an
existing credential rather than setting a new one, and a user whose
stored password is shorter than the current minimum must still be able to
log in — the forced-reset flow that replaces it is only reachable through
login. For the same reason the account form's *old password* field
carries no length rule.

### Why not a zod validator

The obvious home is `.validator()`, and it is the wrong one. A validator
runs before its handler with no db handle, so it cannot read the setting.
It also fails badly: a zod rejection surfaces as a **500** whose message
is a JSON dump of the issue list, which is not something a form can put
in front of a user. The handlers throw a 400 with a real message instead,
matching every other domain error here.

### How the browser learns the minimum

`getPasswordPolicyFn` (`server/settings/functions.ts`) returns
`{ minimumPasswordLength }` and nothing else. It is **public** — listed
in `authenticationExceptions` — because the first-user and forced-reset
forms both set a password before any session exists. It returns the
minimum alone rather than the settings row, which holds instance
configuration no unauthenticated caller should read.

Client-side, `usePasswordRules()` (`forms/password.ts`) turns it into the
`react-hook-form` rules every password form spreads into `register`, so
the message quotes the configured value.

Until the policy resolves — and if it fails outright — the hook applies
**no length rule at all**. Do not be tempted to fall back to the default
of 8: the configured minimum can be *lower* than the default, so a guess
would reject passwords the server accepts and strand the user on a form
that will not submit. Omitting the rule defers to the server, which is
the only authority on the setting and rejects a short password with a 400
quoting it. That makes the server's message load-bearing, so every
password form must render its mutation error.

Every route that renders a password form prefetches the policy so this
window is not hit in practice: `/login`, `/setup`, the account profile,
and the two admin user routes. They use `prefetchQuery`, not
`ensureQueryData` — a failed settings read must not take down the wall or
the page.

## Logout

### Server side

`logoutFn` (`server/auth/functions.ts:68`) calls `core.logout`, which
deletes the session row keyed by the `session_id` cookie and clears
both cookies (`core.ts:104`). It's listed in the middleware's
`exceptions` array — calling it while already logged out is harmless.

### Client side

A logout is either user-initiated or forced. The user-initiated path is
`useLogout` in `account/queries.ts:157`, which runs `logoutFn()` and
then calls `resetClient()`.

A forced logout is what happens when the session stops verifying
underneath a running tab — its row deleted (including by an
admin-initiated deactivation, password change, or forced reset, all of
which now delete the user's session rows; see **Session invalidation**
below), it expired, or its user was deactivated. Every route into a
forced logout converges on `endSession` (`app/session.ts`),
which clears
`sessionStorage` and loads `/login?reason=session-ended&redirect=…`. The
full document load is what drops everything held in memory, and the
`reason` puts a "Your session ended" message on the wall. Two things
can call it:

- **`router.tsx`** — the query and mutation cache `onError`, matching
  `UnauthorizedError` by name. Server-function errors reach the client
  with no status (`setResponseStatus` is not attached to the thrown
  error), and TanStack Router's default `ShallowErrorPlugin` would strip
  the `name` too, flattening every error to its `message`. The name only
  survives because `serverErrorSerializationAdapter`
  (`app/serverErrors.ts`, registered in `start.ts`) re-serializes our own
  errors with their `name` intact — without it, matching by name silently
  never fires and a 401 is retried ~4× before the guard can act. The same
  adapter carries a `ClientError`'s `status`, which is what a route
  loader reads to turn a server function's 404 into `notFound()`.
- **`app/sse/SseConnection.ts`** — on a 401 from the `/events`
  handshake. The `EventSource` error event carries no status, so it
  confirms with a `HEAD /events` before ending anything.

`endSession` is inert until `armSessionEnd` runs, which
`routes/_authenticated.tsx` does once an authenticated load has
succeeded. This is load-bearing, not defensive: the login wall and the
authenticated route guard both fetch the account and *expect* a 401 when
nobody is logged in. Without the arming step a first-time visitor would
be told their session ended, and the wall could reload itself in a loop.

Auth state on initial load is still checked by
`routes/_authenticated.tsx`'s `beforeLoad`, which redirects to `/login`
if `accountQueryOptions()` (`@account/account`, backed by `getAccountFn`)
throws.

### `resetClient`

`resetClient` (`app/utils.ts:119`) does two things:

```ts
window.sessionStorage.clear();
window.location.reload();
```

The full-page reload wipes everything held in memory — React state,
React Query cache, zustand stores, the SSE connection.
Clearing `sessionStorage` drops persisted form state.

**`localStorage` is not cleared.** Anything persisted to `localStorage`
survives logout. If you add a `localStorage` key whose meaning depends
on the logged-in user (cached user data, per-user preferences keyed by
implicit identity), either clear it from `resetClient` or scope the
key by user id so the stale value can't be picked up by the next user
on the same browser.
