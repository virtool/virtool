import { createFakeOtuIsolate, createFakeOtuSequence } from "@tests/fake/otus";
import type { OtuIsolate, OtuSegment } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import {
	describeExportRows,
	describeSelection,
	formatAccessions,
	formatExportFilename,
	formatFasta,
	formatIsolateTable,
	formatSequenceTable,
	getExportSequences,
} from "../export";

const schema: OtuSegment[] = [
	{ molecule: null, name: "RNA1", required: true },
	{ molecule: null, name: "RNA2", required: true },
];

const otu = { name: "Tobacco mosaic virus", schema };

const isolates: OtuIsolate[] = [
	createFakeOtuIsolate({
		default: true,
		sourceName: "A",
		sourceType: "isolate",
		sequences: [
			createFakeOtuSequence({
				accession: "MN2",
				definition: 'RNA2, "partial"',
				host: "Tobacco",
				segment: "RNA2",
				sequence: "GG",
			}),
			createFakeOtuSequence({
				accession: "MN1",
				definition: "RNA1\tcomplete",
				host: "Tobacco",
				segment: "RNA1",
				sequence: "ATGC",
			}),
		],
	}),
	createFakeOtuIsolate({
		sourceName: "B|2",
		sourceType: "isolate",
		sequences: [
			createFakeOtuSequence({
				accession: "MN3",
				definition: "RNA1",
				host: "Pepper",
				segment: null,
				sequence: "TT",
			}),
		],
	}),
];

const sequences = getExportSequences(otu, isolates);

describe("getExportSequences", () => {
	it("orders sequences by isolate, then by segment", () => {
		expect(sequences.map((sequence) => sequence.accession)).toEqual([
			"MN1",
			"MN2",
			"MN3",
		]);
		expect(sequences[0]).toMatchObject({
			isolateName: "Isolate A",
			otuName: "Tobacco mosaic virus",
		});
	});
});

describe("formatFasta", () => {
	it("writes the accession alone", () => {
		expect(formatFasta(sequences, "accession")).toBe(
			">MN1\nATGC\n>MN2\nGG\n>MN3\nTT",
		);
	});

	it("writes the accession, OTU, and isolate, with pipes in names collapsed", () => {
		expect(formatFasta(sequences, "full")).toBe(
			[
				">MN1|Tobacco mosaic virus|Isolate A",
				"ATGC",
				">MN2|Tobacco mosaic virus|Isolate A",
				"GG",
				">MN3|Tobacco mosaic virus|Isolate B 2",
				"TT",
			].join("\n"),
		);
	});
});

describe("formatAccessions", () => {
	it("writes one accession per line", () => {
		expect(formatAccessions(sequences)).toBe("MN1\nMN2\nMN3");
	});
});

describe("formatSequenceTable", () => {
	it("writes CSV with quoted text and bare numbers", () => {
		expect(formatSequenceTable(sequences, "csv").split("\n")).toEqual([
			'"OTU","Isolate","Accession","Segment","Length","Definition","Host"',
			'"Tobacco mosaic virus","Isolate A","MN1","RNA1",4,"RNA1\tcomplete","Tobacco"',
			'"Tobacco mosaic virus","Isolate A","MN2","RNA2",2,"RNA2, ""partial""","Tobacco"',
			'"Tobacco mosaic virus","Isolate B|2","MN3","",2,"RNA1","Pepper"',
		]);
	});

	it("writes TSV with tabs in fields collapsed", () => {
		expect(formatSequenceTable(sequences, "tsv").split("\n")[1]).toBe(
			"Tobacco mosaic virus\tIsolate A\tMN1\tRNA1\t4\tRNA1 complete\tTobacco",
		);
	});
});

describe("formula injection", () => {
	const unsafe = ["=1+1", "+1", "-1", "@SUM(A1)"].map((definition, index) =>
		createFakeOtuSequence({
			accession: `MN${index}`,
			definition,
			host: "Tobacco",
			segment: null,
			sequence: "AT",
		}),
	);

	const unsafeSequences = getExportSequences(otu, [
		createFakeOtuIsolate({
			sourceName: "A",
			sourceType: "isolate",
			sequences: unsafe,
		}),
	]);

	it("prefixes formula cells with a quote in CSV", () => {
		expect(
			formatSequenceTable(unsafeSequences, "csv").split("\n").slice(1),
		).toEqual([
			`"Tobacco mosaic virus","Isolate A","MN0","",2,"'=1+1","Tobacco"`,
			`"Tobacco mosaic virus","Isolate A","MN1","",2,"'+1","Tobacco"`,
			`"Tobacco mosaic virus","Isolate A","MN2","",2,"'-1","Tobacco"`,
			`"Tobacco mosaic virus","Isolate A","MN3","",2,"'@SUM(A1)","Tobacco"`,
		]);
	});

	it("prefixes formula cells with a quote in TSV", () => {
		expect(
			formatSequenceTable(unsafeSequences, "tsv").split("\n").slice(1),
		).toEqual([
			"Tobacco mosaic virus\tIsolate A\tMN0\t\t2\t'=1+1\tTobacco",
			"Tobacco mosaic virus\tIsolate A\tMN1\t\t2\t'+1\tTobacco",
			"Tobacco mosaic virus\tIsolate A\tMN2\t\t2\t'-1\tTobacco",
			"Tobacco mosaic virus\tIsolate A\tMN3\t\t2\t'@SUM(A1)\tTobacco",
		]);
	});

	it("prefixes a cell that begins with a tab", () => {
		expect(
			formatSequenceTable(
				getExportSequences(otu, [
					createFakeOtuIsolate({
						sourceName: "A",
						sourceType: "isolate",
						sequences: [
							createFakeOtuSequence({
								accession: "MN1",
								definition: "\t=1",
								host: "Tobacco",
								segment: null,
								sequence: "AT",
							}),
						],
					}),
				]),
				"tsv",
			).split("\n")[1],
		).toBe("Tobacco mosaic virus\tIsolate A\tMN1\t\t2\t' =1\tTobacco");
	});

	it("leaves a plain value unchanged", () => {
		expect(formatSequenceTable(sequences, "tsv").split("\n")[3]).toBe(
			"Tobacco mosaic virus\tIsolate B|2\tMN3\t\t2\tRNA1\tPepper",
		);
	});
});

describe("formatIsolateTable", () => {
	it("writes one row per isolate with its accessions in segment order", () => {
		expect(formatIsolateTable(otu, isolates, "tsv").split("\n")).toEqual([
			"OTU\tIsolate\tDefault\tSequences\tAccessions",
			"Tobacco mosaic virus\tIsolate A\tYes\t2\tMN1; MN2",
			"Tobacco mosaic virus\tIsolate B|2\tNo\t1\tMN3",
		]);
	});
});

describe("formatExportFilename", () => {
	it("joins the parts, lower-cased with spaces replaced", () => {
		expect(
			formatExportFilename(
				["Tobacco mosaic virus", "Isolate A", "sequences"],
				"fa",
			),
		).toBe("tobacco_mosaic_virus.isolate_a.sequences.fa");
	});

	it("replaces unsafe characters and collapses underscores", () => {
		expect(
			formatExportFilename(["Virus: strain 1", "Isolate A/B", "table"], "csv"),
		).toBe("virus_strain_1.isolate_a_b.table.csv");
	});

	it.each(["\\", "*", "?", '"', "<", ">", "|", "\u0007"])(
		"replaces %j",
		(character) => {
			expect(formatExportFilename([`a${character}b`], "fa")).toBe("a_b.fa");
		},
	);
});

describe("describeExportRows", () => {
	it.each([
		[2, 5, 9, "2 isolates selected"],
		[0, 9, 9, "All 9 isolates"],
		[0, 5, 9, "5 of 9 isolates"],
		[1, 1, 1, "1 isolate selected"],
	])(
		"describes %i selected of %i shown and %i total",
		(selected, shown, total, expected) => {
			expect(describeExportRows(selected, shown, total, "isolate")).toBe(
				expected,
			);
		},
	);
});

describe("describeSelection", () => {
	it.each([
		[0, 9, 9, "9 isolates"],
		[0, 5, 9, "5 of 9 isolates"],
		[2, 5, 9, "2 selected · 5 of 9 isolates"],
	])(
		"describes %i selected of %i shown and %i total",
		(selected, shown, total, expected) => {
			expect(describeSelection(selected, shown, total, "isolate")).toBe(
				expected,
			);
		},
	);
});
