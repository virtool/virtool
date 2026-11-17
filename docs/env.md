# Environment configuration

Each Virtool service reads its configuration from the environment at startup. A
service that cannot parse its configuration exits with a non-zero status before
it serves. The error gives each invalid key and the reason, never the value.

## Variable names

Virtool-owned variables start with `VT_`, such as `VT_POSTGRES_URL` and
`VT_METRICS_TOKEN`. Names that dependencies and platforms define stay unchanged,
such as `SENTRY_AUTH_TOKEN` and `NODE_OPTIONS`.

Each configured key also accepts a `<KEY>_FILE` variable. Its value is the path
to a file that contains the configuration value. Use it to read secrets from a
mount, such as a Kubernetes secrets store:

```text
VT_POSTGRES_URL_FILE=/mnt/secrets-store/postgres-url
```

The [configuration guide](https://www.virtool.ca/docs/start/configuration#file-backed-variables)
gives the rules for these variables.

## Authentication

`VT_PUBLIC_ORIGIN` and `VT_AUTH_SECRET` have no safe default. The
[web configuration table](../apps/web/README.md#configuration) gives their
formats. Set them on the web server.

Virtool does not infer the origin from the request `Host` or forwarded headers.
A passkey is bound to the configured origin. When you move an instance to a new
domain, the passkeys registered under the old domain stop working. Users must
sign in with their password and register new passkeys.

Virtool rejects plain `http` except on `localhost`. A loopback IP address can
never register a passkey, so use `http://localhost` in development.

When you change `VT_AUTH_SECRET`, every Better Auth session stops working, and
Virtool cannot decrypt stored recovery codes. Plan each rotation.

Authentication cookies are `Secure` when `VT_PUBLIC_ORIGIN` uses `https`.

The web server does not start when `BETTER_AUTH_SECRETS` or
`BETTER_AUTH_TRUSTED_ORIGINS` is set. Better Auth would use these in place of,
or in addition to, `VT_AUTH_SECRET` and `VT_PUBLIC_ORIGIN`.

## Encryption key

`VT_ENCRYPTION_KEY` and `VT_ENCRYPTION_KEY_PREVIOUS` protect the secrets that
Virtool stores in Postgres. Set the same values on the web server and the task
runner.

See the [operator guide](https://www.virtool.ca/docs/start/configuration#encryption-key)
for the protected values, key generation, failure behavior, and rotation.
