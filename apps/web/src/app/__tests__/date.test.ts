import { formatCalendarTime, formatElapsed, formatUtcDate } from "@app/date";
import { afterEach, describe, expect, it } from "vitest";

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

describe("formatCalendarTime()", () => {
	const now = new Date("2026-11-10T15:30:00Z").getTime();

	it.each([
		["2026-11-10T11:12:00Z", "today", "Today at 11:12"],
		["2026-11-10T00:00:00Z", "today", "Today at 00:00"],
		["2026-11-09T23:59:00Z", "yesterday", "Yesterday at 23:59"],
		["2026-11-08T09:30:00Z", null, "Nov 8 at 09:30"],
		["2026-01-01T00:00:00Z", null, "Jan 1 at 00:00"],
		["2025-12-31T23:59:00Z", null, "Dec 31, 2025"],
		["2023-09-26T14:03:00Z", null, "Sep 26, 2023"],
	])("should describe %s", (date, day, text) => {
		expect(formatCalendarTime(new Date(date), now)).toEqual({ day, text });
	});

	it("should describe a time after now as today", () => {
		expect(formatCalendarTime(new Date("2026-11-11T00:00:05Z"), now)).toEqual({
			day: "today",
			text: "Today at 00:00",
		});
	});

	it("should describe yesterday across a month boundary", () => {
		expect(
			formatCalendarTime(
				new Date("2026-02-28T12:00:00Z"),
				new Date("2026-03-01T12:00:00Z").getTime(),
			),
		).toEqual({ day: "yesterday", text: "Yesterday at 12:00" });
	});
});

describe("formatUtcDate()", () => {
	const originalTimeZone = process.env.TZ;

	afterEach(() => {
		process.env.TZ = originalTimeZone;
	});

	it("reports the UTC day when the local day is behind it", () => {
		// 18:00 in Vancouver on the 20th is already the 21st in UTC, which is the
		// day the server resolves a date filter against.
		process.env.TZ = "America/Vancouver";
		const date = new Date("2026-08-21T01:00:00.000Z");

		expect(date.getDate()).toBe(20);
		expect(formatUtcDate(date)).toBe("2026-08-21");
	});
});
