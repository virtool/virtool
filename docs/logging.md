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

When `VT_SENTRY_DSN` is set, the server logger fans `info`-and-above
records out to Sentry's structured logging API (`Sentry.logger`) in
addition to stdout. `debug` and `trace` stay stdout-only. The threshold
is the `level` of the Sentry stream in `apps/web/src/server/logger.ts`.
There is no per-call-site wiring: every record at or above that
threshold is forwarded automatically.

This is a plain pino destination stream
(`apps/web/src/server/sentryLog.ts`), **not**
`Sentry.pinoIntegration()`. The integration patches the `pino` module at
load time via `import-in-the-middle`, but the production server is bundled
(Nitro inlines pino into the server chunks), so there is no module
boundary left to patch. A destination stream needs no patching — pino
hands it each serialised record directly.

Wiring:

- `apps/web/src/instrument.server.ts` calls `Sentry.init` (with
  `enableLogs: true`, from `@virtool/sentry`'s `getCommonOptions`). It is
  imported for its side effect at the top of `apps/web/src/server.ts`.
- `apps/web/src/server/logger.ts` adds the Sentry stream to the logger
  only when a DSN is present, via `@virtool/logger`'s `streams` option.
  The `@sentry/*` SDK is loaded lazily (dynamic `import`) so it is never
  pulled in when no DSN is configured.

Redaction still applies. pino runs `DEFAULT_REDACT_PATHS` redaction before
writing to any destination, so the records the Sentry stream receives
already have `password` / `token` / `secret` / `authorization` / `cookie`,
the session-credential fields (`sessionToken` / `session_token` /
`tokenHash` / `resetCode`), and the `req.headers.*` / `headers.*` variants
replaced with `[redacted]`.

Dev does not forward. The Tilt dev container runs Vite with no DSN, so the
logger stays stdout-only and the Sentry SDK is never loaded.
