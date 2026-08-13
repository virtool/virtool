import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { legacyHistory, legacyHistoryDiff } from "../db/schema/history";
import { legacyOtus, legacySequences } from "../db/schema/otus";
import { legacyReferences } from "../db/schema/references";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	listByOtu,
	MalformedHistoryRowError,
	patchOtusToVersions,
} from "../history/data";
import { ReferenceNotFoundError } from "../references/data";
import {
	createIsolate,
	createOtu,
	createSequence,
	deleteIsolate,
	deleteOtu,
	deleteSequence,
	findOtus,
	getOtu,
	getOtuReference,
	OtuNameConflictError,
	OtuNotFoundError,
	SegmentNotDefinedError,
	SequenceNotFoundError,
	SourceTypeNotAllowedError,
	sequenceExists,
	setIsolateAsDefault,
	updateIsolate,
	updateOtu,
	updateSequence,
} from "./data";

let database: TestDatabase;
let db: Db;

let referenceId: number;
let userId: number;

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
	await db.delete(legacyReferences);
	await db.delete(users);

	const [user] = await db
		.insert(users)
		.values({
			handle: "leeashley",
			lastPasswordChange: new Date(),
			password: Buffer.from("x"),
			settings: {},
		})
		.returning({ id: users.id });

	userId = user?.id as number;

	const [reference] = await db
		.insert(legacyReferences)
		.values({ name: "Reference", user_id: userId })
		.returning({ id: legacyReferences.id });

	referenceId = reference?.id as number;
});

async function seedOtu(name = "Squash browning spot virus", abbreviation = "") {
	return createOtu(db, referenceId, { name, abbreviation, schema: [] }, userId);
}

async function readHistory(otuId: string) {
	return db
		.select({
			legacyId: legacyHistory.legacy_id,
			description: legacyHistory.description,
			methodName: legacyHistory.method_name,
			otuVersion: legacyHistory.otu_version,
			referenceId: legacyHistory.reference_id,
			indexId: legacyHistory.index_id,
			diff: legacyHistoryDiff.diff,
			changeId: legacyHistoryDiff.change_id,
		})
		.from(legacyHistory)
		.innerJoin(
			legacyHistoryDiff,
			eq(legacyHistoryDiff.history_id, legacyHistory.id),
		)
		.where(eq(legacyHistory.otu, otuId))
		.orderBy(asc(legacyHistory.id));
}

describe("createOtu", () => {
	it("creates an OTU at version 0 with a create change carrying the whole document", async () => {
		const otu = await seedOtu("Squash browning spot virus", "SBSV");

		expect(otu).toMatchObject({
			abbreviation: "SBSV",
			name: "Squash browning spot virus",
			version: 0,
			verified: false,
			isolates: [],
			lastIndexedVersion: null,
			reference: { id: referenceId, name: "Reference" },
			schema: [],
		});

		// An OTU with no isolates cannot be built, and says so.
		expect(otu.issues).toEqual({
			emptyIsolate: false,
			emptyOtu: true,
			emptySequence: false,
			isolateInconsistency: false,
		});

		const history = await readHistory(otu.id);

		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({
			legacyId: `${otu.id}.0`,
			changeId: `${otu.id}.0`,
			description: "Created Squash browning spot virus (SBSV)",
			methodName: "create",
			otuVersion: "0",
			referenceId,
			indexId: null,
		});

		// A create stores the whole document rather than a diff.
		expect(history[0]?.diff).toMatchObject({
			_id: otu.id,
			name: "Squash browning spot virus",
			version: 0,
		});
	});

	it("stores the document under data with lower_name, which no column carries", async () => {
		const otu = await seedOtu("Mixed Case Name");

		const [row] = await db
			.select({ data: legacyOtus.data })
			.from(legacyOtus)
			.where(eq(legacyOtus.id, otu.id));

		expect(row?.data).toMatchObject({
			_id: otu.id,
			lower_name: "mixed case name",
			reference: { id: referenceId },
		});
	});

	it("refuses a name already used in the reference", async () => {
		await seedOtu("Duplicate");

		await expect(seedOtu("duplicate")).rejects.toThrow(OtuNameConflictError);
	});

	it("reports both collisions together", async () => {
		await seedOtu("Duplicate", "DUP");

		await expect(seedOtu("Duplicate", "DUP")).rejects.toThrow(
			"Name and abbreviation already exist",
		);
	});
});

describe("updateOtu", () => {
	it("bumps the version and records an edit diff", async () => {
		const otu = await seedOtu("Original", "ORI");

		const updated = await updateOtu(db, otu.id, { name: "Renamed" }, userId);

		expect(updated.name).toBe("Renamed");
		expect(updated.version).toBe(1);

		const history = await readHistory(otu.id);

		expect(history).toHaveLength(2);
		expect(history[1]).toMatchObject({
			methodName: "edit",
			otuVersion: "1",
			// Only what changed is described. The abbreviation and schema were sent
			// unchanged and go unmentioned.
			description: "Changed name to Renamed",
		});

		// An edit stores a dictdiffer diff, not the document.
		expect(Array.isArray(history[1]?.diff)).toBe(true);
	});

	it("describes an added, changed, and removed abbreviation differently", async () => {
		const added = await seedOtu("Added");

		await updateOtu(db, added.id, { abbreviation: "NEW" }, userId);
		expect((await readHistory(added.id)).at(-1)?.description).toBe(
			"Added abbreviation NEW",
		);

		await updateOtu(db, added.id, { abbreviation: "OTHER" }, userId);
		expect((await readHistory(added.id)).at(-1)?.description).toBe(
			"Changed abbreviation to OTHER",
		);

		await updateOtu(db, added.id, { abbreviation: "" }, userId);
		expect((await readHistory(added.id)).at(-1)?.description).toBe(
			"Removed abbreviation OTHER",
		);
	});

	it("writes nothing when a schema is resent unchanged", async () => {
		const schema = [
			{ molecule: "ssRNA" as const, name: "RNA A", required: true },
			{ molecule: null, name: "RNA B", required: false },
		];

		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Segmented", abbreviation: "", schema },
			userId,
		);

		// Postgres normalises a jsonb object's keys by length then bytes, so the
		// stored schema spells a segment in a different key order than the request
		// did. Comparing the two as JSON strings would call this a change.
		const updated = await updateOtu(db, otu.id, { schema }, userId);

		expect(updated.version).toBe(0);
		expect(await readHistory(otu.id)).toHaveLength(1);
	});

	it("still notices a reordered schema", async () => {
		const first = { molecule: null, name: "RNA A", required: true };
		const second = { molecule: null, name: "RNA B", required: true };

		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Segmented", abbreviation: "", schema: [first, second] },
			userId,
		);

		const updated = await updateOtu(
			db,
			otu.id,
			{ schema: [second, first] },
			userId,
		);

		expect(updated.version).toBe(1);
	});

	it("describes a schema-only edit on its own", async () => {
		const otu = await seedOtu("Schematic");

		await updateOtu(
			db,
			otu.id,
			{ schema: [{ molecule: null, name: "DNA A", required: true }] },
			userId,
		);

		expect((await readHistory(otu.id)).at(-1)?.description).toBe(
			"Modified schema",
		);
	});

	it("joins every field an edit actually touched", async () => {
		const otu = await seedOtu("Original", "ORI");

		await updateOtu(
			db,
			otu.id,
			{
				name: "Renamed",
				abbreviation: "NEW",
				schema: [{ molecule: null, name: "DNA A", required: true }],
			},
			userId,
		);

		expect((await readHistory(otu.id)).at(-1)?.description).toBe(
			"Changed name to Renamed and changed abbreviation to NEW and modified schema",
		);
	});

	it("writes nothing when nothing changed", async () => {
		const otu = await seedOtu("Original", "ORI");

		const updated = await updateOtu(
			db,
			otu.id,
			{ name: "Original", abbreviation: "ORI" },
			userId,
		);

		expect(updated.version).toBe(0);
		expect(await readHistory(otu.id)).toHaveLength(1);
	});

	it("lets an OTU keep its own name without colliding with itself", async () => {
		const otu = await seedOtu("Original", "ORI");

		const updated = await updateOtu(
			db,
			otu.id,
			{ name: "Original", abbreviation: "NEW" },
			userId,
		);

		expect(updated.abbreviation).toBe("NEW");
	});

	it("unsets the segment on sequences whose segment the schema drops", async () => {
		const otu = await createOtu(
			db,
			referenceId,
			{
				name: "Segmented",
				abbreviation: "",
				schema: [{ molecule: null, name: "DNA A", required: true }],
			},
			userId,
		);

		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		await createSequence(
			db,
			otu.id,
			isolate.id,
			{
				accession: "NC_112201",
				definition: "A made up sequence",
				host: "okra",
				segment: "DNA A",
				sequence: "ATGCGTGTACTG",
			},
			userId,
		);

		await updateOtu(db, otu.id, { schema: [] }, userId);

		const after = await getOtu(db, otu.id);

		expect(after.isolates[0]?.sequences[0]?.segment).toBeNull();

		// The key is removed from `data`, not set to null: an absent field and a
		// null one diff differently, and every patch built on it would disagree.
		const [row] = await db
			.select({ data: legacySequences.data })
			.from(legacySequences)
			.where(eq(legacySequences.otu_id, otu.id));

		expect(row?.data).not.toHaveProperty("segment");
	});
});

describe("isolates", () => {
	it("makes the first isolate default whether or not asked", async () => {
		const otu = await seedOtu();

		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: false, sourceName: "Ever", sourceType: "Isolate" },
			userId,
		);

		expect(isolate).toMatchObject({
			default: true,
			// The source type is lower-cased; the source name is not.
			sourceType: "isolate",
			sourceName: "Ever",
			sequences: [],
		});

		const history = await readHistory(otu.id);

		expect(history[1]).toMatchObject({
			methodName: "add_isolate",
			description: "Added Isolate Ever as default",
		});
	});

	it("moves the default when a second isolate claims it", async () => {
		const otu = await seedOtu();

		const first = await createIsolate(
			db,
			otu.id,
			{ default: false, sourceName: "One", sourceType: "isolate" },
			userId,
		);
		const second = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Two", sourceType: "isolate" },
			userId,
		);

		const after = await getOtu(db, otu.id);
		const byId = new Map(after.isolates.map((i) => [i.id, i.default]));

		expect(byId.get(first.id)).toBe(false);
		expect(byId.get(second.id)).toBe(true);
	});

	it("returns an already-default isolate untouched, writing no change", async () => {
		const otu = await seedOtu();

		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		const before = await readHistory(otu.id);

		const result = await setIsolateAsDefault(db, otu.id, isolate.id, userId);

		expect(result.default).toBe(true);
		expect(await readHistory(otu.id)).toHaveLength(before.length);
		expect((await getOtu(db, otu.id)).version).toBe(1);
	});

	it("renames an isolate and describes the rename", async () => {
		const otu = await seedOtu();

		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		const renamed = await updateIsolate(
			db,
			otu.id,
			isolate.id,
			{ sourceName: "Never" },
			userId,
		);

		expect(renamed.sourceName).toBe("Never");

		const history = await readHistory(otu.id);

		expect(history.at(-1)).toMatchObject({
			methodName: "edit_isolate",
			description: "Renamed Isolate Ever to Isolate Never",
		});
	});

	it("promotes the next isolate when the default is removed", async () => {
		const otu = await seedOtu();

		const first = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "One", sourceType: "isolate" },
			userId,
		);
		const second = await createIsolate(
			db,
			otu.id,
			{ default: false, sourceName: "Two", sourceType: "isolate" },
			userId,
		);

		await deleteIsolate(db, otu.id, first.id, userId);

		const after = await getOtu(db, otu.id);

		expect(after.isolates).toHaveLength(1);
		expect(after.isolates[0]).toMatchObject({ id: second.id, default: true });

		expect((await readHistory(otu.id)).at(-1)).toMatchObject({
			methodName: "remove_isolate",
			description: "Removed Isolate One and set Isolate Two as default",
		});
	});

	it("deletes the isolate's sequences with it", async () => {
		const otu = await seedOtu();

		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		await createSequence(
			db,
			otu.id,
			isolate.id,
			{
				accession: "NC_112201",
				definition: "A made up sequence",
				host: "okra",
				segment: null,
				sequence: "ATGCGTGTACTG",
			},
			userId,
		);

		await deleteIsolate(db, otu.id, isolate.id, userId);

		const rows = await db
			.select({ id: legacySequences.id })
			.from(legacySequences)
			.where(eq(legacySequences.otu_id, otu.id));

		expect(rows).toHaveLength(0);
	});

	it("refuses a source type the reference does not permit", async () => {
		await db
			.update(legacyReferences)
			.set({ restrict_source_types: true, source_types: ["isolate"] })
			.where(eq(legacyReferences.id, referenceId));

		const otu = await seedOtu();

		await expect(
			createIsolate(
				db,
				otu.id,
				{ default: true, sourceName: "Ever", sourceType: "strain" },
				userId,
			),
		).rejects.toThrow(SourceTypeNotAllowedError);
	});
});

describe("sequences", () => {
	async function seedIsolate() {
		const otu = await seedOtu();
		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		return { otuId: otu.id, isolateId: isolate.id };
	}

	it("verifies the OTU once every isolate has a sequence", async () => {
		const { otuId, isolateId } = await seedIsolate();

		const sequence = await createSequence(
			db,
			otuId,
			isolateId,
			{
				accession: "NC_112201",
				definition: "A made up sequence",
				host: "okra",
				segment: null,
				sequence: "ATGCGTGTACTG",
			},
			userId,
		);

		expect(sequence).toMatchObject({
			accession: "NC_112201",
			host: "okra",
			segment: null,
			sequence: "ATGCGTGTACTG",
			remote: null,
		});

		const after = await getOtu(db, otuId);

		expect(after.verified).toBe(true);
		expect(after.issues).toBeNull();
		expect(after.version).toBe(2);
	});

	it("refuses a segment the OTU's schema does not define", async () => {
		const { otuId, isolateId } = await seedIsolate();

		await expect(
			createSequence(
				db,
				otuId,
				isolateId,
				{
					accession: "NC_112201",
					definition: "A made up sequence",
					host: "",
					segment: "DNA Z",
					sequence: "ATGC",
				},
				userId,
			),
		).rejects.toThrow(SegmentNotDefinedError);
	});

	it("keeps a sequence's position when it is edited", async () => {
		const { otuId, isolateId } = await seedIsolate();

		const values = {
			definition: "A made up sequence",
			host: "",
			segment: null,
			sequence: "ATGC",
		};

		const first = await createSequence(
			db,
			otuId,
			isolateId,
			{ ...values, accession: "ONE" },
			userId,
		);
		const second = await createSequence(
			db,
			otuId,
			isolateId,
			{ ...values, accession: "TWO" },
			userId,
		);

		await updateSequence(
			db,
			otuId,
			isolateId,
			first.id,
			{ definition: "Edited" },
			userId,
		);

		const after = await getOtu(db, otuId);

		expect(after.isolates[0]?.sequences.map((s) => s.id)).toEqual([
			first.id,
			second.id,
		]);
	});

	it("reports an empty sequence as an issue against its isolate", async () => {
		const { otuId, isolateId } = await seedIsolate();

		const sequence = await createSequence(
			db,
			otuId,
			isolateId,
			{
				accession: "NC_112201",
				definition: "A made up sequence",
				host: "",
				segment: null,
				sequence: "ATGC",
			},
			userId,
		);

		// The request schema forbids an empty sequence, so the only way to reach
		// this state is a document written before that rule — which is exactly what
		// the issue report exists to surface.
		await db
			.update(legacySequences)
			.set({
				data: { ...{}, _id: sequence.id, isolate_id: isolateId, sequence: "" },
			})
			.where(eq(legacySequences.id, sequence.id));

		const after = await getOtu(db, otuId);

		expect(after.issues).toMatchObject({
			emptySequence: [{ id: sequence.id, isolateId }],
		});
	});
});

describe("sequence scoping", () => {
	// Authorization is granted against the OTU's reference, so a sequence read or
	// deleted by id alone would let a caller with `modify_otu` on one reference
	// reach a sequence in another by naming their own OTU beside its id.
	async function seedTwoOtus() {
		const mine = await seedOtu("Mine");
		const theirs = await seedOtu("Theirs");

		const mineIsolate = await createIsolate(
			db,
			mine.id,
			{ default: true, sourceName: "One", sourceType: "isolate" },
			userId,
		);
		const theirsIsolate = await createIsolate(
			db,
			theirs.id,
			{ default: true, sourceName: "Two", sourceType: "isolate" },
			userId,
		);

		const values = {
			accession: "NC_112201",
			definition: "A made up sequence",
			host: "",
			segment: null,
			sequence: "ATGC",
		};

		await createSequence(db, mine.id, mineIsolate.id, values, userId);

		const theirSequence = await createSequence(
			db,
			theirs.id,
			theirsIsolate.id,
			values,
			userId,
		);

		return {
			otuId: mine.id,
			isolateId: mineIsolate.id,
			foreignSequenceId: theirSequence.id,
		};
	}

	it("refuses to update a sequence belonging to another OTU", async () => {
		const { otuId, isolateId, foreignSequenceId } = await seedTwoOtus();

		await expect(
			updateSequence(
				db,
				otuId,
				isolateId,
				foreignSequenceId,
				{ definition: "Hijacked" },
				userId,
			),
		).rejects.toThrow(SequenceNotFoundError);
	});

	it("refuses to remove a sequence belonging to another OTU", async () => {
		const { otuId, isolateId, foreignSequenceId } = await seedTwoOtus();

		await expect(
			deleteSequence(db, otuId, isolateId, foreignSequenceId, userId),
		).rejects.toThrow(SequenceNotFoundError);

		await expect(
			sequenceExists(db, otuId, isolateId, foreignSequenceId),
		).resolves.toBe(false);
	});
});

describe("deleteOtu", () => {
	it("records a remove change carrying the whole document under the removed sentinel", async () => {
		const otu = await seedOtu("Doomed", "DOOM");

		await deleteOtu(db, otu.id, userId);

		expect(
			await db.select().from(legacyOtus).where(eq(legacyOtus.id, otu.id)),
		).toHaveLength(0);

		const history = await readHistory(otu.id);

		expect(history.at(-1)).toMatchObject({
			legacyId: `${otu.id}.removed`,
			description: "Removed Doomed (DOOM)",
			methodName: "remove",
			// The sentinel is never stored; NULL is what stands for it.
			otuVersion: null,
		});

		expect(history.at(-1)?.diff).toMatchObject({ _id: otu.id, name: "Doomed" });
	});
});

describe("listByOtu", () => {
	it("lists changes newest first with the user and reference joined in", async () => {
		const otu = await seedOtu("Historic");

		await updateOtu(db, otu.id, { name: "Renamed" }, userId);

		const changes = await listByOtu(db, otu.id);

		expect(changes).toHaveLength(2);
		expect(changes[0]).toMatchObject({
			id: `${otu.id}.1`,
			methodName: "edit",
			index: null,
			otu: { id: otu.id, version: 1 },
			reference: { id: referenceId, name: "Reference" },
			user: { id: userId, handle: "leeashley" },
		});
		expect(changes[1]?.otu.version).toBe(0);
		expect(changes[0]?.createdAt).toBeInstanceOf(Date);
	});

	it("sorts the removal above every numbered version", async () => {
		const otu = await seedOtu("Doomed");

		await updateOtu(db, otu.id, { name: "Renamed" }, userId);
		await deleteOtu(db, otu.id, userId);

		// The OTU row is gone, so read the history directly rather than through the
		// existence guard.
		const rows = await db
			.select({ otuVersion: legacyHistory.otu_version })
			.from(legacyHistory)
			.where(eq(legacyHistory.otu, otu.id));

		expect(rows).toHaveLength(3);
	});

	it("returns an empty list for an OTU with no history", async () => {
		const otu = await seedOtu();

		await db.delete(legacyHistoryDiff);
		await db.delete(legacyHistory);

		await expect(listByOtu(db, otu.id)).resolves.toEqual([]);
	});

	it("refuses to serve a change that names no reference", async () => {
		const otu = await seedOtu();

		await db
			.update(legacyHistory)
			.set({ reference_id: null })
			.where(eq(legacyHistory.otu, otu.id));

		await expect(listByOtu(db, otu.id)).rejects.toThrow(
			MalformedHistoryRowError,
		);
	});

	it("throws for an OTU that does not exist", async () => {
		await expect(listByOtu(db, "nope")).rejects.toThrow(OtuNotFoundError);
	});
});

describe("findOtus", () => {
	it("pages, orders by lower(name), and counts", async () => {
		await seedOtu("beta");
		await seedOtu("Alpha");
		await seedOtu("Gamma");

		const page = await findOtus(db, referenceId, {
			page: 1,
			perPage: 2,
			term: "",
		});

		expect(page.items.map((item) => item.name)).toEqual(["Alpha", "beta"]);
		expect(page).toMatchObject({
			foundCount: 3,
			page: 1,
			pageCount: 2,
			perPage: 2,
			totalCount: 3,
		});
		expect(page.items[0]?.reference).toEqual({
			id: referenceId,
			name: "Reference",
		});
	});

	it("counts every OTU with an unbuilt change as modified", async () => {
		await seedOtu("Alpha");
		await seedOtu("Beta");

		const page = await findOtus(db, referenceId, {
			page: 1,
			perPage: 25,
			term: "",
		});

		expect(page.modifiedCount).toBe(2);
	});

	it("searches name and abbreviation, leaving totalCount unfiltered", async () => {
		await seedOtu("Alpha", "ALP");
		await seedOtu("Beta", "BET");

		const page = await findOtus(db, referenceId, {
			page: 1,
			perPage: 25,
			term: "bet",
		});

		expect(page.items.map((item) => item.name)).toEqual(["Beta"]);
		expect(page.foundCount).toBe(1);
		expect(page.totalCount).toBe(2);
	});

	it("throws for a reference that does not exist", async () => {
		await expect(
			findOtus(db, referenceId + 1000, { page: 1, perPage: 25, term: "" }),
		).rejects.toThrow(ReferenceNotFoundError);
	});

	it("treats an underscore in the term literally", async () => {
		await seedOtu("Alpha");
		await seedOtu("A_pha");

		const page = await findOtus(db, referenceId, {
			page: 1,
			perPage: 25,
			term: "A_pha",
		});

		expect(page.items.map((item) => item.name)).toEqual(["A_pha"]);
	});
});

describe("getOtuReference", () => {
	it("resolves the reference, and scopes to an isolate when one is named", async () => {
		const otu = await seedOtu();
		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		await expect(getOtuReference(db, otu.id)).resolves.toEqual({
			id: referenceId,
			archived: false,
		});
		await expect(getOtuReference(db, otu.id, isolate.id)).resolves.toEqual({
			id: referenceId,
			archived: false,
		});
		// An isolate the OTU does not carry resolves to nothing, which is what
		// makes a bad isolate id a 404 rather than a 403.
		await expect(getOtuReference(db, otu.id, "nope")).resolves.toBeNull();
		await expect(getOtuReference(db, "nope")).resolves.toBeNull();
	});

	it("reports an archived parent", async () => {
		const otu = await seedOtu();

		await db
			.update(legacyReferences)
			.set({ archived: true })
			.where(eq(legacyReferences.id, referenceId));

		await expect(getOtuReference(db, otu.id)).resolves.toEqual({
			id: referenceId,
			archived: true,
		});
	});
});

describe("history round trip", () => {
	it("patches an OTU back through the diffs this module wrote", async () => {
		const otu = await seedOtu("Round Trip");

		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		await createSequence(
			db,
			otu.id,
			isolate.id,
			{
				accession: "NC_112201",
				definition: "A made up sequence",
				host: "okra",
				segment: null,
				sequence: "ATGCGTGTACTG",
			},
			userId,
		);

		const current = await getOtu(db, otu.id);

		expect(current.version).toBe(2);

		const patched = await patchOtusToVersions(db, [
			{ otuId: otu.id, version: 0 },
			{ otuId: otu.id, version: 1 },
		]);

		// Version 0: created, no isolates yet.
		const atZero = patched.get(`${otu.id}:0`);

		expect(atZero).toMatchObject({ _id: otu.id, version: 0, isolates: [] });

		// Version 1: the isolate exists but carries no sequences.
		const atOne = patched.get(`${otu.id}:1`);
		const isolatesAtOne = atOne?.isolates as Record<string, unknown>[];

		expect(atOne).toMatchObject({ version: 1 });
		expect(isolatesAtOne).toHaveLength(1);
		expect(isolatesAtOne[0]).toMatchObject({
			id: isolate.id,
			source_name: "Ever",
			source_type: "isolate",
		});
		expect(isolatesAtOne[0]?.sequences).toEqual([]);
	});

	it("recovers the verified an OTU actually held at each version", async () => {
		const otu = await seedOtu("Verification");

		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		// This is the change that verifies the OTU: the isolate stops being empty.
		await createSequence(
			db,
			otu.id,
			isolate.id,
			{
				accession: "NC_112201",
				definition: "A made up sequence",
				host: "okra",
				segment: null,
				sequence: "ATGCGTGTACTG",
			},
			userId,
		);

		expect((await getOtu(db, otu.id)).verified).toBe(true);

		const patched = await patchOtusToVersions(db, [
			{ otuId: otu.id, version: 1 },
		]);

		// At version 1 the OTU had one empty isolate and was not verified. A change
		// recorded against a document that still said `false` while the row said
		// `true` would replay to the wrong answer here.
		expect(patched.get(`${otu.id}:1`)).toMatchObject({ verified: false });
	});

	it("recovers a removed OTU from the change that removed it", async () => {
		const otu = await seedOtu("Doomed");

		await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		await deleteOtu(db, otu.id, userId);

		const patched = await patchOtusToVersions(db, [
			{ otuId: otu.id, version: 1 },
		]);

		expect(patched.get(`${otu.id}:1`)).toMatchObject({
			_id: otu.id,
			name: "Doomed",
			version: 1,
		});
	});
});
