import { describe, expect, it } from "vitest";
import { nextSortDirection } from "../sorting";

describe("nextSortDirection()", () => {
	it.each([
		["reverse the ascending column", "name", "name", "ascending", "descending"],
		[
			"restore the descending column",
			"name",
			"name",
			"descending",
			"ascending",
		],
		["start a new column ascending", "size", "name", "descending", "ascending"],
		[
			"start ascending when nothing is sorted",
			"name",
			undefined,
			"descending",
			"ascending",
		],
	] as const)("should %s", (_, field, sort, direction, expected) => {
		expect(nextSortDirection(field, sort, direction)).toBe(expected);
	});
});
