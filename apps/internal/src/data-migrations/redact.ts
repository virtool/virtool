/**
 * Strip credential material out of a message before it is written to the
 * `data_migrations` row or to a log.
 *
 * An operation's error reaches an operator through a table anyone with
 * database access can read and through logs that leave the cluster. The two
 * shapes that actually carry secrets there are a connection URL with its
 * password in it — postgres.js puts one in several of its errors — and a
 * `key=value` pair naming something secret, which is how a driver reports a
 * rejected option.
 *
 * Deliberately narrow. A rule broad enough to catch every possible secret also
 * catches the table names, row identifiers and column values that make an
 * error worth reading, and an error nobody can act on is its own kind of
 * failure.
 */

/** What replaces a redacted value. */
const MASK = "[redacted]";

/** `scheme://user:secret@host` — the password, and nothing either side of it. */
const URL_CREDENTIALS = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@]*(@)/gi;

/** `password=secret`, `"api_key": "secret"`, `token = secret`. */
const SECRET_ASSIGNMENT =
	/(\b(?:password|passwd|secret|token|api[_-]?key|authorization|credentials?)\b["']?)(\s*[=:]\s*)(?:bearer\s+|basic\s+)?(?:"[^"]*"|'[^']*'|\S+)/gi;

/**
 * `Authorization: Bearer secret`, and the same header written without its
 * colon, as several HTTP clients render it in an error.
 */
const AUTHORIZATION_HEADER =
	/(\bauthorization\b["']?\s*:?\s*)(?:bearer|basic)\s+\S+/gi;

/** Redact credential material in `message`. */
export function redactSecrets(message: string): string {
	return message
		.replace(URL_CREDENTIALS, `$1${MASK}$2`)
		.replace(AUTHORIZATION_HEADER, `$1${MASK}`)
		.replace(SECRET_ASSIGNMENT, `$1$2${MASK}`);
}

/**
 * The redacted, single-line message of an unknown thrown value.
 *
 * The message only — a stack names paths and line numbers that say nothing an
 * operator reading a status table can use, and the full error still reaches the
 * log through the logger's own serializer.
 */
export function describeError(err: unknown): string {
	const message =
		err instanceof Error ? err.message : `non-error thrown: ${String(err)}`;

	return redactSecrets(message.replace(/\s+/g, " ").trim());
}
