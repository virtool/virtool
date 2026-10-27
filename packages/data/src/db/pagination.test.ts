import { describe, expect, it } from "vitest";

import { getPageCount, getPageOffset } from "./pagination";

describe("getPageOffset", () => {
	it("skips the rows of earlier pages", () => {
		expect(getPageOffset(1, 25)).toBe(0);
		expect(getPageOffset(3, 25)).toBe(50);
	});

	it("treats a page below one as the first page", () => {
		expect(getPageOffset(0, 25)).toBe(0);
	});
});

describe("getPageCount", () => {
	it("rounds a partial page up", () => {
		expect(getPageCount(51, 25)).toBe(3);
		expect(getPageCount(50, 25)).toBe(2);
	});

	it("returns zero when nothing is found", () => {
		expect(getPageCount(0, 25)).toBe(0);
	});

	it("returns zero when the page size is not positive", () => {
		expect(getPageCount(10, 0)).toBe(0);
	});
});
