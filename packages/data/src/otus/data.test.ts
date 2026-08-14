import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db, DbOrTx } from "../db/pg";
import { legacyOtus, legacySequences } from "../db/schema/otus";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { seedReference } from "../indexes/test/fixtures";
import { joinLegacyOtus, type OtuDocument } from "./data";

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

async function seedOtu(document: OtuDocument): Promise<void> {
	await db.insert(legacyOtus).values({
		id: document._id as string,
		data: document,
		name: document.name as string,
		abbreviation: "",
		reference_id: referenceId,
		verified: true,
		version: document.version as number,
	});
}

async function seedSequence(
	otuId: string,
	isolateId: string,
	sequenceId: string,
	position: number | null,
): Promise<void> {
	await db.insert(legacySequences).values({
		id: sequenceId,
		data: {
			_id: sequenceId,
			otu_id: otuId,
			isolate_id: isolateId,
			sequence: "ATGC",
		},
		otu_id: otuId,
		isolate_id: isolateId,
		segment: null,
		position,
	});
}

/**
 * A database handle that fails on any use, so a short-circuit that is supposed
 * to issue no query cannot quietly issue one.
 */
const unusableDb = new Proxy({} as DbOrTx, {
	get(_target, property) {
		throw new Error(`unexpected query: db.${String(property)}`);
	},
});

function isolatesOf(otu: OtuDocument): Record<string, unknown>[] {
	return otu.isolates as Record<string, unknown>[];
}

function sequenceIdsOf(isolate: Record<string, unknown>): unknown[] {
	return (isolate.sequences as Record<string, unknown>[]).map(
		(sequence) => sequence._id,
	);
}

describe("joinLegacyOtus", () => {
	it("buckets sequences into their isolates in position order", async () => {
		await seedOtu({
			_id: "otu_one",
			name: "Alpha",
			version: 3,
			lower_name: "alpha",
			reference: { id: referenceId },
			isolates: [
				{ id: "iso_a", source_type: "isolate", source_name: "A" },
				{ id: "iso_b", source_type: "isolate", source_name: "B" },
			],
		});

		// Inserted out of order so a join that leant on insertion order would fail.
		await seedSequence("otu_one", "iso_a", "seq_a2", 2);
		await seedSequence("otu_one", "iso_b", "seq_b1", 1);
		await seedSequence("otu_one", "iso_a", "seq_a0", 0);

		const joined = await joinLegacyOtus(db, ["otu_one"]);

		const otu = joined.get("otu_one");

		expect(otu).toBeDefined();
		expect(otu?.name).toBe("Alpha");
		// The verbatim `data` column, not the promoted columns: `lower_name` has no
		// column to be rebuilt from.
		expect(otu?.lower_name).toBe("alpha");

		const isolates = isolatesOf(otu as OtuDocument);

		expect(isolates).toHaveLength(2);
		expect(sequenceIdsOf(isolates[0] as Record<string, unknown>)).toEqual([
			"seq_a0",
			"seq_a2",
		]);
		expect(sequenceIdsOf(isolates[1] as Record<string, unknown>)).toEqual([
			"seq_b1",
		]);
	});

	it("gives an isolate with no sequences an empty list", async () => {
		await seedOtu({
			_id: "otu_one",
			name: "Alpha",
			version: 0,
			reference: { id: referenceId },
			isolates: [{ id: "iso_a" }, { id: "iso_empty" }],
		});

		await seedSequence("otu_one", "iso_a", "seq_a0", 0);

		const joined = await joinLegacyOtus(db, ["otu_one"]);
		const isolates = isolatesOf(joined.get("otu_one") as OtuDocument);

		expect(isolates[1]?.sequences).toEqual([]);
	});

	it("leaves a requested OTU with no row out of the map", async () => {
		await seedOtu({
			_id: "otu_one",
			name: "Alpha",
			version: 0,
			reference: { id: referenceId },
			isolates: [],
		});

		const joined = await joinLegacyOtus(db, ["otu_one", "otu_gone"]);

		expect([...joined.keys()]).toEqual(["otu_one"]);
		expect(joined.has("otu_gone")).toBe(false);
	});

	it("reads several OTUs in one call without mixing their sequences", async () => {
		await seedOtu({
			_id: "otu_one",
			name: "Alpha",
			version: 0,
			reference: { id: referenceId },
			isolates: [{ id: "iso_a" }],
		});
		await seedOtu({
			_id: "otu_two",
			name: "Beta",
			version: 0,
			reference: { id: referenceId },
			isolates: [{ id: "iso_b" }],
		});

		await seedSequence("otu_one", "iso_a", "seq_one", 0);
		await seedSequence("otu_two", "iso_b", "seq_two", 0);

		const joined = await joinLegacyOtus(db, ["otu_one", "otu_two"]);

		expect(
			sequenceIdsOf(
				isolatesOf(joined.get("otu_one") as OtuDocument)[0] as Record<
					string,
					unknown
				>,
			),
		).toEqual(["seq_one"]);
		expect(
			sequenceIdsOf(
				isolatesOf(joined.get("otu_two") as OtuDocument)[0] as Record<
					string,
					unknown
				>,
			),
		).toEqual(["seq_two"]);
	});

	it("keeps created_at as the ISO string the column holds", async () => {
		await seedOtu({
			_id: "otu_one",
			name: "Alpha",
			version: 0,
			created_at: "2023-06-01T12:00:00Z",
			reference: { id: referenceId },
			isolates: [],
		});

		const joined = await joinLegacyOtus(db, ["otu_one"]);

		expect(joined.get("otu_one")?.created_at).toBe("2023-06-01T12:00:00Z");
	});

	it("returns an empty map for no ids without querying", async () => {
		await expect(joinLegacyOtus(unusableDb, [])).resolves.toEqual(new Map());
	});
});
