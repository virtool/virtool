import { describe, expect, it } from "vitest";
import { getPageRange } from "../Pagination/pageRange";

describe("getPageRange()", () => {
	it.each([
		[6, 1, [1, 2, 3, 4]],
		[6, 3, [2, 3, 4, 5]],
		[6, 6, [3, 4, 5, 6]],
		[3, 1, [1, 2, 3]],
		[1, 1, [1]],
	])(
		"should offer pages for %d pages at page %d",
		(pageCount, page, expected) => {
			expect(getPageRange(pageCount, page)).toEqual(expected);
		},
	);
});
