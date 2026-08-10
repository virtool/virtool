# Logging

## Use `@virtool/logger`, not `console`

Server code should log through the package, not `console.*`. It wraps pino
with sane defaults: JSON output, redaction of `password` / `token` /
`secret` / `authorization` / `cookie`, the session-credential field names
this codebase uses (`sessionToken` / `session_token` / `tokenHash` /
`resetCode`), and the `req.headers.*` / `headers.*` variants — each also
matched one level deep via `*.`. Level is resolved from `VT_LOG_LEVEL`
(falling back to `info` in production, `debug` elsewhere).

The web app constructs one logger at bootstrap with a service `name`
(`apps/web/src/server/logger.ts` exports it as `web`). Import that
singleton and call it directly:

```ts
import { logger } from "@server/logger";

logger.info({ userId }, "login");
```

The other server processes build theirs the same way but from their own
config, because their DSN has been through `<KEY>_FILE` resolution:
`apps/jobs-api/src/logger.ts` exports `createAppLogger(sentryDsn)` and
`index.ts` calls it once, and `apps/tasks` builds its logger inside
`bootstrap()` along with everything else that app owns. All three name
themselves after the service — `web`, `jobs-api`, `tasks` — matching the
Sentry `service` tag and the Postgres `application_name` segment.

Pass structured fields as the first arg, message as the second — never
interpolate values into the message string, that defeats the redaction
list and makes records ungreppable.

## The data layer takes a logger, it does not import one

`@virtool/data` cannot import that singleton — it is the web app's, and it
carries the Sentry forwarding stream configured from the web app's DSN.
The six data functions that log take a `Logger` argument instead, after
`db` and `storage`:

```ts
export async function checkPostgres(
	client: PgClient,
	logger: Logger,
): Promise<StoreCheck> { ... }
```

`apps/web/src/server/<feature>/functions.ts` passes `@server/logger` in
at the call site; a test passes the silent `testLogger` from
`@virtool/data/test/logger`, so a suite that deliberately drives a
warning path does not print the record it provoked.

`emit` is the one exception. It is called from more than two dozen plain
mutations that do not otherwise log, so its logger is bound once, by
`createEmitter({ client, logger })` at the composition root, rather than
threaded through each of them.

There is no request-scoped logger and no `context.logger`. `logger.child({...})`
exists — it is pino's — and is the right tool if you ever need to bind
repeated context (a request id, a job id) across several call sites, but
nothing in the server uses it today. Don't write code that assumes a
per-request logger is threaded through for you.

Biome's `noConsole` rule is enabled repo-wide in `biome.json`, so any
`console.*` fails `pnpm check`. Server code logs through the package;
client code reports unexpected conditions to Sentry
(`Sentry.captureException`) instead of a console the user's browser hides
from us.

The default redaction paths are defined in
`packages/logger/src/config.ts` (`DEFAULT_REDACT_PATHS`). Extra paths can
be merged in via the `redact` option to `createLogger` when a feature
needs to censor additional fields.

## Sentry forwarding

When a Sentry DSN is configured, a server logger fans `info`-and-above
records out to Sentry's structured logging API (`Sentry.logger`) in
addition to stdout. `debug` and `trace` stay stdout-only. The threshold
is the `level` of the Sentry stream where the logger is built. There is
no per-call-site wiring: every record at or above that threshold is
forwarded automatically.

**All three server processes do this**, off one shared stream —
`createSentryLogStream` from `@virtool/sentry/log`. Before it was lifted
into the package it lived in `apps/web` and imported
`@sentry/tanstackstart-react`, which is why `apps/jobs-api` and
`apps/tasks` had no forwarding at all and even a deliberate
`logger.error` in those services went to stdout alone.

The stream **takes the SDK's `logger` as an argument** rather than
importing one. Each process initialises a different SDK —
`@sentry/tanstackstart-react` in `apps/web`, `@sentry/node` in the other
two — and only the one a process actually called `init` on will send
anything, so importing a fixed SDK here would either forward through an
uninitialised client or drag a second SDK into every bundle.

This is a plain pino destination stream, **not**
`Sentry.pinoIntegration()`. The integration patches the `pino` module at
load time via `import-in-the-middle`, but the production server is bundled
(Nitro inlines pino into the server chunks, tsdown inlines it into the
other apps'), so there is no module boundary left to patch. A destination
stream needs no patching — pino hands it each serialised record directly.

Wiring, per process:

- **`apps/web`** — `src/instrument.server.ts` calls `Sentry.init` (with
  `enableLogs: true`, from `@virtool/sentry`'s `getCommonOptions`), imported
  for its side effect at the top of `src/server.ts`. `src/server/logger.ts`
  adds the stream only when `readDsn()` returns one, via `@virtool/logger`'s
  `streams` option, and pulls in `@sentry/tanstackstart-react` with a dynamic
  `import` so the SDK is never loaded without a DSN.
- **`apps/jobs-api`** — `src/index.ts` calls `createAppLogger(config.sentryDsn)`
  and then `initSentry(config.sentryDsn, logger)`. The DSN comes from
  `config.ts`, which has already resolved the `<KEY>_FILE` variant that
  `readDsn` would skip. The logger is built first because everything below it
  logs; the two lines `initSentry` itself writes are therefore stdout-only.
- **`apps/tasks`** — `bootstrap()` initialises Sentry first, then builds the
  logger with the stream attached when `sentry.enabled`. Nothing in that app
  is constructed at import time, so there is no logger to reconfigure later.

The `@sentry/node` apps do not need the dynamic import the web app uses:
they are started with `node --import @sentry/node/preload` and the SDK is
in the graph regardless. Attaching no stream without a DSN still matters —
records would otherwise be serialised and handed to a client that drops
them.

Redaction still applies. pino runs `DEFAULT_REDACT_PATHS` redaction before
writing to any destination, so the records the Sentry stream receives
already have `password` / `token` / `secret` / `authorization` / `cookie`,
the session-credential fields (`sessionToken` / `session_token` /
`tokenHash` / `resetCode`), and the `req.headers.*` / `headers.*` variants
replaced with `[redacted]`. `packages/sentry/src/log.test.ts` pins that by
driving a real `createLogger` through the stream.

Dev does not forward. The Tilt dev container runs with no DSN, so every
logger stays stdout-only and the web app's Sentry SDK is never loaded.
