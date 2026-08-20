import {
	getDateFilter,
	getDateFilterLabel,
	getDateFilterMode,
	getMonthFilter,
	getRangeFilter,
	getYearFilter,
	parseCalendarDate,
} from "@samples/dateFilter";
import { describe, expect, it } from "vitest";

describe("parseCalendarDate()", () => {
	it("parses a day to local midnight", () => {
		const parsed = parseCalendarDate("2026-08-20");

		expect(parsed?.getFullYear()).toBe(2026);
		expect(parsed?.getMonth()).toBe(7);
		expect(parsed?.getDate()).toBe(20);
		expect(parsed?.getHours()).toBe(0);
	});

	it.each(["2026-8-20", "20-08-2026", "not a date", ""])(
		"rejects the malformed value %j",
		(value) => {
			expect(parseCalendarDate(value)).toBeUndefined();
		},
	);

	it("rejects a day the month does not have", () => {
		expect(parseCalendarDate("2026-02-31")).toBeUndefined();
	});
});

describe("getMonthFilter()", () => {
	it("spans the whole month", () => {
		expect(getMonthFilter(2026, 7)).toEqual({
			after: "2026-08-01",
			before: "2026-08-31",
		});
	});

	it("ends on the leap day in a leap February", () => {
		expect(getMonthFilter(2028, 1).before).toBe("2028-02-29");
	});
});

describe("getYearFilter()", () => {
	it("spans the whole year", () => {
		expect(getYearFilter(2026)).toEqual({
			after: "2026-01-01",
			before: "2026-12-31",
		});
	});
});

describe("getRangeFilter()", () => {
	it("orders the bounds however the days were picked", () => {
		const earlier = new Date(2026, 0, 5);
		const later = new Date(2026, 2, 15);
		const expected = { after: "2026-01-05", before: "2026-03-15" };

		expect(getRangeFilter(earlier, later)).toEqual(expected);
		expect(getRangeFilter(later, earlier)).toEqual(expected);
	});
});

describe("getDateFilterMode()", () => {
	it("reads a whole month back as a month", () => {
		expect(getDateFilterMode(getMonthFilter(2026, 7))).toBe("month");
	});

	it("reads a whole year back as a year", () => {
		expect(getDateFilterMode(getYearFilter(2026))).toBe("year");
	});

	it("reads January alone as a month rather than its year", () => {
		expect(getDateFilterMode(getMonthFilter(2026, 0))).toBe("month");
	});

	it.each([
		{ after: "2026-08-01", before: "2026-08-30" },
		{ after: "2026-08-02", before: "2026-08-31" },
		{ after: "2026-01-01", before: "2026-06-30" },
	])("reads $after – $before back as a range", (filter) => {
		expect(getDateFilterMode(filter)).toBe("range");
	});
});

describe("getDateFilterLabel()", () => {
	it("names a month", () => {
		expect(getDateFilterLabel(getMonthFilter(2026, 7))).toBe("August 2026");
	});

	it("names a year", () => {
		expect(getDateFilterLabel(getYearFilter(2026))).toBe("2026");
	});

	it("shows both bounds of a range", () => {
		expect(
			getDateFilterLabel({ after: "2026-01-05", before: "2026-03-15" }),
		).toBe("2026-01-05 – 2026-03-15");
	});
});

describe("getDateFilter()", () => {
	it("accepts a well-formed pair", () => {
		expect(getDateFilter("2026-08-01", "2026-08-31")).toEqual({
			after: "2026-08-01",
			before: "2026-08-31",
		});
	});

	it.each([
		["a missing lower bound", undefined, "2026-08-31"],
		["a missing upper bound", "2026-08-01", undefined],
		["a malformed bound", "2026-08-01", "nonsense"],
		["an impossible day", "2026-02-31", "2026-08-31"],
		["bounds in the wrong order", "2026-08-31", "2026-08-01"],
	])("discards %s", (_, after, before) => {
		expect(getDateFilter(after, before)).toBeUndefined();
	});
});
