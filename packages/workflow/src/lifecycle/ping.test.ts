import type { JobPing } from "@virtool/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobsApiClient } from "../client/client";
import { createRunSignals } from "../run";
import {
	createRecordingLogger,
	createUnreachableJobsApiClient,
} from "../testFixtures";
import {
	MAX_PING_FAILURES,
	PING_INTERVAL_MS,
	PING_STAGGER_MS,
	startPingLoop,
} from "./ping";

function pong(cancelled = false): JobPing {
	return { cancelled, pingedAt: "2026-08-05T00:00:00Z" };
}

function clientPinging(ping: JobsApiClient["ping"]): JobsApiClient {
	return createUnreachableJobsApiClient({ ping });
}

describe("startPingLoop", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("staggers the first ping then settles into the interval", async () => {
		const at: number[] = [];

		const loop = startPingLoop({
			client: clientPinging(() => {
				at.push(Date.now());

				return Promise.resolve(pong());
			}),
			logger: createRecordingLogger().logger,
			signals: createRunSignals(),
		});

		const start = Date.now();

		await vi.advanceTimersByTimeAsync(
			PING_STAGGER_MS + PING_INTERVAL_MS * 2 + 1,
		);

		await loop.stop();

		expect(at.map((time) => time - start)).toEqual([
			PING_STAGGER_MS,
			PING_STAGGER_MS + PING_INTERVAL_MS,
			PING_STAGGER_MS + PING_INTERVAL_MS * 2,
		]);
	});

	it("cancels the run and stops when the jobs API reports cancellation", async () => {
		const signals = createRunSignals();
		const ping = vi.fn(() => Promise.resolve(pong(true)));

		const loop = startPingLoop({
			client: clientPinging(ping),
			logger: createRecordingLogger().logger,
			signals,
		});

		await vi.advanceTimersByTimeAsync(PING_STAGGER_MS + 1);

		expect(signals.isCancelled()).toBe(true);
		expect(signals.signal.aborted).toBe(true);

		await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 3);

		expect(ping).toHaveBeenCalledTimes(1);

		await loop.stop();
	});

	it("gives up after five consecutive failures, warning what it costs", async () => {
		const { logger, records } = createRecordingLogger();
		const signals = createRunSignals();

		const ping = vi.fn(() => Promise.reject(new Error("unreachable")));

		const loop = startPingLoop({
			client: clientPinging(ping),
			logger,
			signals,
		});

		await vi.advanceTimersByTimeAsync(
			PING_STAGGER_MS + PING_INTERVAL_MS * (MAX_PING_FAILURES + 3),
		);

		expect(ping).toHaveBeenCalledTimes(MAX_PING_FAILURES);

		const warnings = records().filter((record) => record.level === 40);

		expect(warnings).toHaveLength(1);
		expect(warnings[0]?.msg).toContain("giving up on pinging the jobs API");
		expect(warnings[0]?.msg).toContain("ping timeout");

		// The run is left alone — giving up on the heartbeat is not a cancellation.
		expect(signals.signal.aborted).toBe(false);

		await loop.stop();
	});

	it("resets the failure count on success, so alternating results never give up", async () => {
		const signals = createRunSignals();

		let calls = 0;

		const ping = vi.fn(() => {
			calls += 1;

			return calls % 2 === 0
				? Promise.resolve(pong())
				: Promise.reject(new Error("blip"));
		});

		const loop = startPingLoop({
			client: clientPinging(ping),
			logger: createRecordingLogger().logger,
			signals,
		});

		await vi.advanceTimersByTimeAsync(PING_STAGGER_MS + PING_INTERVAL_MS * 20);

		expect(ping.mock.calls.length).toBeGreaterThan(MAX_PING_FAILURES * 2);

		await loop.stop();
	});

	it("stops without leaving a pending timer, and stops idempotently", async () => {
		const loop = startPingLoop({
			client: clientPinging(() => Promise.resolve(pong())),
			logger: createRecordingLogger().logger,
			signals: createRunSignals(),
		});

		await vi.advanceTimersByTimeAsync(PING_STAGGER_MS + 1);

		await loop.stop();
		await loop.stop();

		expect(vi.getTimerCount()).toBe(0);
	});

	it("abandons a hung ping when stopped rather than waiting it out", async () => {
		const signals = createRunSignals();

		// Only the signal handed to `ping` can end this, so a loop that passed
		// nothing would leave `stop()` pending for the whole request budget.
		const loop = startPingLoop({
			client: clientPinging(
				(signal) =>
					new Promise((_, reject) => {
						signal?.addEventListener(
							"abort",
							() => reject(new Error("aborted")),
							{ once: true },
						);
					}),
			),
			logger: createRecordingLogger().logger,
			signals,
		});

		await vi.advanceTimersByTimeAsync(PING_STAGGER_MS + 1);

		await loop.stop();

		expect(vi.getTimerCount()).toBe(0);
	});

	it("stays quiet when a ping in flight rejects because the run ended", async () => {
		const { logger, records } = createRecordingLogger();
		const signals = createRunSignals();

		const loop = startPingLoop({
			client: clientPinging(() => {
				signals.terminate();

				return Promise.reject(new Error("aborted"));
			}),
			logger,
			signals,
		});

		await vi.advanceTimersByTimeAsync(PING_STAGGER_MS + 1);

		await loop.stop();

		expect(
			records().filter((record) => Number(record.level) >= 40),
		).toHaveLength(0);
	});
});
