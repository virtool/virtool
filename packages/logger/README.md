# `@virtool/logger`

A thin wrapper over [pino](https://getpino.io), shared by `apps/web` and
`apps/internal`. Server code logs through this, never
`console.*`. Biome's `noConsole` rule fails `pnpm check` on any that do.

```ts
import { createLogger } from "@virtool/logger";

const logger = createLogger({ name: "web" });
logger.info({ userId }, "login");
```

Pass structured fields as the first argument and the message as the
second. Never interpolate values into the message string. That defeats
redaction and makes records ungreppable.

Each process builds **one** logger at its composition root and passes it
down; there is no request-scoped logger anywhere in the server, and
`logger.child({...})` (pino's own) exists but sits unused today.
`@virtool/data`'s functions that log take a `Logger` argument rather than
importing one, because the singleton and its Sentry forwarding stream
belongs to whichever app built it. See `packages/data/src/test/logger.ts`
for the silent logger tests pass in its place.

## Level

`resolveLevel` reads `VT_LOG_LEVEL`, falling back to `info` in
`NODE_ENV=production` and `debug` otherwise. See `src/config.ts`.

## Redaction

`DEFAULT_REDACT_PATHS` (`src/config.ts`) censors the obvious secret
fields, this codebase's session-credential and stored-credential field names
(`ncbiApiKey` among them), and the `req.headers.*` / `headers.*` variants,
matched one level deep as well as at the top. Pass `redact` to `createLogger`
to merge in more paths for a feature that needs to censor something else.
Redaction runs before any destination sees the record, including the Sentry
stream below.

## Sentry forwarding

`createLogger`'s `streams` option fans each record out to the additional
destinations whose configured level it meets. `createSentryLogStream`
(`@virtool/sentry/log`) is the destination every service uses to forward
`info`, `warn`, `error`, and `fatal` records to Sentry's structured logging API
alongside stdout. See that module's doc comment for why it's a plain destination
stream rather than `Sentry.pinoIntegration()`. Each process wires it up
at its own composition root, only when a DSN is configured:
`apps/web/src/server/logger.ts`, `apps/internal/src/serve/logger.ts`, and
`apps/internal/src/run/bootstrap.ts`.
