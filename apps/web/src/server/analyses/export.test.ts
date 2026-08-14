import type { JsonObject } from "@virtool/contracts";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { legacyOtus, legacySequences } from "@virtool/data/db/schema/otus";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { seedReference } from "@virtool/data/indexes/test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { formatAnalysisToCsv, formatAnalysisToExcel } from "./export";

let database: TestDatabase;
let db: Db;
let referenceId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;

	referenceId = await seedReference(db, await seedUser(db));
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(legacySequences);
	await db.delete(legacyOtus);
});

// The OTU is seeded at the version the analysis saw, so patching takes its
// already-at-target fast path and no history is needed here. The history-aware
// path is covered in `format.test.ts`.
async function seedOtu(isolates: Record<string, unknown>[]): Promise<void> {
	await db.insert(legacyOtus).values({
		id: "otu_one",
		data: {
			_id: "otu_one",
			abbreviation: "GLRaV3",
			name: 'Grapevine "leafroll" virus',
			reference: { id: referenceId },
			version: 2,
			isolates,
		},
		name: 'Grapevine "leafroll" virus',
		abbreviation: "GLRaV3",
		reference_id: referenceId,
		verified: true,
		version: 2,
	});

	await db.insert(legacySequences).values({
		id: "seq_a0",
		data: {
			_id: "seq_a0",
			accession: "NC_000001",
			definition: "Segment one",
			isolate_id: "iso_a",
			sequence: "ATGCATGCAT",
		},
		otu_id: "otu_one",
		isolate_id: "iso_a",
		position: 0,
	});
}

const NAMED_ISOLATE = [
	{ id: "iso_a", source_type: "isolate", source_name: "A" },
];

// A depth profile of [0, 3] has a median of 1.5 — an even-length input whose
// two middle values differ, so a rounded median would show as 2.
function results(): JsonObject {
	return {
		read_count: 1024,
		subtracted_count: 0,
		hits: [
			{
				id: "seq_a0",
				otu: { id: "otu_one", version: 2 },
				align: [0, 3],
				coverage: 0.25,
				final: { best: 12, pi: 0.5, reads: 30 },
			},
		],
	};
}

describe("formatAnalysisToCsv", () => {
	it("writes the header and one row per hit sequence", async () => {
		await seedOtu(NAMED_ISOLATE);

		const csv = await formatAnalysisToCsv(db, "pathoscope", results());

		expect(csv).toBe(
			'"OTU","Isolate","Sequence","Length","Weight","Median Depth","Coverage"\r\n' +
				'"Grapevine ""leafroll"" virus","Isolate A","NC_000001",10,0.5,1.5,0.25\r\n',
		);
	});

	it("takes the median depth from the raw alignment, unrounded", async () => {
		await seedOtu(NAMED_ISOLATE);

		const csv = await formatAnalysisToCsv(db, "pathoscope", results());

		// 1.5, not 2 and not 0: read from the raw `align` array before formatting
		// replaces it with simplified coordinates.
		expect(csv).toContain(",1.5,");
	});

	it("names an isolate missing either source field as unnamed", async () => {
		await seedOtu([{ id: "iso_a", source_type: "isolate", source_name: "" }]);

		const csv = await formatAnalysisToCsv(db, "pathoscope", results());

		expect(csv).toContain('"Unnamed Isolate"');
	});

	it("lower-cases a source type past its first character", async () => {
		await seedOtu([{ id: "iso_a", source_type: "ISOLATE", source_name: "A" }]);

		const csv = await formatAnalysisToCsv(db, "pathoscope", results());

		// Python composes the name with `str.capitalize`, which lower-cases the
		// remainder, so a shouted source type must not survive as written.
		expect(csv).toContain('"Isolate A"');
	});

	it("reports zero depth for a hit with an empty alignment", async () => {
		await seedOtu(NAMED_ISOLATE);

		const csv = await formatAnalysisToCsv(db, "pathoscope", {
			...results(),
			hits: [
				{
					id: "seq_a0",
					otu: { id: "otu_one", version: 2 },
					align: [],
					coverage: 0.25,
					final: { best: 12, pi: 0.5, reads: 30 },
				},
			],
		});

		// The median of nothing is not a number; a download must still carry a
		// figure rather than the string `NaN`.
		expect(csv).toContain(",0,");
		expect(csv).not.toContain("NaN");
	});

	it("writes only the header when nothing was hit", async () => {
		await seedOtu(NAMED_ISOLATE);

		const csv = await formatAnalysisToCsv(db, "pathoscope", {
			read_count: 0,
			hits: [],
		});

		expect(csv).toBe(
			'"OTU","Isolate","Sequence","Length","Weight","Median Depth","Coverage"\r\n',
		);
	});
});

describe("formatAnalysisToExcel", () => {
	it("writes a workbook carrying the same rows as the CSV", async () => {
		await seedOtu(NAMED_ISOLATE);

		const bytes = await formatAnalysisToExcel(
			db,
			"pathoscope",
			results(),
			"1234",
		);

		// An XLSX file is a zip, which always starts with the local file header.
		expect(bytes.subarray(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));

		const { Workbook } = await import("exceljs");
		const reader = new Workbook();

		// exceljs declares its own `Buffer` interface, which predates the one in
		// Node's typings. The bytes are the same.
		const workbook = await reader.xlsx.load(
			Buffer.from(bytes) as unknown as Parameters<typeof reader.xlsx.load>[0],
		);
		const sheet = workbook.getWorksheet("Pathoscope for 1234");

		expect(sheet).toBeDefined();

		const header = sheet?.getRow(1);
		expect(header?.getCell(1).value).toBe("OTU");
		expect(header?.getCell(7).value).toBe("Coverage");
		expect(header?.font?.bold).toBe(true);

		const row = sheet?.getRow(2);
		expect(row?.getCell(1).value).toBe('Grapevine "leafroll" virus');
		expect(row?.getCell(2).value).toBe("Isolate A");
		expect(row?.getCell(3).value).toBe("NC_000001");
		expect(row?.getCell(4).value).toBe(10);
		expect(row?.getCell(5).value).toBe(0.5);
		expect(row?.getCell(6).value).toBe(1.5);
		expect(row?.getCell(7).value).toBe(0.25);
	});
});
