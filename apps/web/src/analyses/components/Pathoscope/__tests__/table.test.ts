import { createFakePathoscopeHit } from "@tests/fake/analyses";
import type { PathoscopeIsolate } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import {
	formatPathoscopeHitsAsTsv,
	formatPathoscopeIsolatesAsTsv,
} from "../table";

describe("formatPathoscopeHitsAsTsv()", () => {
	it("should render a header row and one tab-separated row per hit", () => {
		const table = formatPathoscopeHitsAsTsv(
			[
				createFakePathoscopeHit({ id: "a", name: "Alpha virus" }),
				createFakePathoscopeHit({
					coverage: 0.123456,
					depth: 7,
					id: "b",
					name: "Beta virus",
					pi: 0.0001234,
				}),
			],
			{
				columnOrder: "name-last",
				headers: true,
				mappedCount: 1000,
				preferAbbreviation: false,
				showReads: false,
			},
		);

		expect(table).toBe(
			[
				"Weight\tDepth\tCoverage\tName",
				"0.250\t12\t0.500\tAlpha virus",
				"1.23E-4\t7\t0.123\tBeta virus",
			].join("\n"),
		);
	});

	it("should put the name first when that order is chosen", () => {
		const table = formatPathoscopeHitsAsTsv(
			[createFakePathoscopeHit({ name: "Alpha virus" })],
			{
				columnOrder: "name-first",
				headers: true,
				mappedCount: 1000,
				preferAbbreviation: false,
				showReads: false,
			},
		);

		expect(table).toBe(
			["Name\tWeight\tDepth\tCoverage", "Alpha virus\t0.250\t12\t0.500"].join(
				"\n",
			),
		);
	});

	it("should render read pseudo-counts when reads are shown", () => {
		const table = formatPathoscopeHitsAsTsv(
			[createFakePathoscopeHit({ name: "Alpha virus", pi: 0.25 })],
			{
				columnOrder: "name-last",
				headers: true,
				mappedCount: 1000,
				preferAbbreviation: false,
				showReads: true,
			},
		);

		expect(table).toBe(
			["Reads\tDepth\tCoverage\tName", "250\t12\t0.500\tAlpha virus"].join(
				"\n",
			),
		);
	});

	// A table pasted under one that already has headers must not repeat them.
	it("should render the rows alone when headers are not wanted", () => {
		const table = formatPathoscopeHitsAsTsv(
			[createFakePathoscopeHit({ name: "Alpha virus" })],
			{
				columnOrder: "name-last",
				headers: false,
				mappedCount: 1000,
				preferAbbreviation: false,
				showReads: false,
			},
		);

		expect(table).toBe("0.250\t12\t0.500\tAlpha virus");
	});

	it("should name an OTU by its abbreviation when one is preferred", () => {
		const table = formatPathoscopeHitsAsTsv(
			[
				createFakePathoscopeHit({
					abbreviation: "AV",
					id: "a",
					name: "Alpha virus",
				}),
				createFakePathoscopeHit({
					abbreviation: "",
					id: "b",
					name: "Beta virus",
				}),
			],
			{
				columnOrder: "name-last",
				headers: false,
				mappedCount: 1000,
				preferAbbreviation: true,
				showReads: false,
			},
		);

		expect(table).toBe(
			["0.250\t12\t0.500\tAV", "0.250\t12\t0.500\tBeta virus"].join("\n"),
		);
	});

	it("should render only the header row when nothing is selected", () => {
		expect(
			formatPathoscopeHitsAsTsv([], {
				columnOrder: "name-last",
				headers: true,
				mappedCount: 1000,
				preferAbbreviation: false,
				showReads: false,
			}),
		).toBe("Weight\tDepth\tCoverage\tName");
	});

	// A name carrying a tab or a newline would otherwise open a column or a row
	// of its own and shift every field after it out of line.
	it("should collapse tabs and newlines in a name", () => {
		const table = formatPathoscopeHitsAsTsv(
			[createFakePathoscopeHit({ name: "Alpha\tvirus\nstrain" })],
			{
				columnOrder: "name-last",
				headers: false,
				mappedCount: 1000,
				preferAbbreviation: false,
				showReads: false,
			},
		);

		expect(table).toBe("0.250\t12\t0.500\tAlpha virus strain");
	});
});

function createIsolate(
	overrides: Partial<PathoscopeIsolate>,
): PathoscopeIsolate {
	return {
		absentSegmentKeys: [],
		coverage: 0.5,
		depth: 12,
		id: "isolate",
		length: 6000,
		name: "Isolate A",
		pi: 0.25,
		sequences: [],
		...overrides,
	};
}

describe("formatPathoscopeIsolatesAsTsv()", () => {
	it("should render one row per isolate, each naming its OTU", () => {
		const table = formatPathoscopeIsolatesAsTsv(
			[
				createFakePathoscopeHit({
					id: "a",
					isolates: [
						createIsolate({ id: "a1", name: "Isolate A" }),
						createIsolate({
							coverage: 0.25,
							depth: 4,
							id: "a2",
							name: "Isolate B",
							pi: 0.1,
						}),
					],
					name: "Alpha virus",
				}),
				createFakePathoscopeHit({
					id: "b",
					isolates: [createIsolate({ id: "b1", name: "Isolate C" })],
					name: "Beta virus",
				}),
			],
			{
				columnOrder: "name-last",
				headers: true,
				mappedCount: 1000,
				preferAbbreviation: false,
				showReads: false,
			},
		);

		expect(table).toBe(
			[
				"Weight\tDepth\tCoverage\tName\tIsolate",
				"0.250\t12\t0.500\tAlpha virus\tIsolate A",
				"0.100\t4\t0.250\tAlpha virus\tIsolate B",
				"0.250\t12\t0.500\tBeta virus\tIsolate C",
			].join("\n"),
		);
	});

	it("should put the names first when that order is chosen", () => {
		const table = formatPathoscopeIsolatesAsTsv(
			[
				createFakePathoscopeHit({
					isolates: [createIsolate({ id: "a1", name: "Isolate A" })],
					name: "Alpha virus",
				}),
			],
			{
				columnOrder: "name-first",
				headers: true,
				mappedCount: 1000,
				preferAbbreviation: false,
				showReads: false,
			},
		);

		expect(table).toBe(
			[
				"Name\tIsolate\tWeight\tDepth\tCoverage",
				"Alpha virus\tIsolate A\t0.250\t12\t0.500",
			].join("\n"),
		);
	});

	it("should render read pseudo-counts when reads are shown", () => {
		const table = formatPathoscopeIsolatesAsTsv(
			[
				createFakePathoscopeHit({
					isolates: [createIsolate({ pi: 0.25 })],
					name: "Alpha virus",
				}),
			],
			{
				columnOrder: "name-last",
				headers: false,
				mappedCount: 1000,
				preferAbbreviation: false,
				showReads: true,
			},
		);

		expect(table).toBe("250\t12\t0.500\tAlpha virus\tIsolate A");
	});

	// A hit whose isolates were all filtered out contributes nothing rather than
	// an empty row.
	it("should name each isolate's OTU by its abbreviation when one is preferred", () => {
		const table = formatPathoscopeIsolatesAsTsv(
			[
				createFakePathoscopeHit({
					abbreviation: "AV",
					isolates: [createIsolate({ id: "a1", name: "Isolate A" })],
					name: "Alpha virus",
				}),
			],
			{
				columnOrder: "name-last",
				headers: false,
				mappedCount: 1000,
				preferAbbreviation: true,
				showReads: false,
			},
		);

		expect(table).toBe("0.250\t12\t0.500\tAV\tIsolate A");
	});

	it("should render nothing for a hit with no isolates", () => {
		expect(
			formatPathoscopeIsolatesAsTsv(
				[createFakePathoscopeHit({ isolates: [] })],
				{
					columnOrder: "name-last",
					headers: false,
					mappedCount: 1000,
					preferAbbreviation: false,
					showReads: false,
				},
			),
		).toBe("");
	});
});
