import type { PostgresError } from "postgres";

const UNIQUE_VIOLATION = "23505";

function findUniqueViolation(error: unknown): Partial<PostgresError> | null {
	if (error === null || typeof error !== "object") {
		return null;
	}
	if ((error as Partial<PostgresError>).code === UNIQUE_VIOLATION) {
		return error as Partial<PostgresError>;
	}
	const cause = (error as { cause?: unknown }).cause;
	if (
		cause !== null &&
		typeof cause === "object" &&
		(cause as Partial<PostgresError>).code === UNIQUE_VIOLATION
	) {
		return cause as Partial<PostgresError>;
	}
	return null;
}

/**
 * Report whether an error, or its cause, is a Postgres unique violation. When
 * `constraints` is given, the violated constraint must be one of them.
 */
export function isUniqueViolation(
	error: unknown,
	constraints?: readonly string[],
): boolean {
	const violation = findUniqueViolation(error);
	if (!violation) {
		return false;
	}
	return (
		!constraints ||
		(violation.constraint_name !== undefined &&
			constraints.includes(violation.constraint_name))
	);
}
