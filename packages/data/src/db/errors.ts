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
 * Codes for a connection that never opened or was cut from the far side.
 *
 * `CONNECT_TIMEOUT` and `CONNECTION_CLOSED` are postgres.js's own; the rest
 * are Node socket errors. `CONNECTION_DESTROYED` and `CONNECTION_ENDED` are
 * left out because this process raises them itself when it closes its pool,
 * and `ENOTFOUND` because a host that never resolves is a configuration fault
 * that must stay visible.
 */
const UNAVAILABLE_CONNECTION_CODES = new Set([
	"CONNECT_TIMEOUT",
	"CONNECTION_CLOSED",
	"ECONNREFUSED",
	"ECONNRESET",
	"EHOSTUNREACH",
	"ENETUNREACH",
	"ETIMEDOUT",
	"EAI_AGAIN",
]);

function isUnavailableCode(code: unknown): boolean {
	return (
		typeof code === "string" &&
		(UNAVAILABLE_SQLSTATES.has(code) ||
			code.startsWith("08") ||
			UNAVAILABLE_CONNECTION_CODES.has(code))
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
	if (isUnavailableCode((error as { code?: unknown }).code)) {
		return true;
	}
	const cause = (error as { cause?: unknown }).cause;
	return (
		cause !== null &&
		typeof cause === "object" &&
		isUnavailableCode((cause as { code?: unknown }).code)
	);
}
