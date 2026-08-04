/**
 * Return the first row, throwing when the result set is empty. Use for
 * insert/update `.returning()` paths where a row is guaranteed on success.
 */
export function takeFirstOrThrow<T>(rows: T[]): T {
	const [row] = rows;
	if (row === undefined) {
		throw new Error("Expected at least one row but the result set was empty");
	}
	return row;
}

/**
 * Return the first row or `undefined` when the result set is empty. Use where
 * the caller already handles the missing-row case.
 */
export function takeFirst<T>(rows: T[]): T | undefined {
	return rows[0];
}
