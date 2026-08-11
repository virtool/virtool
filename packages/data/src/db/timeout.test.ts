import { describe, expect, it } from "vitest";
import { withTimeout } from "./timeout";

/**
 * A promise that never settles.
 *
 * This is what the helper exists for: a query queued *client-side* behind a full
 * pool, where no statement timeout applies and nothing will ever reject it. It
 * is also what makes these tests deterministic — the timer cannot lose a race
 * against something that never finishes, so there is no race.
 */
function never(): Promise<never> {
	return new Promise(() => undefined);
}

describe("withTimeout", () => {
	it("rejects once the bound passes", async () => {
		await expect(withTimeout(never(), 5)).rejects.toThrow("timed out");
	});

	// Several probes share this helper, so a log line saying only "timed out"
	// cannot be told from any other failure. The bound is what identifies it.
	it("names the bound that was exceeded", async () => {
		await expect(withTimeout(never(), 5)).rejects.toThrow(
			"timed out after 5ms",
		);
	});

	it("resolves what the promise resolved", async () => {
		await expect(withTimeout(Promise.resolve("counts"), 1_000)).resolves.toBe(
			"counts",
		);
	});

	it("passes the promise's own rejection through", async () => {
		await expect(
			withTimeout(Promise.reject(new Error("connection reset")), 1_000),
		).rejects.toThrow("connection reset");
	});

	// The timer is cleared on both paths. Without that a probe that answered in
	// milliseconds would leave a pending timer for the whole bound, and on a
	// short-lived process that is the difference between exiting and waiting it
	// out. Counted rather than compared loosely, so an uncleared 30 s timer is a
	// failure rather than a number that happens to be no larger.
	it("clears the timer once the promise settles", async () => {
		const timers = () =>
			process
				.getActiveResourcesInfo()
				.filter((resource) => resource === "Timeout").length;

		const before = timers();

		await withTimeout(Promise.resolve(null), 30_000);

		expect(timers()).toBe(before);
	});
});
