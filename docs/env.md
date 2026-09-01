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

## Email master key

Transactional email keeps its Resend API key in Postgres, encrypted in a
versioned AES-256-GCM envelope. The key that envelope is encrypted under — the
master key — is the one email secret the environment owns:

| Variable | Value |
| --- | --- |
| `VT_EMAIL_MASTER_KEY` | 32 random bytes, standard base64 (44 characters). |
| `VT_EMAIL_MASTER_KEY_PREVIOUS` | The prior master key, set only during rotation. |

Both accept the `_FILE` variant like every other key, and both must be set for
`apps/web` and the `apps/internal` `run` subcommand: the web app encrypts and
test-sends, the runner decrypts and delivers. Generate a key with:

```sh
openssl rand -base64 32
```

Each key is identified by a non-secret fingerprint derived from its material,
recorded on the stored envelope. Startup never fails on a bad master key.
The states are:

- No master key and no stored Resend key: email is `unconfigured`.
- Stored Resend key but a missing or invalid master key, or one that cannot
  decrypt the envelope: email is `configuration_error`. The service runs, the
  delivery task refuses to send, and the stored envelope is left untouched —
  it is never cleared or overwritten on a decryption failure.
- Decryptable key and sender address: `disabled` or `ready`, per the enabled
  flag.

### Rotation

1. Generate the new key. Set `VT_EMAIL_MASTER_KEY` to it and
   `VT_EMAIL_MASTER_KEY_PREVIOUS` to the old key, then roll out both services.
   Envelopes decrypt by fingerprint, so the stored key still reads under the
   previous key while new writes use the active one.
2. Run the re-encrypt operation (a full administrator's server function,
   `reencryptEmailApiKeyFn`). It decrypts the stored envelope with whichever
   configured key matches its fingerprint and rewrites it under the active
   key. It is idempotent: a repeat run reports `already_current`.
3. Confirm the settings read shows email available, then unset
   `VT_EMAIL_MASTER_KEY_PREVIOUS` and roll out again.

Decryption never guesses: a fingerprint that matches no configured key, or an
authentication failure under the matching key, makes email unavailable rather
than trying other keys. Keep the previous key configured until re-encryption
has succeeded.
