import { setTimeout as delay } from "node:timers/promises";

/** How long a predicate has to come true before the test fails. */
const WAIT_TIMEOUT_MS = 10_000;

/** How long to wait between polls. */
const POLL_MS = 5;

/**
 * Poll `predicate` until it holds, or fail the test.
 *
 * Both loops in this app are timer-driven and neither exposes a promise for
 * "the next tick finished", so a test asserting on what a loop did has to wait
 * for the effect rather than for the call. A generous ceiling with a tight poll
 * keeps that cheap on a fast machine and reliable on a loaded one.
 */
export async function waitFor(
	predicate: () => Promise<boolean>,
): Promise<void> {
	const deadline = Date.now() + WAIT_TIMEOUT_MS;

	while (Date.now() < deadline) {
		if (await predicate()) {
			return;
		}

		await delay(POLL_MS);
	}

	throw new Error("timed out waiting for a condition");
}
