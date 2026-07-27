import { describe, expect, it } from "vitest";
import { createRandomString, formatIsolateName } from "../utils.js";

describe("createRandomString()", () => {
	it("should return a string of length 8 by default", () => {
		const result = createRandomString();
		expect(result.length).toEqual(8);
	});

	it("should return a string of specified length", () => {
		const result = createRandomString(20);
		expect(result.length).toEqual(20);
	});
});

describe("formatIsolateName()", () => {
	it("should return 'Isolate ABCD' for named isolate", () => {
		const result = formatIsolateName({
			id: "testid",
			sequences: [],
			source_name: "ABCD",
			source_type: "isolate",
		});

		expect(result).toEqual("Isolate ABCD");
	});

	it("should return 'Unnamed' for isolate with source type unknown", () => {
		const result = formatIsolateName({
			id: "testid",
			sequences: [],
			source_name: "EFGH",
			source_type: "unknown",
		});

		expect(result).toEqual("Unnamed");
	});

	it("should return the canonical sentinel when a source field is empty", () => {
		const result = formatIsolateName({
			id: "testid",
			sequences: [],
			source_name: "EFGH",
			source_type: "",
		});

		expect(result).toEqual("Unnamed Isolate");
	});

	it("should accept camelCase source fields", () => {
		const result = formatIsolateName({
			sourceName: "ABCD",
			sourceType: "isolate",
		});

		expect(result).toEqual("Isolate ABCD");
	});
});
