import { describe, expect, it } from "vitest";
import {
	filterAccessions,
	formatAccession,
	getAccession,
	isRefSeq,
} from "./accession";

describe("getAccession()", () => {
	it("splits a versioned accession", () => {
		expect(getAccession("MN908947.3")).toEqual({
			key: "MN908947",
			version: 3,
		});
	});

	it("keeps the underscore in a RefSeq key", () => {
		expect(getAccession("NC_004452.1")).toEqual({
			key: "NC_004452",
			version: 1,
		});
	});

	it.each([
		["an unversioned accession", "MN908947"],
		["a multi-part accession", "MN908947.3.1"],
		["a non-numeric version", "MN908947.x"],
		["an empty string", ""],
		["whitespace", "   "],
		["a missing key", ".3"],
	])("returns null for %s", (_, value) => {
		expect(getAccession(value)).toBeNull();
	});

	it("trims surrounding whitespace", () => {
		expect(getAccession("  MN908947.3\n")).toEqual({
			key: "MN908947",
			version: 3,
		});
	});
});

describe("isRefSeq()", () => {
	it.each(["NC_003619", "NC_010314", "NC_ABC123"])("accepts %s", (key) => {
		expect(isRefSeq(key)).toBe(true);
	});

	it.each(["MN908947", "AF395128", "nc_003619", "NC_003619.1"])(
		"rejects %s",
		(key) => {
			expect(isRefSeq(key)).toBe(false);
		},
	);
});

describe("filterAccessions()", () => {
	it("drops unparseable entries and sorts by key then version", () => {
		expect(
			filterAccessions([
				"MN908947.3",
				"not an accession",
				"AF395128.1",
				"MN908947.1",
			]),
		).toEqual([
			{ key: "AF395128", version: 1 },
			{ key: "MN908947", version: 1 },
			{ key: "MN908947", version: 3 },
		]);
	});

	it("deduplicates repeated accessions", () => {
		expect(filterAccessions(["AF395128.1", "AF395128.1"])).toEqual([
			{ key: "AF395128", version: 1 },
		]);
	});

	it("keeps two versions of one key apart", () => {
		expect(filterAccessions(["NC_004452.3", "NC_004452.2"])).toEqual([
			{ key: "NC_004452", version: 2 },
			{ key: "NC_004452", version: 3 },
		]);
	});
});

describe("formatAccession()", () => {
	it("round-trips", () => {
		const accession = getAccession("NC_004452.3");

		expect(accession).not.toBeNull();
		expect(formatAccession(accession as never)).toBe("NC_004452.3");
	});
});
