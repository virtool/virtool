import { describe, expect, it } from "vitest";
import { computeEmailRetryDelay, EMAIL_MAX_ATTEMPTS } from "./retry";

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

	it("caps provider retry guidance", () => {
		expect(computeEmailRetryDelay(1, 999_999)).toBe(3600);
	});

	it("ignores non-positive retry guidance", () => {
		expect(computeEmailRetryDelay(1, 0, () => 0.5)).toBe(30);
	});

	it("exports a positive attempt bound", () => {
		expect(EMAIL_MAX_ATTEMPTS).toBeGreaterThan(0);
	});
});
