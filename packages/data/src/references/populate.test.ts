import { createLogger, type Logger } from "@virtool/logger";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { legacyHistory, legacyHistoryDiff } from "../db/schema/history";
import { legacyOtus, legacySequences } from "../db/schema/otus";
import {
	legacyReferences,
	legacyReferenceUsers,
} from "../db/schema/references";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { diff } from "../history/dictdiffer";
import { type OtuDocument, verify } from "../otus/data";
import { populateClonedReference, ReferenceManifestError } from "./populate";

const logger: Logger = createLogger({ name: "test", level: "silent" });

let database: TestDatabase;
let db: Db;
let userId: number;
let sourceId: number;
let cloneId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

const CLONE_CREATED_AT = new Date("2024-03-01T12:00:00.000Z");

beforeEach(async () => {
	await db.delete(legacyHistoryDiff);
	await db.delete(legacyHistory);
	await db.delete(legacySequences);
	await db.delete(legacyOtus);
	await db.delete(legacyReferenceUsers);
	await db.delete(legacyReferences);
	await db.delete(users);

	userId = await seedUser(db, { handle: "curator" });
	sourceId = await seedSourceReference("Source", new Date("2020-01-01"));
	cloneId = await seedSourceReference("Clone of Source", CLONE_CREATED_AT);
});

async function seedSourceReference(
	name: string,
	createdAt: Date,
): Promise<number> {
	const [row] = await db
		.insert(legacyReferences)
		.values({
			name,
			description: "",
			organism: "virus",
			created_at: createdAt,
			archived: false,
			restrict_source_types: false,
			source_types: [],
			user_id: userId,
		})
		.returning({ id: legacyReferences.id });

	if (row === undefined) {
		throw new Error("failed to seed a reference");
	}

	return row.id;
}

type SeededSequence = {
	id: string;
	accession?: string;
	sequence?: string;
	segment?: string;
};

type SeededIsolate = {
	id: string;
	sequences: SeededSequence[];
	extra?: Record<string, unknown>;
};

/**
 * Insert a source OTU and its sequences the way the write paths hold them: the
 * document in `legacy_otus.data` with its isolates carrying no sequences, and
 * one `legacy_sequences` row per sequence, numbered within the OTU.
 */
async function seedOtu(
	referenceId: number,
	{
		id,
		name = `OTU ${id}`,
		abbreviation = "",
		isolates = [],
		version = 0,
	}: {
		id: string;
		name?: string;
		abbreviation?: string;
		isolates?: SeededIsolate[];
		version?: number;
	},
): Promise<void> {
	await db.insert(legacyOtus).values({
		id,
		data: {
			_id: id,
			name,
			abbreviation,
			lower_name: name.toLowerCase(),
			isolates: isolates.map((isolate) => ({
				id: isolate.id,
				default: true,
				source_type: "isolate",
				source_name: isolate.id,
				...isolate.extra,
			})),
			last_indexed_version: null,
			reference: { id: referenceId },
			schema: [],
			verified: true,
			version,
		},
		name,
		abbreviation,
		reference_id: referenceId,
		verified: true,
		version,
	});

	let position = 0;

	for (const isolate of isolates) {
		for (const sequence of isolate.sequences) {
			await db.insert(legacySequences).values({
				id: sequence.id,
				data: {
					_id: sequence.id,
					accession: sequence.accession ?? `ACC${sequence.id}`,
					definition: "A definition",
					host: "",
					otu_id: id,
					isolate_id: isolate.id,
					reference: { id: referenceId },
					segment: sequence.segment ?? "",
					sequence: sequence.sequence ?? "ATGC",
				},
				otu_id: id,
				isolate_id: isolate.id,
				segment: sequence.segment ?? "",
				position,
			});

			position += 1;
		}
	}
}

async function readClonedOtus(): Promise<
	{ id: string; data: OtuDocument; verified: boolean; version: number }[]
> {
	return db
		.select({
			id: legacyOtus.id,
			data: legacyOtus.data,
			verified: legacyOtus.verified,
			version: legacyOtus.version,
		})
		.from(legacyOtus)
		.where(eq(legacyOtus.reference_id, cloneId));
}

function takeOne<T>(items: T[]): T {
	expect(items).toHaveLength(1);

	const [item] = items;

	if (item === undefined) {
		throw new Error("expected exactly one item");
	}

	return item;
}

describe("populateClonedReference", () => {
	it("clones every OTU in the manifest under fresh ids", async () => {
		await seedOtu(sourceId, {
			id: "src_otu_1",
			name: "Tobacco mosaic virus",
			abbreviation: "TMV",
			isolates: [{ id: "src_iso_1", sequences: [{ id: "src_seq_1" }] }],
		});

		await populateClonedReference(db, logger, {
			manifest: { src_otu_1: 0 },
			referenceId: cloneId,
			userId,
		});

		const cloned = takeOne(await readClonedOtus());

		expect(cloned.id).not.toBe("src_otu_1");
		expect(cloned.id).toHaveLength(8);
		expect(cloned.version).toBe(0);
		expect(cloned.verified).toBe(true);

		expect(cloned.data).toMatchObject({
			_id: cloned.id,
			imported: true,
			last_indexed_version: null,
			lower_name: "tobacco mosaic virus",
			name: "Tobacco mosaic virus",
			reference: { id: cloneId },
			remote: { id: "src_otu_1" },
			user: { id: userId },
			verified: true,
			version: 0,
		});

		// The OTUs are stamped with the reference's own creation time, not the
		// instant the task happened to run.
		expect(cloned.data.created_at).toBe(CLONE_CREATED_AT.toISOString());

		const [isolate] = cloned.data.isolates as Record<string, unknown>[];

		expect(isolate?.id).not.toBe("src_iso_1");
		expect(isolate?.id).toHaveLength(12);

		const clonedSequence = takeOne(
			await db
				.select()
				.from(legacySequences)
				.where(eq(legacySequences.otu_id, cloned.id)),
		);

		expect(clonedSequence.id).not.toBe("src_seq_1");
		expect(clonedSequence.id).toHaveLength(12);
		expect(clonedSequence.data).toMatchObject({
			isolate_id: isolate?.id,
			otu_id: cloned.id,
			reference: { id: cloneId },
			remote: { id: "src_seq_1" },
		});

		// The source is untouched.
		expect(
			await db
				.select({ id: legacyOtus.id })
				.from(legacyOtus)
				.where(eq(legacyOtus.reference_id, sourceId)),
		).toHaveLength(1);
	});

	it("clones an OTU at the version the manifest pins it to", async () => {
		const isolate = {
			id: "src_iso_1",
			default: true,
			source_type: "isolate",
			source_name: "src_iso_1",
		};

		const firstSequence = {
			_id: "src_seq_1",
			accession: "ACCsrc_seq_1",
			definition: "A definition",
			host: "",
			otu_id: "src_otu_1",
			isolate_id: "src_iso_1",
			reference: { id: sourceId },
			segment: "",
			sequence: "ATGC",
		};

		const secondSequence = { ...firstSequence, _id: "src_seq_2" };

		await seedOtu(sourceId, {
			id: "src_otu_1",
			name: "Tobacco mosaic virus",
			isolates: [
				{
					id: "src_iso_1",
					sequences: [{ id: "src_seq_1" }, { id: "src_seq_2" }],
				},
			],
			version: 2,
		});

		const atVersionOne = {
			_id: "src_otu_1",
			name: "Tobacco mosaic virus",
			abbreviation: "",
			lower_name: "tobacco mosaic virus",
			isolates: [{ ...isolate, sequences: [firstSequence] }],
			last_indexed_version: null,
			reference: { id: sourceId },
			schema: [],
			verified: true,
			version: 1,
		};

		const atVersionTwo = {
			...atVersionOne,
			isolates: [{ ...isolate, sequences: [firstSequence, secondSequence] }],
			version: 2,
		};

		const [change] = await db
			.insert(legacyHistory)
			.values({
				legacy_id: "src_otu_1.2",
				created_at: new Date(),
				description: "Created new sequence",
				method_name: "create_sequence",
				user_id: userId,
				otu: "src_otu_1",
				otu_name: "Tobacco mosaic virus",
				otu_version: "2",
				reference_id: sourceId,
			})
			.returning({ id: legacyHistory.id });

		await db.insert(legacyHistoryDiff).values({
			change_id: "src_otu_1.2",
			history_id: change?.id,
			diff: diff(atVersionOne, atVersionTwo),
		});

		await populateClonedReference(db, logger, {
			manifest: { src_otu_1: 1 },
			referenceId: cloneId,
			userId,
		});

		const cloned = takeOne(await readClonedOtus());

		expect(
			await db
				.select({ id: legacySequences.id })
				.from(legacySequences)
				.where(eq(legacySequences.otu_id, cloned.id)),
		).toHaveLength(1);
	});

	it("numbers each OTU's sequences from zero however the chunks fall", async () => {
		for (const index of [1, 2, 3]) {
			await seedOtu(sourceId, {
				id: `src_otu_${index}`,
				isolates: [
					{
						id: `src_iso_${index}`,
						sequences: [
							{ id: `src_seq_${index}a` },
							{ id: `src_seq_${index}b` },
							{ id: `src_seq_${index}c` },
						],
					},
				],
			});
		}

		await populateClonedReference(db, logger, {
			manifest: { src_otu_1: 0, src_otu_2: 0, src_otu_3: 0 },
			referenceId: cloneId,
			userId,
			// Two OTUs then one, so the second chunk starts its numbering afresh.
			chunkSize: 2,
		});

		const cloned = await readClonedOtus();

		expect(cloned).toHaveLength(3);

		for (const otu of cloned) {
			const rows = await db
				.select({ position: legacySequences.position })
				.from(legacySequences)
				.where(eq(legacySequences.otu_id, otu.id))
				.orderBy(legacySequences.position);

			expect(rows.map((row) => row.position)).toEqual([0, 1, 2]);
		}
	});

	it("prunes an isolate to the keys a clone keeps and lifts its sequences out", async () => {
		await seedOtu(sourceId, {
			id: "src_otu_1",
			isolates: [
				{
					id: "src_iso_1",
					sequences: [{ id: "src_seq_1" }],
					extra: { restrict_source_types: true, legacy_note: "drop me" },
				},
			],
		});

		await populateClonedReference(db, logger, {
			manifest: { src_otu_1: 0 },
			referenceId: cloneId,
			userId,
		});

		const cloned = takeOne(await readClonedOtus());
		const [isolate] = cloned.data.isolates as Record<string, unknown>[];

		expect(Object.keys(isolate ?? {}).sort()).toEqual([
			"default",
			"id",
			"source_name",
			"source_type",
		]);
	});

	it("records the issues and verified flag verify reports", async () => {
		await seedOtu(sourceId, {
			id: "src_otu_1",
			isolates: [{ id: "src_iso_1", sequences: [] }],
		});

		await populateClonedReference(db, logger, {
			manifest: { src_otu_1: 0 },
			referenceId: cloneId,
			userId,
		});

		const cloned = takeOne(await readClonedOtus());
		const [isolate] = cloned.data.isolates as Record<string, unknown>[];

		expect(cloned.verified).toBe(false);
		expect(cloned.data.verified).toBe(false);
		expect(cloned.data.issues).toEqual(
			verify({
				...cloned.data,
				isolates: [{ ...isolate, sequences: [] }],
			}),
		);
		expect(cloned.data.issues).toMatchObject({
			emptyIsolate: [isolate?.id],
			emptyOtu: false,
		});
	});

	it("records one clone change per OTU, diffed from nothing", async () => {
		await seedOtu(sourceId, {
			id: "src_otu_1",
			name: "Tobacco mosaic virus",
			abbreviation: "TMV",
			isolates: [{ id: "src_iso_1", sequences: [{ id: "src_seq_1" }] }],
		});

		await populateClonedReference(db, logger, {
			manifest: { src_otu_1: 0 },
			referenceId: cloneId,
			userId,
		});

		const cloned = takeOne(await readClonedOtus());

		const change = takeOne(
			await db
				.select()
				.from(legacyHistory)
				.where(eq(legacyHistory.reference_id, cloneId)),
		);

		expect(change).toMatchObject({
			legacy_id: `${cloned.id}.0`,
			description: "Cloned Tobacco mosaic virus (TMV)",
			method_name: "clone",
			otu: cloned.id,
			otu_name: "Tobacco mosaic virus",
			otu_version: "0",
			// Nothing has built the clone into an index yet.
			index_id: null,
			user_id: userId,
		});

		// The change is stamped when it is written; the OTU carries the reference's
		// own creation time.
		expect(change.created_at.toISOString()).not.toBe(
			CLONE_CREATED_AT.toISOString(),
		);

		const stored = takeOne(
			await db
				.select()
				.from(legacyHistoryDiff)
				.where(eq(legacyHistoryDiff.history_id, change.id)),
		);

		expect(stored.change_id).toBe(`${cloned.id}.0`);
		// A dictdiffer diff against nothing, not the bare document.
		expect(stored.diff).toEqual(diff(null, cloned.data));
	});

	it("deletes the reference and everything committed when a chunk fails", async () => {
		await seedOtu(sourceId, {
			id: "src_otu_1",
			isolates: [{ id: "src_iso_1", sequences: [{ id: "src_seq_1" }] }],
		});

		await expect(
			populateClonedReference(db, logger, {
				manifest: { src_otu_1: 0, src_otu_missing: 0 },
				referenceId: cloneId,
				userId,
				// The first OTU commits before the second is found to be unpatchable.
				chunkSize: 1,
			}),
		).rejects.toBeInstanceOf(ReferenceManifestError);

		expect(await readClonedOtus()).toHaveLength(0);

		expect(
			await db
				.select({ id: legacySequences.id })
				.from(legacySequences)
				.where(eq(legacySequences.otu_id, "src_seq_1")),
		).toHaveLength(0);

		expect(
			await db
				.select({ id: legacyHistory.id })
				.from(legacyHistory)
				.where(eq(legacyHistory.reference_id, cloneId)),
		).toHaveLength(0);

		expect(await db.select().from(legacyHistoryDiff)).toHaveLength(0);

		expect(
			await db
				.select({ id: legacyReferences.id })
				.from(legacyReferences)
				.where(eq(legacyReferences.id, cloneId)),
		).toHaveLength(0);

		// Only the clone goes; the reference it was cloned from is untouched.
		expect(
			await db
				.select({ id: legacyOtus.id })
				.from(legacyOtus)
				.where(eq(legacyOtus.reference_id, sourceId)),
		).toHaveLength(1);
	});

	it("does not double up when it runs again over a populated reference", async () => {
		await seedOtu(sourceId, {
			id: "src_otu_1",
			isolates: [{ id: "src_iso_1", sequences: [{ id: "src_seq_1" }] }],
		});

		await seedOtu(sourceId, {
			id: "src_otu_2",
			isolates: [{ id: "src_iso_2", sequences: [{ id: "src_seq_2" }] }],
		});

		const values = {
			manifest: { src_otu_1: 0, src_otu_2: 0 },
			referenceId: cloneId,
			userId,
		};

		await populateClonedReference(db, logger, values);
		await populateClonedReference(db, logger, values);

		expect(await readClonedOtus()).toHaveLength(2);

		expect(
			await db
				.select({ id: legacyHistory.id })
				.from(legacyHistory)
				.where(eq(legacyHistory.reference_id, cloneId)),
		).toHaveLength(2);

		expect(await db.select().from(legacyHistoryDiff)).toHaveLength(2);

		expect(
			await db.select({ id: legacySequences.id }).from(legacySequences),
		).toHaveLength(4);
	});

	it("reports progress that only rises, giving the insert the last quarter", async () => {
		const manifest: Record<string, number> = {};

		for (let index = 0; index < 10; index += 1) {
			const id = `src_otu_${index}`;

			await seedOtu(sourceId, {
				id,
				isolates: [
					{ id: `src_iso_${index}`, sequences: [{ id: `s${index}` }] },
				],
			});

			manifest[id] = 0;
		}

		const reported: number[] = [];

		await populateClonedReference(
			db,
			logger,
			{ manifest, referenceId: cloneId, userId },
			async (percent) => {
				reported.push(percent);
			},
		);

		expect(reported.length).toBeGreaterThan(1);

		for (const [index, percent] of reported.entries()) {
			expect(percent).toBeGreaterThanOrEqual(reported[index - 1] ?? 0);
		}

		// Patching runs to 1/1.3 of the bar, as Python's headroom leaves it.
		expect(reported[0]).toBeCloseTo((10 / 13) * 100, 5);
		expect(reported.at(-1)).toBe(100);
	});

	it("fails rather than cloning a reference that does not exist", async () => {
		await expect(
			populateClonedReference(db, logger, {
				manifest: {},
				referenceId: cloneId + 1000,
				userId,
			}),
		).rejects.toThrow();
	});
});
