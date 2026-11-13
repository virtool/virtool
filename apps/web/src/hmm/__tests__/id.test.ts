import { describe, expect, it } from "vitest";
import { parseHmmId } from "../id";

describe("parseHmmId()", () => {
	it("should read a row id", () => {
		expect(parseHmmId("42")).toBe(42);
	});

	it.each([
		["a legacy Mongo id", "abc123"],
		["zero", "0"],
		["a negative id", "-1"],
		["a fraction", "1.5"],
		["an id beyond the safe integer range", "9007199254740993"],
	])("should refuse %s", (_, segment) => {
		expect(parseHmmId(segment)).toBeNull();
	});
});
