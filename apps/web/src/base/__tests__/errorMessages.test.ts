import { describe, expect, it } from "vitest";
import { getErrorMessages } from "../Field/errorMessages";

describe("getErrorMessages()", () => {
	it.each([
		["no errors", undefined, []],
		[
			"duplicates once",
			[{ message: "Required" }, undefined, { message: "Required" }],
			["Required"],
		],
		[
			"distinct messages in order",
			[{ message: "Too short" }, { message: "" }, { message: "Required" }],
			["Too short", "Required"],
		],
	])("should give %s", (_, errors, expected) => {
		expect(getErrorMessages(errors)).toEqual(expected);
	});
});
