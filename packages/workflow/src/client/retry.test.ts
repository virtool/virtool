import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecordingLogger } from "../testing";
import {
	ConflictError,
	ServiceUnavailableError,
	TransportError,
} from "./errors";
import { RETRY_DELAY_MS, RETRY_WINDOW_MS, sleep, withRetry } from "./retry";

/** Retries an immediately failing attempt gets inside the window. */
const FAST_RETRIES = RETRY_WINDOW_MS / RETRY_DELAY_MS;

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

	it("retries a transport failure until the window closes", async () => {
		const attempt = vi.fn(() => Promise.reject(transportError()));

		const promise = withRetry(attempt, {
			logger: createRecordingLogger().logger,
		}).catch((err: unknown) => err);

		await vi.runAllTimersAsync();

		await expect(promise).resolves.toBeInstanceOf(TransportError);

		expect(attempt).toHaveBeenCalledTimes(FAST_RETRIES + 1);
	});

	it("counts the time an attempt hangs against the window", async () => {
		const attempt = vi.fn(async () => {
			await sleep(60_000);
			throw transportError();
		});

		const promise = withRetry(attempt, {
			logger: createRecordingLogger().logger,
		}).catch((err: unknown) => err);

		await vi.runAllTimersAsync();

		await expect(promise).resolves.toBeInstanceOf(TransportError);

		// Attempts end at 60 s, 125 s, 190 s, and 255 s; the window closes at
		// 240 s, so no retry follows the fourth.
		expect(attempt).toHaveBeenCalledTimes(4);
	});

	it("retries a 503 and returns once it clears", async () => {
		const attempt = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(
				new ServiceUnavailableError("Database unavailable", {
					method: "POST",
					path: "/jobs/1/finish",
					status: 503,
				}),
			)
			.mockResolvedValueOnce("done");

		const promise = withRetry(attempt, {
			logger: createRecordingLogger().logger,
		});

		await vi.runAllTimersAsync();

		await expect(promise).resolves.toBe("done");
		expect(attempt).toHaveBeenCalledTimes(2);
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

		const gaps = at.slice(1).map((time, index) => time - (at[index] ?? 0));

		expect(gaps).toEqual(Array(FAST_RETRIES).fill(RETRY_DELAY_MS));
	});

	it("logs each retry at info and the exhaustion at warn", async () => {
		const { logger, records } = createRecordingLogger();

		const promise = withRetry(() => Promise.reject(transportError()), {
			logger,
		}).catch(() => undefined);

		await vi.runAllTimersAsync();
		await promise;

		const levels = records().map((record) => record.level);

		expect(levels.filter((level) => level === 30)).toHaveLength(FAST_RETRIES);
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
		// rather than by waiting out the remaining window.
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
