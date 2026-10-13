import { DrizzleQueryError } from "drizzle-orm";
import type { PostgresError } from "postgres";

const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";

function findViolation(
	error: unknown,
	code: string,
): Partial<PostgresError> | null {
	if (error === null || typeof error !== "object") {
		return null;
	}
	if ((error as Partial<PostgresError>).code === code) {
		return error as Partial<PostgresError>;
	}
	const cause = (error as { cause?: unknown }).cause;
	if (
		cause !== null &&
		typeof cause === "object" &&
		(cause as Partial<PostgresError>).code === code
	) {
		return cause as Partial<PostgresError>;
	}
	return null;
}

function isViolation(
	error: unknown,
	code: string,
	constraints?: readonly string[],
): boolean {
	const violation = findViolation(error, code);
	if (!violation) {
		return false;
	}
	return (
		!constraints ||
		(violation.constraint_name !== undefined &&
			constraints.includes(violation.constraint_name))
	);
}

/**
 * Report whether an error, or its cause, is a Postgres unique violation. When
 * `constraints` is given, the violated constraint must be one of them.
 */
export function isUniqueViolation(
	error: unknown,
	constraints?: readonly string[],
): boolean {
	return isViolation(error, UNIQUE_VIOLATION, constraints);
}

/**
 * Report whether an error, or its cause, is a Postgres foreign-key violation.
 * When `constraints` is given, the violated constraint must be one of them.
 */
export function isForeignKeyViolation(
	error: unknown,
	constraints?: readonly string[],
): boolean {
	return isViolation(error, FOREIGN_KEY_VIOLATION, constraints);
}

/**
 * SQLSTATEs a server raises while it is going away or not yet back: an
 * administrator or crash shutdown, a server still starting, and the whole
 * `08` connection-exception class.
 */
const UNAVAILABLE_SQLSTATES = new Set(["57P01", "57P02", "57P03"]);

/**
 * postgres.js's own codes for a connection that never opened or was cut from
 * the far side. `CONNECTION_DESTROYED` and `CONNECTION_ENDED` are left out
 * because this process raises them itself when it closes its pool.
 */
const POSTGRES_CONNECTION_CODES = new Set([
	"CONNECT_TIMEOUT",
	"CONNECTION_CLOSED",
]);

/**
 * Node socket codes for the same failures.
 *
 * Every outbound client raises these, so they count only when Drizzle reports
 * them as a query's cause; object storage or NCBI failing the same way is a
 * different incident. `ENOTFOUND` is left out because a host that never
 * resolves is a configuration fault that must stay visible.
 */
const SOCKET_CODES = new Set([
	"ECONNREFUSED",
	"ECONNRESET",
	"EHOSTUNREACH",
	"ENETUNREACH",
	"ETIMEDOUT",
	"EAI_AGAIN",
]);

function getCode(error: unknown): unknown {
	return error !== null && typeof error === "object"
		? (error as { code?: unknown }).code
		: undefined;
}

function isPostgresUnavailableCode(code: unknown): boolean {
	return (
		typeof code === "string" &&
		(UNAVAILABLE_SQLSTATES.has(code) ||
			code.startsWith("08") ||
			POSTGRES_CONNECTION_CODES.has(code))
	);
}

/**
 * Report whether an error, or its cause, says Postgres could not be reached.
 *
 * Azure restarts the server for maintenance, so this is an expected, transient
 * state rather than a bug: callers answer 503 and log it instead of reporting
 * it as an incident.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
	if (error === null || typeof error !== "object") {
		return false;
	}

	const cause = (error as { cause?: unknown }).cause;

	if (
		isPostgresUnavailableCode(getCode(error)) ||
		isPostgresUnavailableCode(getCode(cause))
	) {
		return true;
	}

	const code = getCode(cause);

	return (
		error instanceof DrizzleQueryError &&
		typeof code === "string" &&
		SOCKET_CODES.has(code)
	);
}
