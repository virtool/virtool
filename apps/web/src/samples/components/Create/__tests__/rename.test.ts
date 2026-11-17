import { describe, expect, it } from "vitest";
import { renameNames } from "../rename";

describe("renameNames()", () => {
	it.each<[string, string[], string, string, string[]]>([
		[
			"delete wildcard matches from every name",
			["sample_batch-one_end", "sample_batch_end"],
			"_batch*_end",
			"",
			["sample", "sample"],
		],
		[
			"replace every literal match with the replacement as written",
			["sample.a+.a+", "sample.A+"],
			".a+",
			"$&",
			["sample$&$&", "sample.A+"],
		],
		[
			"replace the whole name once with a standalone wildcard",
			["sample_one"],
			"*",
			"renamed",
			["renamed"],
		],
		[
			"delete the whole name with a standalone wildcard",
			["sample_one"],
			"*",
			"",
			[""],
		],
		[
			"leave every name alone without a match",
			["sample_one"],
			"",
			"x",
			["sample_one"],
		],
	])("should %s", (_, names, match, replacement, expected) => {
		expect(renameNames(names, match, replacement, false)).toEqual({
			error: null,
			renamed: expected,
		});
	});

	it.each([
		["(sample)_(\\d+)", "$2-$1", "12-sample_34"],
		["\\d+", "batch", "sample_batch_batch"],
		["^sample_", "", "12_34"],
		["$", "_end", "sample_12_34_end"],
	])("should replace regex %s with %s", (match, replacement, expected) => {
		expect(
			renameNames(["sample_12_34"], match, replacement, true).renamed,
		).toEqual([expected]);
	});

	it("should rename nothing and report an invalid regular expression", () => {
		expect(renameNames(["sample_one"], "(", "", true)).toEqual({
			error: "Enter a valid regular expression.",
			renamed: ["sample_one"],
		});
	});

	it("should take a regular expression character literally when not in regex mode", () => {
		expect(renameNames(["sample("], "(", "_", false)).toEqual({
			error: null,
			renamed: ["sample_"],
		});
	});
});
