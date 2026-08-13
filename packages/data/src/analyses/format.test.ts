import type { PathoscopeHit, PathoscopeResults } from "@virtool/contracts";
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
		const hmmId = await seedHmm({
			cluster: 7,
			families: { Virgaviridae: 2 },
			legacyId: "abc123",
			names: ["Movement protein"],
		});

		const results = await formatAnalysis(db, "nuvs", nuvsResults("abc123"));

		// The published `hit` is the row id, not the legacy string the blob
		// stores, because the client links an annotated ORF to `/hmms/{hit}`.
		expect(firstOrfHit(results)).toMatchObject({
			hit: hmmId,
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
		const hmmId = await seedHmm({
			cluster: 9,
			families: {},
			legacyId: "80412357",
			names: ["All digits"],
		});

		const results = await formatAnalysis(db, "nuvs", nuvsResults("80412357"));

		expect(firstOrfHit(results)).toMatchObject({
			hit: hmmId,
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

	it("shapes results with no hits without querying", async () => {
		await expect(
			formatAnalysis(unusableDb, "nuvs", { hits: [], read_count: 12 }),
		).resolves.toEqual({ hits: [], maxSequenceLength: 0 });
	});

	it("shapes hits with no annotated orfs without querying", async () => {
		const results = await formatAnalysis(unusableDb, "nuvs", {
			hits: [{ index: 0, sequence: "ATGC", orfs: [] }],
		});

		expect(results).toEqual({
			hits: [
				{
					annotatedOrfCount: 0,
					blast: null,
					e: null,
					families: [],
					id: 0,
					index: 0,
					names: [],
					orfs: [],
					sequence: "ATGC",
				},
			],
			maxSequenceLength: 4,
		});
	});

	it("derives the contig metrics from its annotated orfs", async () => {
		const hmmId = await seedHmm({
			cluster: 3,
			families: { Bromoviridae: 4, None: 1 },
			names: ["Capsid protein", "CP"],
		});

		const results = await formatAnalysis(db, "nuvs", {
			hits: [
				{
					index: 2,
					sequence: "ATGCATGC",
					orfs: [
						{ hits: [{ hit: hmmId, full_e: 4e-10 }] },
						{ hits: [{ hit: hmmId, full_e: 1.2e-20 }] },
					],
				},
			],
		});

		expect(results.hits).toMatchObject([
			{
				annotatedOrfCount: 2,
				// The lowest e-value across every orf hit.
				e: 1.2e-20,
				// `None` is the annotation data's way of saying "no family".
				families: ["Bromoviridae"],
				// A contig is identified by its index.
				id: 2,
				index: 2,
				names: ["Capsid protein", "CP"],
			},
		]);
	});

	it("counts an orf that matched nothing as an e-value of zero", async () => {
		const hmmId = await seedHmm({
			cluster: 3,
			families: {},
			names: ["Capsid protein"],
		});

		const results = await formatAnalysis(db, "nuvs", {
			hits: [
				{
					index: 0,
					sequence: "ATGCATGC",
					orfs: [{ hits: [{ hit: hmmId, full_e: 1.2e-20 }] }, { hits: [] }],
				},
			],
		});

		// Python scores an unmatched orf as zero and takes the minimum across all
		// of them, so one drags the whole contig down. Preserved deliberately: the
		// NuVs list sorts and filters on this figure.
		expect(results.hits).toMatchObject([{ annotatedOrfCount: 1, e: 0 }]);
	});

	it("reports the longest contig as the maximum sequence length", async () => {
		const results = await formatAnalysis(unusableDb, "nuvs", {
			hits: [
				{ index: 0, sequence: "ATGC", orfs: [] },
				{ index: 1, sequence: "ATGCATGCAT", orfs: [] },
				{ index: 2, sequence: "ATG", orfs: [] },
			],
		});

		expect(results.maxSequenceLength).toBe(10);
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
		subtracted_count: 96,
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

async function formatPathoscope(
	workflow = "pathoscope",
	results: Record<string, unknown> = pathoscopeResults(),
): Promise<PathoscopeHit> {
	const formatted = (await formatAnalysis(
		db,
		workflow,
		results,
	)) as PathoscopeResults;

	const [otu] = formatted.hits;

	expect(otu).toBeTruthy();

	return otu as PathoscopeHit;
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

	it("emits the workflow's totals in the casing the rest of the API uses", async () => {
		// The raw blob's `read_count` and `subtracted_count` are the worker's
		// contract, but this envelope is ours.
		const results = await formatAnalysis(db, "pathoscope", pathoscopeResults());

		expect(results).toMatchObject({ readCount: 1024, subtractedCount: 96 });
		expect(results).not.toHaveProperty("read_count");
	});

	it("reads a missing subtracted count as zero", async () => {
		const { subtracted_count, ...results } = pathoscopeResults();

		expect(subtracted_count).toBeDefined();

		await expect(
			formatAnalysis(db, "pathoscope", results),
		).resolves.toMatchObject({ subtractedCount: 0 });
	});

	it("drops an isolate with no matching hit", async () => {
		const otu = await formatPathoscope();

		expect(otu.isolates.map((isolate) => isolate.id)).toEqual(["iso_a"]);
		expect(otu.isolates[0]?.sequences.map((sequence) => sequence.id)).toEqual([
			"seq_a0",
		]);
	});

	it("names each isolate the way the exports do", async () => {
		const otu = await formatPathoscope();

		expect(otu.isolates[0]?.name).toBe("Isolate A");
	});

	it("reports no isolate as lacking a length-inferred segment", async () => {
		const otu = await formatPathoscope();

		// The OTU declares no schema, so its one segment is a bin over the sequences
		// that were hit. `seq_a1` was not, so nothing can say which bin it would have
		// fallen in — and the isolate is claimed neither to carry the segment nor to
		// lack it.
		expect(otu.segments.map((segment) => segment.key)).toEqual(["len:0"]);
		expect(otu.isolates[0]?.absentSegmentKeys).toEqual([]);
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
			// The OTU is unsegmented, so its one segment was inferred by length.
			segmentKey: "len:0",
		});
	});

	it("leaves align null when the hit recorded none", async () => {
		const otu = await formatPathoscope("pathoscope", {
			hits: [
				{
					id: "seq_a0",
					otu: { id: "otu_one", version: 2 },
					coverage: 0,
					final: {},
				},
			],
		});

		const sequence = otu.isolates[0]?.sequences[0];

		expect(sequence?.align).toBeNull();
		expect(sequence?.best).toBe(0);
		expect(sequence?.pi).toBe(0);
		expect(sequence?.reads).toBe(0);

		// A hit with no alignment covers nothing, rather than being absent from
		// the isolate it belongs to.
		expect(otu.isolates[0]).toMatchObject({
			coverage: 0,
			depth: 0,
			length: 10,
		});
	});

	it("derives the isolate metrics from the raw alignment", async () => {
		const otu = await formatPathoscope();

		// `align` is [1, 1, 1, 5] against a ten-base sequence, so the six
		// positions the workflow did not record are uncovered.
		expect(otu.isolates[0]).toMatchObject({
			coverage: 0.4,
			depth: 0,
			length: 10,
			pi: 0.5,
		});
	});

	it("derives the otu metrics from its isolates", async () => {
		const otu = await formatPathoscope();

		expect(otu).toMatchObject({
			coverage: 0.4,
			depth: 0,
			maxDepth: 5,
			pi: 0.5,
		});
	});

	it("merges the isolate curves into one polyline per segment", async () => {
		const otu = await formatPathoscope();

		// One isolate carrying one sequence, so the OTU has a single segment and its
		// curve is that isolate's — zero-padded to the full length of the sequence
		// the alignment fell short of.
		expect(otu.segments).toEqual([
			{
				align: [
					[0, 1],
					[2, 1],
					[3, 5],
					[4, 0],
					[9, 0],
				],
				detected: true,
				key: "len:0",
				length: 10,
				name: null,
			},
		]);
	});

	it("aggregates an otu over every isolate that was hit", async () => {
		// `seq_b0` is two bases and fully covered; `seq_a0` is ten and covered at
		// four, so the two isolates disagree on every metric.
		const otu = await formatPathoscope("pathoscope", {
			read_count: 1024,
			hits: [
				{
					id: "seq_a0",
					otu: { id: "otu_one", version: 2 },
					align: [1, 1, 1, 5],
					coverage: 0.4,
					final: { best: 12, pi: 0.5, reads: 30 },
				},
				{
					id: "seq_b0",
					otu: { id: "otu_one", version: 2 },
					align: [2, 2],
					coverage: 1,
					final: { best: 4, pi: 0.25, reads: 10 },
				},
			],
		});

		// Highest coverage first, which is the order the detail view reads down.
		expect(otu.isolates.map((isolate) => isolate.id)).toEqual([
			"iso_b",
			"iso_a",
		]);

		expect(otu).toMatchObject({
			// The best any isolate managed, not the average.
			coverage: 1,
			maxDepth: 5,
			pi: 0.75,
		});

		// Both isolates carry one sequence, so however far the two lengths diverge
		// there is one segment for them to share — and each position of it takes the
		// greatest depth either isolate recorded there.
		expect(otu.segments).toHaveLength(1);
		expect(otu.segments[0]).toEqual({
			align: [
				[0, 2],
				[1, 2],
				[2, 1],
				[3, 5],
				[4, 0],
				[9, 0],
			],
			detected: true,
			key: "len:0",
			// The segment spans the longest sequence filling it.
			length: 10,
			name: null,
		});
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

// An OTU with a two-segment schema. `iso_c` carries both segments and `iso_d`
// carries only L, which is the case that used to shift every position after the
// gap and merge the rest of the isolate against the wrong loci.
async function seedSegmentedOtu(): Promise<void> {
	const name = "Tomato spotted wilt virus";

	await db.insert(legacyOtus).values({
		id: "otu_two",
		data: {
			_id: "otu_two",
			abbreviation: "TSWV",
			name,
			reference: { id: REFERENCE_ID },
			schema: [
				{ molecule: "ssRNA", name: "L", required: true },
				{ molecule: "ssRNA", name: "M", required: true },
				{ molecule: "ssRNA", name: "S", required: false },
			],
			version: 1,
			isolates: [
				{ id: "iso_c", source_type: "isolate", source_name: "C" },
				{ id: "iso_d", source_type: "isolate", source_name: "D" },
			],
		},
		name,
		abbreviation: "TSWV",
		reference_id: REFERENCE_ID,
		verified: true,
		version: 1,
	});

	await db.insert(legacySequences).values([
		{
			id: "seq_c_l",
			data: {
				_id: "seq_c_l",
				accession: "NC_L_C",
				definition: "L segment",
				isolate_id: "iso_c",
				segment: "L",
				sequence: "ATGCATGCAT",
			},
			otu_id: "otu_two",
			isolate_id: "iso_c",
			segment: "L",
			position: 0,
		},
		{
			id: "seq_c_s",
			data: {
				_id: "seq_c_s",
				accession: "NC_S_C",
				definition: "S segment",
				isolate_id: "iso_c",
				segment: "S",
				sequence: "ATGC",
			},
			otu_id: "otu_two",
			isolate_id: "iso_c",
			segment: "S",
			position: 1,
		},
		{
			// Declared, carried, and never hit. It fixes the M segment's width without
			// appearing in the formatted result.
			id: "seq_c_m",
			data: {
				_id: "seq_c_m",
				accession: "NC_M_C",
				definition: "M segment",
				isolate_id: "iso_c",
				segment: "M",
				sequence: "ATGCATGCATGCATGCATGCATGCATGCAT",
			},
			otu_id: "otu_two",
			isolate_id: "iso_c",
			segment: "M",
			position: 3,
		},
		{
			id: "seq_d_l",
			data: {
				_id: "seq_d_l",
				accession: "NC_L_D",
				definition: "L segment",
				isolate_id: "iso_d",
				segment: "L",
				sequence: "ATGCATGCAT",
			},
			otu_id: "otu_two",
			isolate_id: "iso_d",
			segment: "L",
			position: 2,
		},
	]);
}

describe("formatAnalysis for a segmented pathoscope hit", () => {
	beforeEach(seedSegmentedOtu);

	function segmentedResults() {
		const otu = { id: "otu_two", version: 1 };

		return {
			read_count: 1024,
			hits: [
				{
					id: "seq_c_l",
					otu,
					align: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
					coverage: 1,
					final: { best: 12, pi: 0.5, reads: 30 },
				},
				{
					id: "seq_c_s",
					otu,
					align: [4, 4, 4, 4],
					coverage: 1,
					final: { best: 8, pi: 0.2, reads: 12 },
				},
				{
					id: "seq_d_l",
					otu,
					align: [9, 9],
					coverage: 0.2,
					final: { best: 4, pi: 0.1, reads: 6 },
				},
			],
		};
	}

	it("emits one segment per schema segment, in schema order", async () => {
		const otu = await formatPathoscope("pathoscope", segmentedResults());

		expect(
			otu.segments.map((segment) => [segment.name, segment.length]),
		).toEqual([
			["L", 10],
			// Nothing mapped to M, so it takes its width from the sequence the OTU
			// declares for it rather than from a curve.
			["M", 30],
			["S", 4],
		]);

		expect(otu.segments.map((segment) => segment.detected)).toEqual([
			true,
			false,
			true,
		]);
	});

	it("draws no curve for a segment nothing mapped to", async () => {
		const otu = await formatPathoscope("pathoscope", segmentedResults());

		expect(otu.segments[1]).toMatchObject({ align: [], detected: false });
	});

	it("leaves a segment nothing mapped to out of the depth figures", async () => {
		const otu = await formatPathoscope("pathoscope", segmentedResults());

		// The fourteen positions L and S were measured across have a median depth of
		// one. M is thirty positions long, so counting it as a zero-filled genome
		// would outvote them all and report the OTU at zero.
		expect(otu.depth).toBe(1);
	});

	it("merges a segment across only the isolates that carry it", async () => {
		const otu = await formatPathoscope("pathoscope", segmentedResults());

		// L is held by both isolates, so its first two positions take `iso_d`'s
		// deeper reads and the rest keep `iso_c`'s.
		expect(otu.segments[0]?.align).toEqual([
			[0, 9],
			[1, 9],
			[2, 1],
			[9, 1],
		]);

		// S is held by `iso_c` alone. Merging it against `iso_d` — which has no S —
		// would read that isolate's L segment at these positions.
		expect(otu.segments[2]?.align).toEqual([
			[0, 4],
			[3, 4],
		]);
	});

	it("names the segment each isolate's sequences fill", async () => {
		const otu = await formatPathoscope("pathoscope", segmentedResults());

		const keys = new Map(
			otu.isolates.map((isolate) => [
				isolate.name,
				isolate.sequences.map((sequence) => sequence.segmentKey),
			]),
		);

		// No key for M: the sequence exists in the reference but recorded no hit, so
		// it is not part of the result.
		expect(keys.get("Isolate C")).toEqual(["seg:L", "seg:S"]);

		// The isolate with no S sequence names only L, so the detail view can leave
		// the S column empty rather than sliding L into it.
		expect(keys.get("Isolate D")).toEqual(["seg:L"]);
	});

	it("reports the segments each isolate declares no sequence for", async () => {
		const otu = await formatPathoscope("pathoscope", segmentedResults());

		const absent = new Map(
			otu.isolates.map((isolate) => [isolate.name, isolate.absentSegmentKeys]),
		);

		// `iso_c` declares all three. Its M sequence recorded no hit, so it is missing
		// from `sequences` — but the isolate carries it, and saying otherwise is the
		// claim this list exists to stop.
		expect(absent.get("Isolate C")).toEqual([]);

		// `iso_d` declares L alone, so M and S really are not in it.
		expect(absent.get("Isolate D")).toEqual(["seg:M", "seg:S"]);
	});

	it("reads the declared segments at the analysed version, not from the hits", async () => {
		const results = segmentedResults();

		// Drop `iso_c`'s S hit, leaving it detected on L alone. Its S sequence is
		// still declared, so the isolate must not be reported as lacking it — a rule
		// reading the hits would have no way to tell.
		results.hits = results.hits.filter((hit) => hit.id !== "seq_c_s");

		const otu = await formatPathoscope("pathoscope", results);

		const isolate = otu.isolates.find((entry) => entry.name === "Isolate C");

		expect(isolate?.sequences.map((sequence) => sequence.segmentKey)).toEqual([
			"seg:L",
		]);
		expect(isolate?.absentSegmentKeys).toEqual([]);
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
