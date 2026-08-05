import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecordingLogger } from "../testFixtures";
import { ConflictError, TransportError } from "./errors";
import { MAX_RETRIES, RETRY_DELAY_MS, sleep, withRetry } from "./retry";

function transportError(): TransportError {
	return new TransportError("unreachable", {
		method: "POST",
		path: "/jobs/1/finish",
	});
}

describe("withRetry", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("retries a transport failure five times at a flat delay", async () => {
		const attempt = vi.fn(() => Promise.reject(transportError()));

		const promise = withRetry(attempt, {
			logger: createRecordingLogger().logger,
		}).catch((err: unknown) => err);

		await vi.runAllTimersAsync();

		await expect(promise).resolves.toBeInstanceOf(TransportError);

		expect(attempt).toHaveBeenCalledTimes(MAX_RETRIES + 1);
	});

	it("waits a flat five seconds between attempts rather than doubling", async () => {
		const at: number[] = [];

		const attempt = vi.fn(() => {
			at.push(Date.now());

			return Promise.reject(transportError());
		});

		const promise = withRetry(attempt, {
			logger: createRecordingLogger().logger,
		}).catch(() => undefined);

		await vi.runAllTimersAsync();
		await promise;

		const gaps = at.slice(1).map((time, index) => time - at[index]);

		expect(gaps).toEqual([
			RETRY_DELAY_MS,
			RETRY_DELAY_MS,
			RETRY_DELAY_MS,
			RETRY_DELAY_MS,
			RETRY_DELAY_MS,
		]);
	});

	it("logs each retry at info and the exhaustion at warn", async () => {
		const { logger, records } = createRecordingLogger();

		const promise = withRetry(() => Promise.reject(transportError()), {
			logger,
		}).catch(() => undefined);

		await vi.runAllTimersAsync();
		await promise;

		const levels = records().map((record) => record.level);

		expect(levels.filter((level) => level === 30)).toHaveLength(MAX_RETRIES);
		expect(levels.filter((level) => level === 40)).toHaveLength(1);
	});

	it("does not retry a status error", async () => {
		const attempt = vi.fn(() =>
			Promise.reject(
				new ConflictError("already finished", {
					method: "POST",
					path: "/jobs/1/finish",
					status: 409,
				}),
			),
		);

		await expect(
			withRetry(attempt, { logger: createRecordingLogger().logger }),
		).rejects.toBeInstanceOf(ConflictError);

		expect(attempt).toHaveBeenCalledTimes(1);
	});

	it("honours a retry count of zero", async () => {
		const attempt = vi.fn(() => Promise.reject(transportError()));

		await expect(
			withRetry(attempt, {
				logger: createRecordingLogger().logger,
				retries: 0,
			}),
		).rejects.toBeInstanceOf(TransportError);

		expect(attempt).toHaveBeenCalledTimes(1);
	});

	it("rejects promptly when the run is cancelled during a retry sleep", async () => {
		const controller = new AbortController();
		const attempt = vi.fn(() => Promise.reject(transportError()));

		const promise = withRetry(attempt, {
			logger: createRecordingLogger().logger,
			signal: controller.signal,
		}).catch((err: unknown) => err);

		// Let the first attempt fail and the loop enter its sleep.
		await vi.advanceTimersByTimeAsync(0);

		controller.abort();

		// No timer is advanced, so anything that resolves here did so on the abort
		// rather than by waiting out the remaining 25 s.
		await expect(promise).resolves.toBeInstanceOf(TransportError);

		expect(attempt).toHaveBeenCalledTimes(1);
	});

	it("returns the first successful attempt's value", async () => {
		let calls = 0;

		const attempt = vi.fn(() => {
			calls += 1;

			return calls < 3
				? Promise.reject(transportError())
				: Promise.resolve("done");
		});

		const promise = withRetry(attempt, {
			logger: createRecordingLogger().logger,
		});

		await vi.runAllTimersAsync();

		await expect(promise).resolves.toBe("done");
		expect(attempt).toHaveBeenCalledTimes(3);
	});
});

describe("sleep", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("resolves early on abort and leaves no pending timer", async () => {
		const controller = new AbortController();

		const promise = sleep(60_000, controller.signal);

		controller.abort();

		await promise;

		expect(vi.getTimerCount()).toBe(0);
	});

	it("returns immediately for an already aborted signal", async () => {
		await sleep(60_000, AbortSignal.abort());

		expect(vi.getTimerCount()).toBe(0);
	});
});
