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
