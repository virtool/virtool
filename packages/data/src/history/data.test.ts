import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { legacyHistory, legacyHistoryDiff } from "../db/schema/history";
import { legacyOtus, legacySequences } from "../db/schema/otus";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import type { OtuDocument } from "../otus/data";
import {
	MissingHistoryDiffError,
	otuSpecifierKey,
	patchOtusToVersions,
	UnbackfilledHistoryDiffError,
} from "./data";

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
});

/**
 * A database handle that fails on any use, so a short-circuit that is supposed
 * to issue no query cannot quietly issue one.
 */
const unusableDb = new Proxy({} as DbOrTx, {
	get(_target, property) {
		throw new Error(`unexpected query: db.${String(property)}`);
	},
});

async function seedOtu(document: OtuDocument): Promise<void> {
	await db.insert(legacyOtus).values({
		id: document._id as string,
		data: document,
		name: document.name as string,
		abbreviation: "",
		reference_id: 5,
		verified: true,
		version: document.version as number,
	});
}

async function seedSequence(
	otuId: string,
	isolateId: string,
	sequenceId: string,
	position: number,
): Promise<void> {
	await db.insert(legacySequences).values({
		id: sequenceId,
		data: {
			_id: sequenceId,
			otu_id: otuId,
			isolate_id: isolateId,
			// A stale legacy reference, as a historical snapshot carries. The patch
			// restamps it with the authoritative id.
			reference: { id: "stale" },
			sequence: "ATGC",
		},
		otu_id: otuId,
		isolate_id: isolateId,
		segment: null,
		position,
	});
}

async function seedChange(values: {
	otu: string;
	otuVersion: string | null;
	methodName: string;
	referenceId?: number;
}): Promise<number> {
	const row = takeFirstOrThrow(
		await db
			.insert(legacyHistory)
			.values({
				legacy_id: `${values.otu}.${values.otuVersion ?? "removed"}`,
				created_at: new Date(),
				description: "a change",
				method_name: values.methodName,
				user_id: 1,
				otu: values.otu,
				otu_name: values.otu,
				otu_version: values.otuVersion,
				reference_id: values.referenceId ?? 5,
				index_id: null,
			})
			.returning({ id: legacyHistory.id }),
	);

	return row.id;
}

async function seedDiff(historyId: number, diff: unknown): Promise<void> {
	await db.insert(legacyHistoryDiff).values({ history_id: historyId, diff });
}

// The dictdiffer diff Python's `calculate_diff` writes for a rename, serialized
// to JSONB. Reverting it swaps the pair back.
function renameDiff(
	from: string,
	to: string,
	fromVersion: number,
): [string, string, unknown][] {
	return [
		["change", "name", [from, to]],
		["change", "version", [fromVersion, fromVersion + 1]],
	];
}

function expectPatched(
	patched: Map<string, OtuDocument | null>,
	otuId: string,
	version: number,
): OtuDocument {
	const otu = patched.get(otuSpecifierKey(otuId, version));

	expect(otu).toBeTruthy();

	return otu as OtuDocument;
}

// An OTU at version 3, renamed at each of versions 2 and 3, with one sequence.
async function seedRenamedOtu(): Promise<void> {
	await seedOtu({
		_id: "otu_one",
		name: "Gamma",
		version: 3,
		reference: { id: 5 },
		isolates: [{ id: "iso_a", source_type: "isolate", source_name: "A" }],
	});

	await seedSequence("otu_one", "iso_a", "seq_a0", 0);

	await seedDiff(
		await seedChange({ otu: "otu_one", otuVersion: "3", methodName: "edit" }),
		renameDiff("Beta", "Gamma", 2),
	);
	await seedDiff(
		await seedChange({ otu: "otu_one", otuVersion: "2", methodName: "edit" }),
		renameDiff("Alpha", "Beta", 1),
	);
}

describe("patchOtusToVersions", () => {
	it("returns an empty map for no specifiers without querying", async () => {
		await expect(patchOtusToVersions(unusableDb, [])).resolves.toEqual(
			new Map(),
		);
	});

	it("returns the joined OTU when it is already at the target version", async () => {
		await seedOtu({
			_id: "otu_one",
			name: "Gamma",
			version: 3,
			reference: { id: 5 },
			isolates: [{ id: "iso_a" }],
		});

		await seedSequence("otu_one", "iso_a", "seq_a0", 0);

		// A change above the target with no diff row to revert it with. The fast
		// path never reads history, so this stays untouched; a regression that
		// dropped it would fail on the missing diff.
		await seedChange({ otu: "otu_one", otuVersion: "9", methodName: "edit" });

		const patched = await patchOtusToVersions(db, [
			{ otuId: "otu_one", version: 3 },
		]);

		const otu = expectPatched(patched, "otu_one", 3);

		expect(otu.name).toBe("Gamma");
		expect(otu.version).toBe(3);
	});

	it("reverts several edit changes and restamps the reference", async () => {
		await seedRenamedOtu();

		const patched = await patchOtusToVersions(db, [
			{ otuId: "otu_one", version: 1 },
		]);

		const otu = expectPatched(patched, "otu_one", 1);

		expect(otu.name).toBe("Alpha");
		expect(otu.version).toBe(1);
		expect(otu.reference).toEqual({ id: 5 });

		const isolates = otu.isolates as Record<string, unknown>[];
		const sequences = isolates[0]?.sequences as Record<string, unknown>[];

		expect(sequences).toHaveLength(1);
		expect(sequences[0]?.reference).toEqual({ id: 5 });
	});

	it("patches the same OTU to two versions in one call", async () => {
		await seedRenamedOtu();

		const patched = await patchOtusToVersions(db, [
			{ otuId: "otu_one", version: 2 },
			{ otuId: "otu_one", version: 1 },
		]);

		expect(expectPatched(patched, "otu_one", 2).name).toBe("Beta");
		expect(expectPatched(patched, "otu_one", 1).name).toBe("Alpha");
	});

	it("recovers a removed OTU from the remove change's document", async () => {
		const removed = await seedChange({
			otu: "otu_gone",
			otuVersion: null,
			methodName: "remove",
			referenceId: 7,
		});

		await seedDiff(removed, {
			_id: "otu_gone",
			name: "Zeta",
			version: 2,
			reference: { id: "stale" },
			isolates: [
				{
					id: "iso_z",
					sequences: [
						{ _id: "seq_z", isolate_id: "iso_z", reference: { id: "stale" } },
					],
				},
			],
		});

		const patched = await patchOtusToVersions(db, [
			{ otuId: "otu_gone", version: 2 },
		]);

		const otu = expectPatched(patched, "otu_gone", 2);

		expect(otu.name).toBe("Zeta");
		expect(otu.version).toBe(2);
		// The OTU has no live document, so the parent reference comes from its
		// latest change.
		expect(otu.reference).toEqual({ id: 7 });

		const isolates = otu.isolates as Record<string, unknown>[];
		const sequences = isolates[0]?.sequences as Record<string, unknown>[];

		expect(sequences[0]?.reference).toEqual({ id: 7 });
	});

	it("reverts the removed sentinel before any numbered version", async () => {
		const removed = await seedChange({
			otu: "otu_gone",
			otuVersion: null,
			methodName: "remove",
			referenceId: 7,
		});

		await seedDiff(removed, {
			_id: "otu_gone",
			name: "Beta",
			version: 2,
			reference: { id: "stale" },
			isolates: [],
		});

		await seedDiff(
			await seedChange({
				otu: "otu_gone",
				otuVersion: "2",
				methodName: "edit",
			}),
			renameDiff("Alpha", "Beta", 1),
		);

		const patched = await patchOtusToVersions(db, [
			{ otuId: "otu_gone", version: 1 },
		]);

		const otu = expectPatched(patched, "otu_gone", 1);

		// Only reachable if the `NULL` version sorted above version 2: the remove
		// has to produce the document the version-2 diff is then reverted from.
		expect(otu.name).toBe("Alpha");
		expect(otu.version).toBe(1);
	});

	it("returns null for a version below the OTU's create change", async () => {
		await seedOtu({
			_id: "otu_one",
			name: "Beta",
			version: 1,
			reference: { id: 5 },
			isolates: [],
		});

		await seedDiff(
			await seedChange({ otu: "otu_one", otuVersion: "1", methodName: "edit" }),
			renameDiff("Alpha", "Beta", 0),
		);

		await seedDiff(
			await seedChange({
				otu: "otu_one",
				otuVersion: "0",
				methodName: "create",
			}),
			{ _id: "otu_one", name: "Alpha", version: 0, isolates: [] },
		);

		// A create records version 0, so reverting one means asking for a version
		// that predates the OTU. The branch is what makes "did not exist yet"
		// expressible at all.
		const patched = await patchOtusToVersions(db, [
			{ otuId: "otu_one", version: -1 },
		]);

		expect(patched.get(otuSpecifierKey("otu_one", -1))).toBeNull();
	});

	it("returns null for an OTU with neither a row nor history", async () => {
		const patched = await patchOtusToVersions(db, [
			{ otuId: "otu_missing", version: 4 },
		]);

		expect(patched.has(otuSpecifierKey("otu_missing", 4))).toBe(true);
		expect(patched.get(otuSpecifierKey("otu_missing", 4))).toBeNull();
	});

	it("throws when a change's diff row is missing", async () => {
		await seedOtu({
			_id: "otu_one",
			name: "Beta",
			version: 2,
			reference: { id: 5 },
			isolates: [],
		});

		await seedChange({ otu: "otu_one", otuVersion: "2", methodName: "edit" });

		await expect(
			patchOtusToVersions(db, [{ otuId: "otu_one", version: 1 }]),
		).rejects.toThrow(MissingHistoryDiffError);
	});

	it("throws when a change's diff was never backfilled", async () => {
		await seedOtu({
			_id: "otu_one",
			name: "Beta",
			version: 2,
			reference: { id: 5 },
			isolates: [],
		});

		// The `"postgres"` sentinel lifted into the column in place of the diff it
		// stood for in Mongo. Patching around it would report the wrong version.
		await seedDiff(
			await seedChange({ otu: "otu_one", otuVersion: "2", methodName: "edit" }),
			"postgres",
		);

		await expect(
			patchOtusToVersions(db, [{ otuId: "otu_one", version: 1 }]),
		).rejects.toThrow(UnbackfilledHistoryDiffError);
	});

	it("throws when a remove change carries no document", async () => {
		await seedDiff(
			await seedChange({
				otu: "otu_gone",
				otuVersion: null,
				methodName: "remove",
			}),
			null,
		);

		await expect(
			patchOtusToVersions(db, [{ otuId: "otu_gone", version: 2 }]),
		).rejects.toThrow(UnbackfilledHistoryDiffError);
	});
});
