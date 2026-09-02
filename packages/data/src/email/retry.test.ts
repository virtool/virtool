import { describe, expect, it } from "vitest";
import {
	computeEmailRetryDelay,
	EMAIL_DELIVERY_DEADLINE_SECONDS,
	EMAIL_MAX_ATTEMPTS,
	getEmailDeliveryRemainingSeconds,
	isEmailDeliveryExpired,
} from "./retry";

describe("computeEmailRetryDelay", () => {
	it("doubles from the base per attempt at the jitter midpoint", () => {
		const midpoint = () => 0.5;

		expect(computeEmailRetryDelay(1, undefined, midpoint)).toBe(30);
		expect(computeEmailRetryDelay(2, undefined, midpoint)).toBe(60);
		expect(computeEmailRetryDelay(3, undefined, midpoint)).toBe(120);
	});

	it("caps the delay however high the attempt count runs", () => {
		expect(computeEmailRetryDelay(50, undefined, () => 0.5)).toBe(3600);
	});

	it("spreads each delay within twenty percent of nominal", () => {
		expect(computeEmailRetryDelay(2, undefined, () => 0)).toBe(48);
		expect(computeEmailRetryDelay(2, undefined, () => 1)).toBe(72);
	});

	it("honors provider retry guidance without shortening it", () => {
		expect(computeEmailRetryDelay(1, 45, () => 0)).toBe(45);
	});

	it("rounds fractional retry guidance up", () => {
		expect(computeEmailRetryDelay(1, 0.4, () => 0.5)).toBe(1);
	});

	it("honors provider retry guidance well past the computed ceiling", () => {
		expect(computeEmailRetryDelay(1, 7200)).toBe(7200);
	});

	it("caps provider retry guidance at a day", () => {
		expect(computeEmailRetryDelay(1, 999_999)).toBe(86_400);
	});

	it("ignores non-positive retry guidance", () => {
		expect(computeEmailRetryDelay(1, 0, () => 0.5)).toBe(30);
	});

	it("exports an attempt bound that outlasts the deadline", () => {
		const midpoint = () => 0.5;

		let elapsed = 0;

		for (let attempt = 1; attempt < EMAIL_MAX_ATTEMPTS; attempt++) {
			elapsed += computeEmailRetryDelay(attempt, undefined, midpoint);
		}

		expect(elapsed).toBeGreaterThan(EMAIL_DELIVERY_DEADLINE_SECONDS);
	});
});

describe("isEmailDeliveryExpired", () => {
	const now = new Date("2026-01-01T12:00:00.000Z");

	function ageSeconds(seconds: number): Date {
		return new Date(now.getTime() - seconds * 1000);
	}

	it("passes a row younger than the deadline", () => {
		expect(
			isEmailDeliveryExpired(
				ageSeconds(EMAIL_DELIVERY_DEADLINE_SECONDS - 1),
				now,
			),
		).toBe(false);
	});

	it("expires a row at the deadline", () => {
		expect(
			isEmailDeliveryExpired(ageSeconds(EMAIL_DELIVERY_DEADLINE_SECONDS), now),
		).toBe(true);
	});

	it("expires a row past the deadline", () => {
		expect(
			isEmailDeliveryExpired(
				ageSeconds(EMAIL_DELIVERY_DEADLINE_SECONDS * 2),
				now,
			),
		).toBe(true);
	});
});

describe("getEmailDeliveryRemainingSeconds", () => {
	const now = new Date("2026-01-01T12:00:00.000Z");

	function ageSeconds(seconds: number): Date {
		return new Date(now.getTime() - seconds * 1000);
	}

	it("returns the full deadline for a row created now", () => {
		expect(getEmailDeliveryRemainingSeconds(now, now)).toBe(
			EMAIL_DELIVERY_DEADLINE_SECONDS,
		);
	});

	it("counts down as the row ages", () => {
		expect(getEmailDeliveryRemainingSeconds(ageSeconds(600), now)).toBe(
			EMAIL_DELIVERY_DEADLINE_SECONDS - 600,
		);
	});

	it("floors at zero past the deadline", () => {
		expect(
			getEmailDeliveryRemainingSeconds(
				ageSeconds(EMAIL_DELIVERY_DEADLINE_SECONDS * 2),
				now,
			),
		).toBe(0);
	});
});
