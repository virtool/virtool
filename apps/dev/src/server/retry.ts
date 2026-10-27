/** Return bounded exponential delay in milliseconds for a retry attempt. */
export function getRetryDelay(attempt: number): number {
	if (!Number.isInteger(attempt) || attempt < 0) {
		throw new Error("Retry attempt must be a non-negative integer");
	}
	return Math.min(60_000, 1_000 * 2 ** attempt);
}
