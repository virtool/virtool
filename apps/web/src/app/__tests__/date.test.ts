import { formatElapsed } from "@app/date";
import { describe, expect, it } from "vitest";

describe("formatElapsed()", () => {
	it.each([
		[0, "00:00:00"],
		[1, "00:00:01"],
		[59, "00:00:59"],
		[60, "00:01:00"],
		[3599, "00:59:59"],
		[3600, "01:00:00"],
	])("formats %i seconds as %s", (seconds, expected) => {
		expect(formatElapsed(seconds)).toBe(expected);
	});

	// The figure is an elapsed duration rather than a time of day, so a job that
	// ran past a day reads its real hour count.
	it("does not wrap the hours at 24", () => {
		expect(formatElapsed(129600)).toBe("36:00:00");
	});

	it("truncates a fractional second rather than rounding it up", () => {
		expect(formatElapsed(59.9)).toBe("00:00:59");
	});

	it("clamps a negative duration to zero", () => {
		expect(formatElapsed(-5)).toBe("00:00:00");
	});
});
