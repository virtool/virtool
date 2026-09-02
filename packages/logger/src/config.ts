/** Env var read by `resolveLevel` to override the default log level. */
export const LOG_LEVEL_ENV = "VT_LOG_LEVEL";

/** Pino-compatible log level names. */
export type LogLevel =
	| "fatal"
	| "error"
	| "warn"
	| "info"
	| "debug"
	| "trace"
	| "silent";

const VALID_LEVELS: ReadonlySet<string> = new Set([
	"fatal",
	"error",
	"warn",
	"info",
	"debug",
	"trace",
	"silent",
]);

type Env = Record<string, string | undefined>;

export function resolveLevel(env: Env): LogLevel {
	const explicit = env[LOG_LEVEL_ENV];
	if (explicit && VALID_LEVELS.has(explicit)) {
		return explicit as LogLevel;
	}
	return env.NODE_ENV === "production" ? "info" : "debug";
}

/**
 * Keys redacted from log records by default. Covers the obvious secret-bearing
 * fields, the session-credential field names this codebase actually uses
 * (`sessionToken` / `session_token` / `tokenHash` / `resetCode` / `ncbiApiKey`),
 * the Better Auth material that is equivalent to a credential — TOTP secrets
 * ride on `secret`, while recovery codes, WebAuthn challenges and passkey
 * public keys need names of their own — and common
 * HTTP shapes (`req.headers.authorization`, `headers.cookie`) so that incidental
 * request logging does not leak credentials. Redaction runs before any
 * destination — including the Sentry forwarding stream — sees the record.
 */
export const DEFAULT_REDACT_PATHS: readonly string[] = [
	"password",
	"token",
	"secret",
	"authorization",
	"cookie",
	"sessionToken",
	"session_token",
	"tokenHash",
	"resetCode",
	"ncbiApiKey",
	"backupCodes",
	"backup_codes",
	"recoveryCodes",
	"challenge",
	"publicKey",
	"public_key",
	"*.password",
	"*.token",
	"*.secret",
	"*.authorization",
	"*.cookie",
	"*.sessionToken",
	"*.session_token",
	"*.tokenHash",
	"*.resetCode",
	"*.ncbiApiKey",
	"*.backupCodes",
	"*.backup_codes",
	"*.recoveryCodes",
	"*.challenge",
	"*.publicKey",
	"*.public_key",
	"req.headers.authorization",
	"req.headers.cookie",
	"headers.authorization",
	"headers.cookie",
];
