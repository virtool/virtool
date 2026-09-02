# Environment configuration

Virtool services own their configuration schemas, but follow one environment
loading convention. There is no shared configuration package: the shared piece
is `resolveFileBacked` from `@virtool/contracts/env`.

## Variable names

Virtool-owned variables start with `VT_`, such as `VT_POSTGRES_URL` and
`VT_METRICS_TOKEN`. Keep names defined by dependencies and platforms unchanged,
such as `SENTRY_AUTH_TOKEN` and `NODE_OPTIONS`.

Each configured key also accepts a `<KEY>_FILE` variable whose value is the path
to a file containing the configuration value. This lets Kubernetes workloads
read secrets directly from a secrets-store CSI mount:

```text
VT_POSTGRES_URL_FILE=/mnt/secrets-store/postgres-url
```

Plain variables remain useful for local development.

## Resolution rules

`resolveFileBacked(keys, env)` copies the supplied environment and resolves only
the keys listed by the caller:

1. If `<KEY>_FILE` is absent or blank, `<KEY>` is unchanged.
2. Otherwise, the referenced file is read as UTF-8 and trimmed.
3. The file value replaces `<KEY>`, even when the plain variable is also set.
4. An unreadable file throws during startup; there is no fallback to a possibly
   stale plain variable.
5. A file containing only whitespace resolves to an empty string, which the
   service's schema handles as unset or invalid.

The file deliberately wins when both forms exist. During a rollout, an
environment variable synchronized from a Kubernetes `Secret` may be stale while
the CSI-mounted file is current.

The resolver does not mutate the supplied environment object.

## Service integration

Resolve file-backed values before parsing the service's schema:

```ts
import { resolveFileBacked } from "@virtool/contracts/env";

export function parseConfig(env: NodeJS.ProcessEnv = process.env): Config {
	return ConfigSchema.parse(resolveFileBacked(CONFIG_KEYS, env));
}
```

The key collection must cover every configuration field. Derive it from the
schema where practical; if it must be explicit, update it whenever a key is
added. A missing entry makes the plain variable work while silently disabling
its `_FILE` variant.

Parse once at the process composition root and pass the resulting configuration
to downstream code. Avoid direct `process.env` reads elsewhere: they bypass
validation and `_FILE` resolution. This is especially important for early
instrumentation such as Sentry initialization.

Current integrations are:

- `apps/web/src/server/config.ts`
- `apps/internal/src/serve/config.ts`
- `apps/internal/src/run/config.ts`
- `apps/internal/src/migrate/main.ts`
- `packages/workflow/src/config.ts`

The resolver and its precedence tests live in `packages/contracts/src/env.ts`
and `packages/contracts/src/env.test.ts`.

## Encryption key

Secrets managed by Virtool are stored in Postgres in purpose-bound AES-256-GCM
envelopes. The Resend API key is the first consumer. The process-wide encryption
key is supplied through the environment:

| Variable | Value |
| --- | --- |
| `VT_ENCRYPTION_KEY` | 32 random bytes, standard base64 (44 characters). |
| `VT_ENCRYPTION_KEY_PREVIOUS` | The prior encryption key, set only during rotation. |

Both accept `_FILE` variants. Configure them identically for `apps/web` and the
`apps/internal` `run` subcommand. Generate a key with:

```sh
openssl rand -base64 32
```

An invalid or mismatched key makes encrypted secrets unavailable without
preventing either service from starting. Stored values are not changed on
decryption failure.

### Rotation

1. Set `VT_ENCRYPTION_KEY` to the new key and
   `VT_ENCRYPTION_KEY_PREVIOUS` to the old key, then roll out both services.
2. Do not remove the previous key until automated migration is available.
   Background migration is tracked in
   [VIR-3114](https://linear.app/virtool/issue/VIR-3114/handle-encryption-key-rotation-automatically).
3. Confirm email is available, then unset
   `VT_ENCRYPTION_KEY_PREVIOUS` and roll out again.

Keep the previous key configured until the migration succeeds.
