import { describe, expect, it, vi } from "vitest";
import { createMemoizedReader } from "./memoize";

describe("createMemoizedReader", () => {
	it("returns the read's result", async () => {
		const read = createMemoizedReader(async () => "value");

		expect(await read()).toBe("value");
	});

	// Two Prometheus replicas, or a human curling a scrape endpoint in a loop,
	// would otherwise multiply an expensive read across whatever it queries.
	it("does not re-query inside its TTL", async () => {
		let clock = 0;
		const fn = vi.fn(async () => clock);
		const read = createMemoizedReader(fn, { ttlMs: 10_000, now: () => clock });

		expect(await read()).toBe(0);

		clock = 9_999;
		expect(await read()).toBe(0);

		clock = 10_000;
		expect(await read()).toBe(10_000);

		expect(fn).toHaveBeenCalledTimes(2);
	});

	// A cache keyed only on the last settled result would let two callers
	// arriving together each start their own read.
	it("shares an in-flight read between concurrent callers", async () => {
		let resolveRead: (value: string) => void = () => {};
		const fn = vi.fn(
			() => new Promise<string>((resolve) => (resolveRead = resolve)),
		);
		const read = createMemoizedReader(fn);

		const first = read();
		const second = read();

		resolveRead("value");

		expect(await first).toBe("value");
		expect(await second).toBe("value");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	// Holding a failure for the full TTL would keep a scrape's series dark for
	// the rest of the window past a blip that lasted a moment.
	it("does not cache a failed read", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("boom"));
		const read = createMemoizedReader(fn);

		await expect(read()).rejects.toThrow("boom");
		await expect(read()).rejects.toThrow("boom");

		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("defaults to the shared queue-read TTL", async () => {
		let clock = 0;
		const fn = vi.fn(async () => clock);
		const read = createMemoizedReader(fn, { now: () => clock });

		await read();

		clock = 9_999;
		await read();

		clock = 10_000;
		await read();

		expect(fn).toHaveBeenCalledTimes(2);
	});
});
