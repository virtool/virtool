import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { legacyHistory, legacyHistoryDiff } from "../db/schema/history";
import { hmms } from "../db/schema/hmms";
import { legacyOtus, legacySequences } from "../db/schema/otus";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { AnalysisResultsError, formatAnalysis } from "./format";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(legacyHistoryDiff);
	await db.delete(legacyHistory);
	await db.delete(legacySequences);
	await db.delete(legacyOtus);
	await db.delete(hmms);
});

/**
 * A database handle that fails on any use, so a path that is supposed to issue
 * no query cannot quietly issue one.
 */
const unusableDb = new Proxy({} as DbOrTx, {
	get(_target, property) {
		throw new Error(`unexpected query: db.${String(property)}`);
	},
});

const REFERENCE_ID = 5;

async function seedHmm(values: {
	cluster: number;
	families: Record<string, number>;
	legacyId?: string | null;
	names: string[];
}): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(hmms)
			.values({
				cluster: values.cluster,
				count: 1,
				entries: [],
				families: values.families,
				genera: {},
				legacy_id: values.legacyId ?? null,
				length: 100,
				mean_entropy: 0.5,
				names: values.names,
				total_entropy: 50,
			})
			.returning({ id: hmms.id }),
	).id;
}

/** A NuVs results blob with one contig, one ORF, and one HMM hit. */
function nuvsResults(hitId: number | string) {
	return {
		hits: [
			{
				index: 0,
				sequence: "ATGCATGC",
				orfs: [
					{
						pos: [1, 8],
						strand: 1,
						hits: [{ hit: hitId, full_e: 1.2e-20 }],
					},
				],
			},
		],
	};
}

function firstOrfHit(
	results: Record<string, unknown>,
): Record<string, unknown> {
	const hits = results.hits as {
		orfs: { hits: Record<string, unknown>[] }[];
	}[];
	const hit = hits[0]?.orfs[0]?.hits[0];

	expect(hit).toBeTruthy();

	return hit as Record<string, unknown>;
}

describe("formatAnalysis for nuvs", () => {
	it("merges an annotation onto every orf hit", async () => {
		const hmmId = await seedHmm({
			cluster: 3,
			families: { Bromoviridae: 4 },
			names: ["Capsid protein", "CP"],
		});

		const results = await formatAnalysis(db, "nuvs", nuvsResults(hmmId));

		expect(firstOrfHit(results)).toEqual({
			hit: hmmId,
			full_e: 1.2e-20,
			cluster: 3,
			families: { Bromoviridae: 4 },
			names: ["Capsid protein", "CP"],
		});
	});

	it("resolves an annotation by its legacy Mongo string id", async () => {
		await seedHmm({
			cluster: 7,
			families: { Virgaviridae: 2 },
			legacyId: "abc123",
			names: ["Movement protein"],
		});

		const results = await formatAnalysis(db, "nuvs", nuvsResults("abc123"));

		expect(firstOrfHit(results)).toMatchObject({
			hit: "abc123",
			cluster: 7,
			names: ["Movement protein"],
		});
	});

	it("resolves integer and legacy string ids in the same blob", async () => {
		const modernId = await seedHmm({
			cluster: 3,
			families: {},
			names: ["Modern"],
		});
		await seedHmm({
			cluster: 7,
			families: {},
			legacyId: "abc123",
			names: ["Legacy"],
		});

		const results = await formatAnalysis(db, "nuvs", {
			hits: [
				{
					index: 0,
					orfs: [{ hits: [{ hit: modernId }] }, { hits: [{ hit: "abc123" }] }],
				},
			],
		});

		const orfs = (
			results.hits as { orfs: { hits: { names: string[] }[] }[] }[]
		)[0]?.orfs;

		expect(orfs?.[0]?.hits[0]?.names).toEqual(["Modern"]);
		expect(orfs?.[1]?.hits[0]?.names).toEqual(["Legacy"]);
	});

	it("resolves a legacy Mongo string id made only of digits", async () => {
		// A Mongo id is alphanumeric, so it can come out all digits and be
		// indistinguishable from a modern integer id.
		await seedHmm({
			cluster: 9,
			families: {},
			legacyId: "80412357",
			names: ["All digits"],
		});

		const results = await formatAnalysis(db, "nuvs", nuvsResults("80412357"));

		expect(firstOrfHit(results)).toMatchObject({
			hit: "80412357",
			cluster: 9,
			names: ["All digits"],
		});
	});

	it("prefers the modern id when a legacy id has the same digits", async () => {
		const modernId = await seedHmm({
			cluster: 3,
			families: {},
			names: ["Modern"],
		});
		await seedHmm({
			cluster: 7,
			families: {},
			legacyId: String(modernId),
			names: ["Legacy"],
		});

		const results = await formatAnalysis(db, "nuvs", nuvsResults(modernId));

		expect(firstOrfHit(results)).toMatchObject({ names: ["Modern"] });
	});

	it("throws when a hit names an annotation that no longer exists", async () => {
		await expect(
			formatAnalysis(db, "nuvs", nuvsResults(123456)),
		).rejects.toBeInstanceOf(AnalysisResultsError);
	});

	it("passes results with no hits through without querying", async () => {
		const results = { hits: [], read_count: 12 };

		await expect(formatAnalysis(unusableDb, "nuvs", results)).resolves.toEqual(
			results,
		);
	});

	it("passes hits with no annotated orfs through without querying", async () => {
		const results = { hits: [{ index: 0, sequence: "ATGC", orfs: [] }] };

		await expect(formatAnalysis(unusableDb, "nuvs", results)).resolves.toEqual(
			results,
		);
	});
});

// A pathoscope fixture whose OTU has since been renamed and re-abbreviated. The
// analysis recorded version 2; the live OTU is at version 3.
const CURRENT_NAME = "Cucumber mosaic virus";
const ANALYSED_NAME = "Cucumber mosaic tobamovirus";
const CURRENT_ABBREVIATION = "CMV";
const ANALYSED_ABBREVIATION = "CuMV";

async function seedDetectedOtu(): Promise<void> {
	await db.insert(legacyOtus).values({
		id: "otu_one",
		data: {
			_id: "otu_one",
			abbreviation: CURRENT_ABBREVIATION,
			name: CURRENT_NAME,
			reference: { id: REFERENCE_ID },
			version: 3,
			isolates: [
				{ id: "iso_a", source_type: "isolate", source_name: "A" },
				{ id: "iso_b", source_type: "isolate", source_name: "B" },
			],
		},
		name: CURRENT_NAME,
		abbreviation: CURRENT_ABBREVIATION,
		reference_id: REFERENCE_ID,
		verified: true,
		version: 3,
	});

	await db.insert(legacySequences).values([
		{
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
		},
		{
			// The longest sequence in the OTU, and one the analysis recorded no hit
			// against. It fixes `length` without appearing in the formatted result.
			id: "seq_a1",
			data: {
				_id: "seq_a1",
				accession: "NC_000002",
				definition: "Segment two",
				isolate_id: "iso_a",
				sequence: "ATGCATGCATGC",
			},
			otu_id: "otu_one",
			isolate_id: "iso_a",
			position: 1,
		},
		{
			id: "seq_b0",
			data: {
				_id: "seq_b0",
				accession: "NC_000003",
				definition: "Segment three",
				isolate_id: "iso_b",
				sequence: "AT",
			},
			otu_id: "otu_one",
			isolate_id: "iso_b",
			position: 2,
		},
	]);

	const change = takeFirstOrThrow(
		await db
			.insert(legacyHistory)
			.values({
				created_at: new Date(),
				description: "Renamed",
				index_id: null,
				legacy_id: "otu_one.3",
				method_name: "edit",
				otu: "otu_one",
				otu_name: CURRENT_NAME,
				otu_version: "3",
				reference_id: REFERENCE_ID,
				user_id: 1,
			})
			.returning({ id: legacyHistory.id }),
	);

	await db.insert(legacyHistoryDiff).values({
		history_id: change.id,
		diff: [
			["change", "name", [ANALYSED_NAME, CURRENT_NAME]],
			["change", "abbreviation", [ANALYSED_ABBREVIATION, CURRENT_ABBREVIATION]],
			["change", "version", [2, 3]],
		],
	});
}

/** Pathoscope results with one hit, against `seq_a0` at OTU version 2. */
function pathoscopeResults() {
	return {
		read_count: 1024,
		hits: [
			{
				id: "seq_a0",
				otu: { id: "otu_one", version: 2 },
				align: [1, 1, 1, 5],
				coverage: 0.75,
				final: { best: 12, pi: 0.5, reads: 30 },
			},
		],
	};
}

type FormattedOtu = {
	id: string;
	abbreviation: unknown;
	name: unknown;
	version: unknown;
	length: number;
	isolates: { id: string; sequences: Record<string, unknown>[] }[];
};

async function formatPathoscope(
	workflow = "pathoscope",
): Promise<FormattedOtu> {
	const results = await formatAnalysis(db, workflow, pathoscopeResults());
	const [otu] = results.hits as FormattedOtu[];

	expect(otu).toBeTruthy();

	return otu as FormattedOtu;
}

describe("formatAnalysis for pathoscope", () => {
	beforeEach(seedDetectedOtu);

	it("carries the OTU as it was at the analysed version, not as it is now", async () => {
		const otu = await formatPathoscope();

		expect(otu.id).toBe("otu_one");
		expect(otu.name).toBe(ANALYSED_NAME);
		expect(otu.abbreviation).toBe(ANALYSED_ABBREVIATION);
		expect(otu.version).toBe(2);

		// The live OTU says otherwise, which is the whole point of the patching.
		expect(otu.name).not.toBe(CURRENT_NAME);
		expect(otu.abbreviation).not.toBe(CURRENT_ABBREVIATION);
	});

	it("preserves the keys the workflow wrote alongside the hits", async () => {
		const results = await formatAnalysis(db, "pathoscope", pathoscopeResults());

		expect(results.read_count).toBe(1024);
	});

	it("drops an isolate with no matching hit", async () => {
		const otu = await formatPathoscope();

		expect(otu.isolates.map((isolate) => isolate.id)).toEqual(["iso_a"]);
		expect(otu.isolates[0]?.sequences.map((sequence) => sequence.id)).toEqual([
			"seq_a0",
		]);
	});

	it("reports the longest sequence in the OTU as its length", async () => {
		const otu = await formatPathoscope();

		// `seq_a1` is 12 bases and matched no hit; the hit sequence is only 10.
		expect(otu.length).toBe(12);
	});

	it("converts align to coordinates and folds in the hit metrics", async () => {
		const otu = await formatPathoscope();

		expect(otu.isolates[0]?.sequences[0]).toEqual({
			id: "seq_a0",
			accession: "NC_000001",
			align: [
				[0, 1],
				[2, 1],
				[3, 5],
			],
			best: 12,
			coverage: 0.75,
			definition: "Segment one",
			length: 10,
			pi: 0.5,
			reads: 30,
		});
	});

	it("leaves align null when the hit recorded none", async () => {
		const results = await formatAnalysis(db, "pathoscope", {
			hits: [
				{
					id: "seq_a0",
					otu: { id: "otu_one", version: 2 },
					coverage: 0,
					final: {},
				},
			],
		});

		const [otu] = results.hits as FormattedOtu[];
		const sequence = otu?.isolates[0]?.sequences[0];

		expect(sequence?.align).toBeNull();
		expect(sequence?.best).toBe(0);
		expect(sequence?.pi).toBe(0);
		expect(sequence?.reads).toBe(0);
	});

	it("throws when a hit is missing its OTU", async () => {
		await expect(
			formatAnalysis(db, "pathoscope", { hits: [{ id: "seq_a0" }] }),
		).rejects.toBeInstanceOf(AnalysisResultsError);
	});

	it("throws when a hit's OTU version is not an integer", async () => {
		await expect(
			formatAnalysis(db, "pathoscope", {
				hits: [{ id: "seq_a0", otu: { id: "otu_one", version: "two" } }],
			}),
		).rejects.toBeInstanceOf(AnalysisResultsError);
	});

	it("throws when an OTU cannot be patched to the analysed version", async () => {
		await expect(
			formatAnalysis(db, "pathoscope", {
				hits: [{ id: "seq_x", otu: { id: "otu_missing", version: 1 } }],
			}),
		).rejects.toBeInstanceOf(AnalysisResultsError);
	});
});

describe("formatAnalysis dispatch", () => {
	it("throws for an unknown workflow", async () => {
		await expect(
			formatAnalysis(unusableDb, "aodp", { hits: [] }),
		).rejects.toBeInstanceOf(AnalysisResultsError);
	});

	it("takes the pathoscope path for a workflow name that merely contains it", async () => {
		await seedDetectedOtu();

		const otu = await formatPathoscope("pathoscope_bowtie");

		expect(otu.name).toBe(ANALYSED_NAME);
		expect(otu.version).toBe(2);
	});
});
