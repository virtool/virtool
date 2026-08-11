/**
 * Resolve `promise`, or reject once `ms` have passed.
 *
 * The abandoned promise is left to settle on its own; the callers here are
 * read-only probes whose results are simply discarded.
 *
 * This lives apart from its callers because every `/metrics` probe needs the
 * same race for the same reason — a query on the pool it is measuring queues
 * *client-side*, where no statement timeout applies — and a second copy is free
 * to drift into a subtly different one.
 *
 * The message carries the bound that was exceeded, since several probes share
 * this helper and a log line saying only "timed out" cannot be told from any
 * other failure.
 */
export function withTimeout<T>(
	promise: PromiseLike<T>,
	ms: number,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const deadline = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
	});

	return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
