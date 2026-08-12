/**
 * How long a memoized pre-scrape read is reused before another scrape
 * re-queries, in milliseconds.
 *
 * Well under a typical 15–60 s Prometheus scrape interval, so a scrape still
 * sees a fresh answer. The point is the other direction: two Prometheus
 * replicas, or a human curling the endpoint in a loop, would otherwise
 * multiply an expensive read across the very pool the read's own process
 * serves traffic from.
 */
export const QUEUE_READ_TTL_MS = 10_000;

/** Test seams for {@link createMemoizedReader}. */
export type MemoizedReaderOptions = {
	ttlMs?: number;
	now?: () => number;
};

/**
 * Wrap an expensive async read so a burst of callers inside {@link ttlMs}
 * shares one answer instead of repeating the read.
 *
 * A factory rather than module state, so a test gets its own memo and cannot
 * see what another suite left behind — the same rule `createMetrics` follows
 * in every service that calls this.
 *
 * In-flight reads are shared, not just settled ones: two callers arriving
 * together should cost one read, which a cache keyed only on the last result
 * would not give.
 *
 * A rejection is **not** cached. The underlying read is expected to carry its
 * own bound already, and holding a failure for the full TTL would keep a
 * scrape's series dark for the rest of the window past a blip that lasted a
 * moment.
 */
export function createMemoizedReader<T>(
	read: () => Promise<T>,
	{ ttlMs = QUEUE_READ_TTL_MS, now = Date.now }: MemoizedReaderOptions = {},
): () => Promise<T> {
	let pending: Promise<T> | undefined;
	let cached: { value: T; readAt: number } | undefined;

	return function readMemoized() {
		if (cached && now() - cached.readAt < ttlMs) {
			return Promise.resolve(cached.value);
		}

		if (!pending) {
			pending = read()
				.then((value) => {
					cached = { value, readAt: now() };
					return value;
				})
				.finally(() => {
					pending = undefined;
				});
		}

		return pending;
	};
}
